import json

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import flt

from ovira_marketplace.customers import (
    customer_for_user,
    get_or_create_customer,
    new_customer,
)
from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)

FREE_SHIPPING_THRESHOLD = 500
FLAT_SHIPPING = 50


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=30, seconds=60 * 60, methods="POST")
def place_order(items, customer, payment_method="cod"):
    """Create a Marketplace Order from the storefront cart and split it into
    per-vendor ERPNext Sales Orders.

    `items`: [{"slug": "...", "qty": 1}, ...]
    `customer`: {"name", "phone", "email", "gov", "address"}
    """
    items = _loads(items)
    customer = _loads(customer)
    if not items:
        frappe.throw(_("Your cart is empty."))

    settings = get_settings()
    order = frappe.new_doc("Marketplace Order")
    order.customer = _ensure_customer(customer)
    order.customer_name = customer.get("name")
    order.phone = customer.get("phone")
    order.email = customer.get("email") or _session_email()
    order.governorate = customer.get("gov")
    order.shipping_address = customer.get("address")
    order.payment_method = payment_method
    order.status = "Pending Payment"
    order.payment_status = "Unpaid"
    order.currency = settings.default_currency

    subtotal = 0.0
    shortages = []
    for line in items:
        product = frappe.db.get_value(
            "Marketplace Product",
            {"slug": line.get("slug"), "approval_status": "Approved", "published": 1},
            ["name", "vendor", "price", "title", "stock_qty", "track_inventory"],
            as_dict=True,
        )
        if not product:
            continue
        # Never trust the client-supplied quantity: clamp to a positive integer
        # so a negative qty can't be used to drive the order total down.
        try:
            qty = int(line.get("qty") or 1)
        except (TypeError, ValueError):
            qty = 1
        qty = max(1, qty)

        # Block overselling for products that track inventory. `stock_qty` is the
        # value synced from ERPNext and shown to the shopper, so we gate on it.
        # Any shortage rejects the whole order (below) rather than silently
        # trimming quantities the buyer didn't agree to.
        if product.track_inventory:
            available = int(flt(product.stock_qty))
            if available <= 0:
                shortages.append(_("{0} is out of stock.").format(product.title))
                continue
            if qty > available:
                shortages.append(
                    _("Only {0} left of {1}.").format(available, product.title)
                )
                continue

        amount = flt(product.price) * qty
        subtotal += amount
        order.append(
            "items",
            {
                "marketplace_product": product.name,
                "title": product.title,
                "vendor": product.vendor,
                "qty": qty,
                "rate": product.price,
                "amount": amount,
            },
        )

    if shortages:
        frappe.throw("<br>".join(shortages), title=_("Stock unavailable"))

    if not order.get("items"):
        frappe.throw(_("None of the cart items are available."))

    order.subtotal = subtotal
    order.shipping_amount = _shipping_amount(subtotal, customer.get("gov"))
    order.total = subtotal + order.shipping_amount

    order.insert(ignore_permissions=True)
    order.create_vendor_orders()
    frappe.db.commit()

    # `token` lets the storefront start payment for this specific order without
    # exposing every order to any guest who can guess an id.
    return {
        "name": order.name,
        "total": order.total,
        "status": order.status,
        "token": order.access_token,
    }


def _ensure_customer(info):
    """Resolve the Customer this order belongs to.

    A logged-in shopper is always bound to *their own* account (by login, never
    by the typed name) so orders can't leak across people who share a name. A
    guest gets a fresh Customer per order — we have no authenticated identity to
    safely dedupe against.
    """
    user = frappe.session.user
    if user and user != "Guest":
        existing = customer_for_user(user)
        if existing:
            return existing
        full_name = info.get("name") or frappe.db.get_value("User", user, "full_name") or user
        return get_or_create_customer(full_name, email=user, phone=info.get("phone"))

    customer = new_customer(info.get("name"), info.get("phone"))
    customer.flags.ignore_permissions = True
    customer.insert(ignore_permissions=True)
    return customer.name


def _shipping_amount(subtotal, governorate=None):
    """Rate from the configured Shipping Provider; falls back to the flat rule
    (free over the threshold) if no provider is enabled or the lookup fails."""
    try:
        from ovira_marketplace.api.shipping import get_rate

        return flt(get_rate(subtotal, governorate))
    except Exception:
        frappe.log_error(title="Ovira: shipping rate lookup failed")
        return 0 if subtotal >= FREE_SHIPPING_THRESHOLD else FLAT_SHIPPING


def _session_email():
    user = frappe.session.user
    return user if user and user != "Guest" else None


def _loads(value):
    return json.loads(value) if isinstance(value, str) else value

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
def place_order(
    items, customer, payment_method="cod", coupon=None, attribution=None, use_wallet=False
):
    """Create a Marketplace Order from the storefront cart and split it into
    per-vendor ERPNext Sales Orders.

    `items`: [{"slug": "...", "qty": 1}, ...]
    `customer`: {"name", "phone", "email", "gov", "address"}
    `coupon`: optional coupon code — re-validated and priced server-side.
    `attribution`: optional {utm_source, utm_medium, utm_campaign, referrer,
      landing_page} captured by the storefront; the channel is derived here.
    `use_wallet`: when true, spend the signed-in buyer's store credit (capped at
      the payable) — booked as an operator-funded discount, like a coupon.
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
    _apply_attribution(order, attribution)

    from ovira_marketplace.api.deals import active_deal

    subtotal = 0.0
    shortages = []
    deal_redemptions = []
    for line in items:
        product = frappe.db.get_value(
            "Marketplace Product",
            {"slug": line.get("slug"), "approval_status": "Approved", "published": 1},
            ["name", "vendor", "price", "title", "stock_qty", "track_inventory", "has_variants"],
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

        # Resolve the price, stock and label — from the chosen variant when the
        # product has variants (server-side, so the client's price is ignored).
        rate = flt(product.price)
        title = product.title
        available = int(flt(product.stock_qty))
        gate_stock = bool(product.track_inventory)
        variant_sku = None

        if product.has_variants:
            variant = _resolve_variant(product.name, line.get("variant"))
            if not variant:
                shortages.append(_("Please choose an option for {0}.").format(product.title))
                continue
            rate = flt(variant.price) or flt(product.price)
            title = f"{product.title} — {variant.option_value}"
            available = int(flt(variant.stock_qty))
            variant_sku = variant.sku
            gate_stock = True  # variant stock is explicit — always enforce it

        # A live flash deal replaces the rate server-side (single-price products
        # only). Vendor-funded: the lower rate flows into the SO and settlement,
        # so the vendor is paid on the deal price — no operator absorption.
        deal_name = None
        if not product.has_variants:
            deal = active_deal(product.name)
            if deal and flt(deal["deal_price"]) < rate:
                rate = flt(deal["deal_price"])
                deal_name = deal["name"]

        # Block overselling. Any shortage rejects the whole order (below) rather
        # than silently trimming quantities the buyer didn't agree to.
        if gate_stock:
            if available <= 0:
                shortages.append(_("{0} is out of stock.").format(title))
                continue
            if qty > available:
                shortages.append(_("Only {0} left of {1}.").format(available, title))
                continue

        amount = rate * qty
        subtotal += amount
        order.append(
            "items",
            {
                "marketplace_product": product.name,
                "title": title,
                "variant_sku": variant_sku,
                "vendor": product.vendor,
                "qty": qty,
                "rate": rate,
                "amount": amount,
            },
        )
        if deal_name:
            deal_redemptions.append((deal_name, qty))

    if shortages:
        frappe.throw("<br>".join(shortages), title=_("Stock unavailable"))

    if not order.get("items"):
        frappe.throw(_("None of the cart items are available."))

    order.subtotal = subtotal
    order.shipping_amount = _order_shipping(order, subtotal, customer.get("gov"), settings)

    # Coupon discount is always recomputed here — the client's number is never
    # trusted. An invalid/expired code surfaces its reason and stops checkout.
    coupon_doc = None
    discount = 0.0
    if coupon:
        from ovira_marketplace.api.coupons import resolve

        coupon_doc, discount = resolve(coupon, subtotal)
        order.coupon_code = coupon_doc.code
        order.discount_amount = discount

    # Store credit is applied after the coupon, capped at what's still payable.
    # It's booked as an operator-funded discount (see payment._invoice_and_pay),
    # so vendor settlement stays whole. Debited from the ledger once the order
    # exists (needs the order name as the reference).
    wallet_applied = 0.0
    user = frappe.session.user
    if _truthy(use_wallet) and user and user != "Guest":
        from ovira_marketplace.api.wallet import balance as wallet_balance

        payable = subtotal + order.shipping_amount - discount
        wallet_applied = max(0.0, min(flt(wallet_balance(user)), flt(payable)))
    order.wallet_applied = wallet_applied
    order.total = subtotal + order.shipping_amount - discount - wallet_applied

    order.insert(ignore_permissions=True)
    # Draw the ordered quantities down from the marketplace stock so the numbers
    # shoppers see reflect what's left. Restored if the order is cancelled (see
    # MarketplaceOrder._maybe_restock_on_cancel).
    reserve_order_stock(order)
    order.create_vendor_orders()
    if wallet_applied > 0:
        from ovira_marketplace.api.wallet import debit as wallet_debit

        wallet_debit(
            user,
            wallet_applied,
            reason="Order payment",
            reference_doctype="Marketplace Order",
            reference_name=order.name,
            note=order.name,
        )
    if coupon_doc:
        _redeem_coupon(coupon_doc.name)
    if deal_redemptions:
        from ovira_marketplace.api.deals import redeem_deal

        for deal_name, deal_qty in deal_redemptions:
            redeem_deal(deal_name, deal_qty)
    frappe.db.commit()

    try:
        from ovira_marketplace.emails import send_order_confirmation

        send_order_confirmation(order)
    except Exception:
        frappe.log_error(title="Ovira: order confirmation email failed")

    try:
        from ovira_marketplace.whatsapp import notify_order_confirmation

        notify_order_confirmation(order)
    except Exception:
        frappe.log_error(title="Ovira: order confirmation whatsapp failed")

    # `token` lets the storefront start payment for this specific order without
    # exposing every order to any guest who can guess an id.
    return {
        "name": order.name,
        "total": order.total,
        "status": order.status,
        "token": order.access_token,
    }


def reserve_order_stock(order):
    """Decrement marketplace stock for each line when an order is placed."""
    for it in order.items:
        _adjust_stock(it.marketplace_product, it.get("variant_sku"), -(it.qty or 0))


def restock_order(order):
    """Return each line's quantity to stock (used when an order is cancelled)."""
    for it in order.items:
        _adjust_stock(it.marketplace_product, it.get("variant_sku"), it.qty or 0)


def _adjust_stock(product_name, variant_sku, delta):
    """Shift a product's marketplace stock by ``delta`` (negative = sold,
    positive = restocked), floored at zero. For a variant line the specific
    variant row moves and the product's base stock is re-summed from its
    variants; otherwise the base stock moves directly. Best-effort — a stock
    hiccup must never break checkout or cancellation."""
    if not product_name or not delta:
        return
    try:
        doc = frappe.get_doc("Marketplace Product", product_name)
        if variant_sku and doc.has_variants and doc.get("variants"):
            for v in doc.variants:
                if v.sku == variant_sku:
                    v.db_set("stock_qty", max(0.0, flt(v.stock_qty) + delta))
                    break
            doc.db_set("stock_qty", sum(flt(v.stock_qty) for v in doc.variants))
        else:
            doc.db_set("stock_qty", max(0.0, flt(doc.stock_qty) + delta))
    except Exception:
        frappe.log_error(title="Ovira stock adjust failed")


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


_PAID_MEDIA = {"cpc", "ppc", "paid", "paidsearch", "display", "cpm", "banner", "retargeting"}
_EMAIL_MEDIA = {"email", "e-mail", "newsletter"}
_SOCIAL_MEDIA = {"social", "social-media", "social-network", "sm", "paid-social", "paidsocial"}
_SEARCH_HOSTS = ("google.", "bing.", "yahoo.", "duckduckgo.", "yandex.", "baidu.", "ecosia.")
_SOCIAL_HOSTS = (
    "facebook.", "instagram.", "twitter.", "t.co", "x.com", "tiktok.", "linkedin.",
    "youtube.", "youtu.be", "pinterest.", "snapchat.", "reddit.", "whatsapp.", "wa.me", "telegram.", "t.me",
)


def _host_of(url):
    """Bare hostname of a URL, lowercased, without the leading www. Empty on junk."""
    try:
        from urllib.parse import urlparse

        host = (urlparse(url).hostname or "").lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def _derive_source(utm_source, utm_medium, referrer):
    """Collapse raw UTM + referrer into one normalized marketing channel so
    orders group cleanly in reporting. Derived server-side (never client-trusted).
    """
    medium = (utm_medium or "").strip().lower()
    src = (utm_source or "").strip().lower()
    if medium:
        if medium in _PAID_MEDIA:
            return "paid"
        if medium in _EMAIL_MEDIA:
            return "email"
        if medium in _SOCIAL_MEDIA:
            return "social"
        if medium == "organic":
            return "organic"
        if medium == "referral":
            return "referral"
    if src:
        if any(src.startswith(h.rstrip(".")) for h in _SEARCH_HOSTS):
            return "organic"
        if any(s.rstrip(".") in src for s in ("facebook", "instagram", "twitter", "tiktok", "linkedin", "youtube", "pinterest", "snapchat", "reddit", "whatsapp", "telegram")):
            return "social"
        return "referral" if not medium else "other"

    host = _host_of(referrer)
    if host:
        own = _host_of(frappe.utils.get_url())
        if own and host == own:
            return "direct"  # internal navigation, not a real referral
        if any(h in host for h in _SEARCH_HOSTS):
            return "organic"
        if any(h in host for h in _SOCIAL_HOSTS):
            return "social"
        return "referral"
    return "direct"


def _apply_attribution(order, attribution):
    """Store the storefront-captured first-touch attribution on the order and
    stamp the normalized `source` channel. Best-effort — never blocks checkout."""
    try:
        data = _loads(attribution) if attribution else {}
        if not isinstance(data, dict):
            data = {}

        def clip(key, n):
            v = data.get(key)
            return (str(v).strip()[:n]) if v else None

        order.utm_source = clip("utm_source", 140)
        order.utm_medium = clip("utm_medium", 140)
        order.utm_campaign = clip("utm_campaign", 140)
        order.referrer = clip("referrer", 500)
        order.landing_page = clip("landing_page", 500)
        order.source = _derive_source(order.utm_source, order.utm_medium, order.referrer)
    except Exception:
        order.source = "direct"


def _order_shipping(order, subtotal, governorate, settings):
    """Order shipping under the active mode. Per-Vendor sums each vendor's own
    rule over their slice of the cart (from the booked line amounts, so deals and
    variant prices are already reflected); Operator uses the rate table."""
    if (settings.get("shipping_mode") or "Operator") == "Per Vendor":
        from ovira_marketplace.api.shipping import get_rate_for_vendor

        by_vendor = {}
        for it in order.items:
            by_vendor[it.vendor] = by_vendor.get(it.vendor, 0.0) + flt(it.amount)
        total = 0.0
        for vendor, vsub in by_vendor.items():
            try:
                total += flt(get_rate_for_vendor(vendor, vsub))
            except Exception:
                frappe.log_error(title="Ovira: per-vendor shipping failed")
        return total
    return _shipping_amount(subtotal, governorate)


def _shipping_amount(subtotal, governorate=None):
    """Rate from the configured Shipping Provider; falls back to the flat rule
    (free over the threshold) if no provider is enabled or the lookup fails."""
    try:
        from ovira_marketplace.api.shipping import get_rate

        return flt(get_rate(subtotal, governorate))
    except Exception:
        frappe.log_error(title="Ovira: shipping rate lookup failed")
        return 0 if subtotal >= FREE_SHIPPING_THRESHOLD else FLAT_SHIPPING


def _resolve_variant(product_name, sku):
    """The chosen variant row of a product, matched by SKU or child-row name.
    Returns a dict-like row or None."""
    if not sku:
        return None
    rows = frappe.get_all(
        "Marketplace Product Variant",
        filters={"parent": product_name, "parenttype": "Marketplace Product"},
        fields=["name", "option_value", "sku", "price", "stock_qty"],
        ignore_permissions=True,
    )
    for r in rows:
        if str(sku) in (r.get("sku"), r.get("name")):
            return r
    return None


def _redeem_coupon(name):
    """Bump a coupon's redemption count (best-effort; never blocks the order)."""
    try:
        used = int(frappe.db.get_value("Marketplace Coupon", name, "used_count") or 0)
        frappe.db.set_value("Marketplace Coupon", name, "used_count", used + 1)
    except Exception:
        frappe.log_error(title="Ovira: coupon redeem failed")


def _session_email():
    user = frappe.session.user
    return user if user and user != "Guest" else None


def _loads(value):
    return json.loads(value) if isinstance(value, str) else value


def _truthy(value):
    """A whitelisted flag may arrive as a real bool (JSON body) or a string."""
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)

import secrets

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint, flt, now_datetime

from ovira_marketplace.api.admin import OPERATOR_ROLES, _require_operator
from ovira_marketplace.shipping.connectors import default_provider, get_shipping_connector

FREE_SHIPPING_THRESHOLD = 500
FLAT_SHIPPING = 50


@frappe.whitelist(allow_guest=True)
def get_rate(subtotal, governorate=None):
    """Shipping fee for a subtotal + destination.

    A real carrier (Bosta/Aramex) prices its own shipments, so its connector wins
    when enabled. Otherwise (in-house "Manual" shipping, or no provider) the
    operator's per-governorate rate table applies, falling back to the Manual
    provider's flat config and finally the built-in constants."""
    provider = default_provider()
    if provider and provider != "Manual":
        connector = get_shipping_connector(provider)
        if connector:
            return connector.rate(flt(subtotal), governorate)
    return _resolve_local_rate(flt(subtotal), governorate)


def _resolve_local_rate(subtotal, governorate):
    """In-house rate: a per-governorate override first, then the Manual provider's
    flat config, then the built-in free-over/flat constants."""
    if governorate:
        rate = frappe.db.get_value(
            "Marketplace Shipping Rate",
            {"governorate": governorate, "enabled": 1},
            ["fee", "free_threshold"],
            as_dict=True,
        )
        if rate:
            threshold = flt(rate.free_threshold)
            if threshold and flt(subtotal) >= threshold:
                return 0
            return flt(rate.fee)

    connector = get_shipping_connector("Manual")
    if connector:
        return connector.rate(flt(subtotal), governorate)
    return 0 if flt(subtotal) >= FREE_SHIPPING_THRESHOLD else FLAT_SHIPPING


def get_rate_for_vendor(vendor, subtotal):
    """Per-vendor shipping fee from that vendor's own rule (Per-Vendor mode).

    Flat → the fee. Free Over → 0 once the vendor's subtotal reaches the
    threshold, else the fee. Always Free → 0. Missing vendor → 0."""
    v = frappe.db.get_value(
        "Marketplace Vendor",
        vendor,
        ["shipping_type", "shipping_fee", "shipping_free_over"],
        as_dict=True,
    )
    if not v:
        return 0.0
    stype = (v.shipping_type or "Flat").strip()
    if stype == "Always Free":
        return 0.0
    if stype == "Free Over":
        threshold = flt(v.shipping_free_over)
        if threshold and flt(subtotal) >= threshold:
            return 0.0
    return flt(v.shipping_fee)


def per_vendor_subtotals(items):
    """{vendor: subtotal} for a cart, resolving each line's product + price
    server-side (variant price wins). Shared by the preview and checkout so the
    quote the shopper sees matches what's booked. Unknown/unpublished slugs are
    skipped; the client-supplied price is never trusted."""
    per_vendor = {}
    for line in items or []:
        product = frappe.db.get_value(
            "Marketplace Product",
            {"slug": line.get("slug"), "approval_status": "Approved", "published": 1},
            ["name", "vendor", "price", "has_variants"],
            as_dict=True,
        )
        if not product:
            continue
        try:
            qty = max(1, int(line.get("qty") or 1))
        except (TypeError, ValueError):
            qty = 1
        rate = flt(product.price)
        if product.has_variants and line.get("variant"):
            vprice = frappe.db.get_value(
                "Marketplace Product Variant",
                {"parent": product.name, "sku": line.get("variant")},
                "price",
            )
            if vprice:
                rate = flt(vprice)
        per_vendor[product.vendor] = per_vendor.get(product.vendor, 0.0) + rate * qty
    return per_vendor


@frappe.whitelist(allow_guest=True)
def preview(items, governorate=None):
    """Live shipping quote for a cart, honouring the active shipping mode.

    `items`: [{"slug", "qty", "variant"?}, ...] — the shape the checkout posts.
    Operator mode → the order-level rate on the cart subtotal. Per-Vendor mode →
    the sum of each vendor's own rule applied to that vendor's slice of the cart."""
    import json

    if isinstance(items, str):
        items = json.loads(items)
    per_vendor = per_vendor_subtotals(items)
    subtotal = sum(per_vendor.values())
    if subtotal <= 0:
        return 0.0  # empty or all-unresolved cart — nothing to ship
    settings = frappe.get_cached_doc("Marketplace Settings")
    if (settings.get("shipping_mode") or "Operator") == "Per Vendor":
        return flt(sum(get_rate_for_vendor(v, sub) for v, sub in per_vendor.items()))
    return flt(get_rate(subtotal, governorate))


RATE_FIELDS = ["name", "governorate", "fee", "free_threshold", "eta_days", "enabled"]


@frappe.whitelist(allow_guest=True)
def shipping_rates():
    """Public: enabled per-governorate rates (fee + free threshold + ETA) so the
    checkout can preview cost and delivery time per destination."""
    return frappe.get_all(
        "Marketplace Shipping Rate",
        filters={"enabled": 1},
        fields=["governorate", "fee", "free_threshold", "eta_days"],
        order_by="governorate asc",
        ignore_permissions=True,
    )


@frappe.whitelist()
def list_shipping_rates():
    """Operator: every governorate rate row (enabled or not) for the manager."""
    _require_operator()
    return frappe.get_all(
        "Marketplace Shipping Rate",
        fields=RATE_FIELDS,
        order_by="governorate asc",
        ignore_permissions=True,
    )


@frappe.whitelist()
def upsert_shipping_rate(governorate, fee, free_threshold=0, eta_days=0, enabled=1, name=None):
    """Operator: create or update the rate for one governorate (keyed by name)."""
    _require_operator()
    governorate = (governorate or "").strip()
    if not governorate:
        frappe.throw(_("Enter a governorate."))

    existing = name or frappe.db.get_value("Marketplace Shipping Rate", {"governorate": governorate})
    doc = (
        frappe.get_doc("Marketplace Shipping Rate", existing)
        if existing and frappe.db.exists("Marketplace Shipping Rate", existing)
        else frappe.new_doc("Marketplace Shipping Rate")
    )
    doc.governorate = governorate
    doc.fee = flt(fee)
    doc.free_threshold = flt(free_threshold)
    doc.eta_days = cint(eta_days)
    doc.enabled = 1 if cint(enabled) else 0
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {f: doc.get(f) for f in RATE_FIELDS}


@frappe.whitelist()
def delete_shipping_rate(name):
    _require_operator()
    if frappe.db.exists("Marketplace Shipping Rate", name):
        frappe.delete_doc("Marketplace Shipping Rate", name, ignore_permissions=True)
        frappe.db.commit()
    return {"deleted": name}


@frappe.whitelist()
def create_shipments_for_order(order, provider=None):
    """Create and book one Shipment per vendor sub-order of a Marketplace Order."""
    _require_operator()
    order_doc = frappe.get_doc("Marketplace Order", order)
    provider = provider or default_provider()
    if not provider:
        frappe.throw(_("No shipping provider is enabled."))

    created = []
    seen = set()
    for row in order_doc.items:
        if not row.sales_order or row.sales_order in seen:
            continue
        seen.add(row.sales_order)
        shipment = frappe.new_doc("Marketplace Shipment")
        shipment.marketplace_order = order_doc.name
        shipment.vendor = row.vendor
        shipment.sales_order = row.sales_order
        shipment.provider = provider
        shipment.recipient_name = order_doc.customer_name
        shipment.recipient_phone = order_doc.phone
        shipment.governorate = order_doc.governorate
        shipment.address = order_doc.shipping_address
        shipment.shipping_cost = order_doc.shipping_amount
        shipment.insert(ignore_permissions=True)
        shipment.book()
        created.append(shipment.name)

    return {"shipments": created}


@frappe.whitelist()
def my_order_shipments(order):
    """The signed-in vendor's shipments for THEIR sub-order of an order — powers
    the vendor's own fulfilment panel (Per-Vendor mode: each vendor ships their
    part and drives its status; the platform aggregates)."""
    from ovira_marketplace.api.vendor import _my_vendor

    vendor = _my_vendor()
    if not vendor:
        return {"shipments": []}
    names = frappe.get_all(
        "Marketplace Shipment",
        filters={"marketplace_order": order, "vendor": vendor},
        pluck="name",
    )
    return {"shipments": [_shipment_flat(frappe.get_doc("Marketplace Shipment", n)) for n in names]}


@frappe.whitelist()
def create_my_shipment(order, provider=None):
    """A vendor creates the shipment for THEIR sub-order of an order (per-vendor
    fulfilment). Idempotent per Sales Order. Falls back to the in-house Manual
    provider so a vendor without a carrier account can still ship + advance."""
    from ovira_marketplace.api.vendor import _my_vendor

    vendor = _my_vendor()
    if not vendor:
        frappe.throw(_("You don't have a vendor store."), frappe.PermissionError)
    order_doc = frappe.get_doc("Marketplace Order", order)
    provider = provider or default_provider() or "Manual"
    created = []
    seen = set()
    for row in order_doc.items:
        if row.vendor != vendor or not row.sales_order or row.sales_order in seen:
            continue
        seen.add(row.sales_order)
        if frappe.db.exists("Marketplace Shipment", {"sales_order": row.sales_order}):
            continue  # already shipped
        shipment = frappe.new_doc("Marketplace Shipment")
        shipment.marketplace_order = order_doc.name
        shipment.vendor = vendor
        shipment.sales_order = row.sales_order
        shipment.provider = provider
        shipment.recipient_name = order_doc.customer_name
        shipment.recipient_phone = order_doc.phone
        shipment.governorate = order_doc.governorate
        shipment.address = order_doc.shipping_address
        shipment.shipping_cost = order_doc.shipping_amount
        shipment.insert(ignore_permissions=True)
        shipment.book()
        created.append(shipment.name)
    return {"shipments": created}


@frappe.whitelist()
def track(shipment):
    """Refresh and return a shipment's tracking timeline."""
    _require_operator()
    doc = frappe.get_doc("Marketplace Shipment", shipment)
    doc.refresh_tracking()
    return {"status": doc.status, "events": [e.as_dict() for e in doc.events]}


# -- tracking surface (buyer / operator / vendor) ---------------------------

SHIPMENT_STATUSES = (
    "Draft",
    "Created",
    "Picked Up",
    "In Transit",
    "Delivered",
    "Returned",
    "Cancelled",
)


def _shipment_flat(doc, with_events=True):
    row = {
        "name": doc.name,
        "vendor": doc.vendor,
        "vendor_name": frappe.db.get_value("Marketplace Vendor", doc.vendor, "vendor_name")
        if doc.vendor
        else None,
        "status": doc.status,
        "provider": doc.provider,
        "tracking_number": doc.tracking_number,
        "tracking_url": doc.tracking_url,
        "shipping_cost": doc.shipping_cost,
    }
    if with_events:
        row["events"] = [
            {
                "status": e.status,
                "description": e.description,
                "location": e.location,
                "posted_at": str(e.posted_at) if e.posted_at else None,
            }
            for e in sorted(doc.events, key=lambda e: (str(e.posted_at or ""), e.idx))
        ]
    return row


def _order_shipment_docs(order):
    names = frappe.get_all(
        "Marketplace Shipment",
        filters={"marketplace_order": order},
        pluck="name",
        order_by="creation asc",
        ignore_permissions=True,
    )
    return [frappe.get_doc("Marketplace Shipment", n) for n in names]


def _owns_order(order_doc):
    from ovira_marketplace.api.orders import _my_customers, _session_email

    email = _session_email()
    if not email:
        return False
    return order_doc.email == email or order_doc.customer in _my_customers(email)


@frappe.whitelist()
def order_tracking(order):
    """Shipment timeline for an order the signed-in buyer owns."""
    order_doc = frappe.get_doc("Marketplace Order", order)
    if not _owns_order(order_doc):
        frappe.throw(_("This order isn't yours."), frappe.PermissionError)
    return {"shipments": [_shipment_flat(d) for d in _order_shipment_docs(order)]}


@frappe.whitelist()
def operator_order_shipments(order):
    """All shipments for an order — operator view (create panel + timeline)."""
    _require_operator()
    return {"shipments": [_shipment_flat(d) for d in _order_shipment_docs(order)]}


@frappe.whitelist()
def update_shipment_status(shipment, status, note=None, location=None):
    """Manually advance a shipment (operator, or the vendor who owns it) and log
    an event. Intended for the Manual provider / offline carriers."""
    if status not in SHIPMENT_STATUSES:
        frappe.throw(_("Unknown shipment status."))
    doc = frappe.get_doc("Marketplace Shipment", shipment)

    if not _is_operator():
        from ovira_marketplace.api.vendor import _my_vendor

        if doc.vendor != _my_vendor():
            frappe.throw(_("This shipment isn't yours."), frappe.PermissionError)

    doc.status = status
    doc.append(
        "events",
        {
            "posted_at": frappe.utils.now_datetime(),
            "status": status,
            "description": note or _("Status updated to {0}").format(status),
            "location": location,
        },
    )
    doc.save(ignore_permissions=True)
    _sync_order_status_from_shipment(doc)
    frappe.db.commit()
    return _shipment_flat(doc)


# Fulfilment (shipment) advances the order's own status so the two panels stay
# in sync — the operator/vendor never has to drive both by hand. Returned /
# Cancelled shipments are deliberately left for the operator to act on the order.
SHIPMENT_TO_ORDER_STATUS = {
    "Picked Up": "Shipped",
    "In Transit": "Shipped",
    "Delivered": "Completed",
}


def _sync_order_status_from_shipment(shipment):
    target = SHIPMENT_TO_ORDER_STATUS.get(shipment.status)
    if not target or not shipment.marketplace_order:
        return
    order = frappe.get_doc("Marketplace Order", shipment.marketplace_order)
    if order.status == "Cancelled":
        return
    if target == "Completed":
        # Only complete the order once EVERY shipment on it is finished.
        statuses = frappe.get_all(
            "Marketplace Shipment", filters={"marketplace_order": order.name}, pluck="status"
        )
        if not all(s in ("Delivered", "Returned", "Cancelled") for s in statuses):
            target = "Shipped"
    if target == order.status:
        return
    if target == "Shipped" and order.status in ("Shipped", "Completed"):
        return
    order.status = target
    order.flags.ignore_permissions = True
    order.save(ignore_permissions=True)
    # COD delivered = the courier collected the cash → book the payment chain
    # (idempotent, best-effort so a booking hiccup never blocks fulfilment).
    if target == "Completed" and order.payment_status != "Paid":
        if (order.payment_method or "").strip().lower() in ("cod", "cash on delivery"):
            try:
                from ovira_marketplace.api.payment import record_payment

                record_payment(order.name)
            except Exception:
                frappe.log_error(title="Ovira: COD booking on delivery failed")


@frappe.whitelist()
def vendor_shipment_statuses():
    """Map of {marketplace_order: latest status} for the signed-in vendor, so the
    vendor order list can show fulfilment state."""
    from ovira_marketplace.api.vendor import _my_vendor

    vendor = _my_vendor()
    if not vendor:
        return {}
    rows = frappe.get_all(
        "Marketplace Shipment",
        filters={"vendor": vendor},
        fields=["marketplace_order", "status"],
        order_by="creation asc",
        ignore_permissions=True,
    )
    # Last write wins if a vendor somehow has multiple shipments on one order.
    return {r["marketplace_order"]: r["status"] for r in rows if r.get("marketplace_order")}


def _is_operator():
    user = frappe.session.user
    return user != "Guest" and any(r in frappe.get_roles(user) for r in OPERATOR_ROLES)


# -- delivery confirmation (OTP) --------------------------------------------


def new_delivery_otp():
    return f"{secrets.randbelow(10000):04d}"


def dispatch_delivery_otp(order, otp):
    """Send the buyer their delivery code over every configured channel plus an
    in-app notification. Each channel is best-effort — one failing never blocks
    the others or the order."""
    try:
        from ovira_marketplace.emails import send_delivery_otp

        send_delivery_otp(order, otp)
    except Exception:
        frappe.log_error(title="Ovira: delivery OTP email failed")
    try:
        from ovira_marketplace.whatsapp import notify_delivery_otp

        notify_delivery_otp(order, otp)
    except Exception:
        frappe.log_error(title="Ovira: delivery OTP whatsapp failed")
    if order.get("email") and frappe.db.exists("User", order.email):
        try:
            from ovira_marketplace.api.notifications import create_notification

            create_notification(
                user=order.email,
                kind="order",
                title="رمز تأكيد الاستلام",
                message=f"رمز استلام طلبك {order.name}: {otp}",
                reference_doctype="Marketplace Order",
                reference_name=order.name,
            )
        except Exception:
            frappe.log_error(title="Ovira: delivery OTP notification failed")


@frappe.whitelist()
@rate_limit(limit=25, seconds=60 * 10, methods="POST")
def confirm_delivery(order, otp):
    """Operator/courier verifies delivery with the buyer's one-time code, which
    completes the order and stamps a verified-delivery flag."""
    _require_operator()
    doc = frappe.get_doc("Marketplace Order", order)
    if doc.delivery_confirmed:
        return {"confirmed": True, "already": True}
    if not doc.delivery_otp:
        frappe.throw(_("No delivery code was issued for this order yet."))
    if str(otp or "").strip() != str(doc.delivery_otp):
        frappe.throw(_("The delivery code doesn't match."))

    doc.delivery_confirmed = 1
    doc.delivered_on = now_datetime()
    if doc.status != "Completed":
        doc.status = "Completed"
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    # A verified handover on a COD order means the cash was collected → book the
    # payment chain so the invoice + vendor settlement post (idempotent).
    if doc.payment_status != "Paid" and (doc.payment_method or "").strip().lower() in ("cod", "cash on delivery"):
        try:
            from ovira_marketplace.api.payment import record_payment

            record_payment(doc.name)
        except Exception:
            frappe.log_error(title="Ovira: COD booking on OTP delivery failed")
    frappe.db.commit()
    return {"confirmed": True, "status": "Completed"}


@frappe.whitelist()
def resend_delivery_otp(order):
    """Operator: (re)issue the delivery code and push it to the buyer's channels.
    Handy when the order was already shipped before this feature, or the buyer
    didn't receive it."""
    _require_operator()
    doc = frappe.get_doc("Marketplace Order", order)
    if doc.delivery_confirmed:
        frappe.throw(_("This delivery is already confirmed."))
    otp = doc.delivery_otp
    if not otp:
        otp = new_delivery_otp()
        doc.db_set("delivery_otp", otp, update_modified=False)
    dispatch_delivery_otp(doc, otp)
    frappe.db.commit()
    return {"sent": True}

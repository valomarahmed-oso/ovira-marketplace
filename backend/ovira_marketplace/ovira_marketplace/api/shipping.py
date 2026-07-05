import secrets

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import flt, now_datetime

from ovira_marketplace.api.admin import OPERATOR_ROLES, _require_operator
from ovira_marketplace.shipping.connectors import default_provider, get_shipping_connector

FREE_SHIPPING_THRESHOLD = 500
FLAT_SHIPPING = 50


@frappe.whitelist(allow_guest=True)
def get_rate(subtotal, governorate=None):
    """Shipping fee for a subtotal, from the default provider (with a safe fallback)."""
    provider = default_provider()
    connector = get_shipping_connector(provider) if provider else None
    if not connector:
        return 0 if flt(subtotal) >= FREE_SHIPPING_THRESHOLD else FLAT_SHIPPING
    return connector.rate(flt(subtotal), governorate)


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
    frappe.db.commit()
    return _shipment_flat(doc)


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
    frappe.db.commit()
    return {"confirmed": True}


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

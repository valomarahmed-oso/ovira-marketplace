"""Buyer-facing order endpoints for the storefront account area.

Orders are scoped to the signed-in user: we match the Marketplace Order's email
to their login, and also any ERPNext Customer their login is a portal user of.
"""

import hmac
import re

import frappe
from frappe import _
from frappe.utils import cint

ORDER_LIST_FIELDS = [
    "name",
    "status",
    "payment_status",
    "payment_method",
    "currency",
    "subtotal",
    "shipping_amount",
    "total",
    "creation",
]


def _session_email():
    user = frappe.session.user
    if not user or user == "Guest":
        return None
    return frappe.db.get_value("User", user, "email") or user


def _my_customers(email):
    """ERPNext Customers this login is a portal user of (best-effort)."""
    try:
        rows = frappe.get_all(
            "Portal User",
            filters={"user": email, "parenttype": "Customer"},
            fields=["parent"],
            ignore_permissions=True,
        )
        return [r["parent"] for r in rows]
    except Exception:
        return []


def _order_or_filters(email):
    or_filters = [["email", "=", email]]
    customers = _my_customers(email)
    if customers:
        or_filters.append(["customer", "in", customers])
    return or_filters


@frappe.whitelist()
def my_orders(limit=50):
    """The signed-in buyer's own marketplace orders, newest first."""
    email = _session_email()
    if not email:
        return []
    rows = frappe.get_all(
        "Marketplace Order",
        or_filters=_order_or_filters(email),
        fields=ORDER_LIST_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 50,
        ignore_permissions=True,
    )
    _attach_item_counts(rows)
    return rows


@frappe.whitelist()
def get_order(name):
    """One order the buyer owns, with line items enriched for the detail view."""
    email = _session_email()
    if not email:
        frappe.throw(_("Please sign in to view your orders."), frappe.PermissionError)
    order = frappe.get_doc("Marketplace Order", name)
    if order.email != email and order.customer not in _my_customers(email):
        frappe.throw(_("This order isn't yours."), frappe.PermissionError)
    data = order.as_dict()
    _attach_item_images(data.get("items") or [])
    return data


# Fields safe to hand back to a public tracker — no secrets, no other buyers'
# details. `access_token`, `email`, `phone`, `customer` are fetched for the
# ownership check but deliberately NOT included here so they never leak.
TRACK_FIELDS = [
    "name",
    "status",
    "payment_status",
    "payment_method",
    "currency",
    "subtotal",
    "shipping_amount",
    "discount_amount",
    "coupon_code",
    "wallet_applied",
    "total",
    "customer_name",
    "governorate",
    "delivery_confirmed",
    "delivered_on",
    "creation",
]


def _norm_phone(value):
    """Digits only, last 10 — so 01012345678, +201012345678 and 0020-101-234-5678
    all normalise to the same core number for comparison."""
    digits = re.sub(r"\D", "", value or "")
    return digits[-10:] if len(digits) >= 10 else digits


@frappe.whitelist(allow_guest=True)
def track_order(name=None, token=None, email=None, phone=None):
    """Public order tracking for guests and signed-in shoppers alike.

    Ownership is proven by ONE of:
      * the order's access_token (handed to the shopper at checkout / in the
        confirmation link) — constant-time compared, same as payment.py;
      * the phone number used at checkout (guests have no email on file);
      * the email the order resolves to (signed-in buyers);
      * an active session that already owns the order.

    A single generic error is raised whether the order is missing or the proof
    is wrong, so the endpoint never reveals whether an order id exists.
    """
    name = (name or "").strip()
    denied = _("We couldn't find an order matching those details.")
    if not name:
        frappe.throw(denied, frappe.PermissionError)

    order = frappe.db.get_value(
        "Marketplace Order",
        name,
        TRACK_FIELDS + ["access_token", "email", "phone", "customer"],
        as_dict=True,
    )
    if not order:
        frappe.throw(denied, frappe.PermissionError)

    ok = False
    if token and order.access_token and hmac.compare_digest(str(token), str(order.access_token)):
        ok = True
    elif email and order.email and email.strip().lower() == order.email.strip().lower():
        ok = True
    elif phone and _norm_phone(phone) and _norm_phone(phone) == _norm_phone(order.phone):
        ok = True
    else:
        session_email = _session_email()
        if session_email and (
            (order.email and order.email.lower() == session_email.lower())
            or (order.customer and order.customer in _my_customers(session_email))
        ):
            ok = True
    if not ok:
        frappe.throw(denied, frappe.PermissionError)

    items = frappe.get_all(
        "Marketplace Order Item",
        filters={"parent": name},
        fields=["marketplace_product", "title", "qty", "rate", "amount"],
        order_by="idx asc",
        ignore_permissions=True,
    )
    _attach_item_images(items)

    payload = {k: order.get(k) for k in TRACK_FIELDS}
    payload["item_count"] = sum((it.get("qty") or 0) for it in items)
    payload["items"] = items
    return payload


# Statuses a buyer may still cancel from — anything before it ships.
CANCELLABLE_STATUSES = ("Pending Payment", "Paid", "Processing")


@frappe.whitelist()
def cancel_order(name):
    """Let a buyer cancel their own order while it hasn't shipped and isn't paid.
    A paid order goes through the returns/refund flow instead."""
    email = _session_email()
    if not email:
        frappe.throw(_("Please sign in to manage your orders."), frappe.PermissionError)
    order = frappe.get_doc("Marketplace Order", name)
    if order.email != email and order.customer not in _my_customers(email):
        frappe.throw(_("This order isn't yours."), frappe.PermissionError)
    if order.payment_status == "Paid":
        frappe.throw(_("الطلب مدفوع — استخدم الإرجاع بدل الإلغاء."))
    if order.status not in CANCELLABLE_STATUSES:
        frappe.throw(_("لا يمكن إلغاء هذا الطلب في حالته الحالية."))
    order.status = "Cancelled"
    order.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": order.name, "status": order.status}


@frappe.whitelist()
def reorder(name):
    """Return a buyer's past-order items that are still buyable, as {slug, qty},
    so the storefront can re-add them to the cart in one click."""
    email = _session_email()
    if not email:
        frappe.throw(_("Please sign in to manage your orders."), frappe.PermissionError)
    order = frappe.get_doc("Marketplace Order", name)
    if order.email != email and order.customer not in _my_customers(email):
        frappe.throw(_("This order isn't yours."), frappe.PermissionError)
    out = []
    for it in order.items:
        pid = it.get("marketplace_product")
        if not pid:
            continue
        p = frappe.db.get_value(
            "Marketplace Product", pid, ["slug", "published", "approval_status"], as_dict=True
        )
        if p and p.slug and p.published and p.approval_status == "Approved":
            out.append({"slug": p.slug, "qty": it.qty or 1})
    return out


# -- helpers ----------------------------------------------------------------


def _attach_item_counts(rows):
    if not rows:
        return
    ids = [r["name"] for r in rows]
    counts = {}
    for row in frappe.get_all(
        "Marketplace Order Item",
        filters={"parent": ["in", ids]},
        fields=["parent", "qty"],
        ignore_permissions=True,
    ):
        counts[row["parent"]] = counts.get(row["parent"], 0) + (row.get("qty") or 0)
    for r in rows:
        r["item_count"] = counts.get(r["name"], 0)


def _attach_item_images(items):
    product_ids = [it.get("marketplace_product") for it in items if it.get("marketplace_product")]
    if not product_ids:
        return
    images = {}
    for m in frappe.get_all(
        "Marketplace Product Media",
        filters={"parenttype": "Marketplace Product", "parent": ["in", product_ids]},
        fields=["parent", "image"],
        order_by="is_primary desc, idx asc",
        ignore_permissions=True,
    ):
        images.setdefault(m["parent"], m["image"])
    for it in items:
        it["image"] = images.get(it.get("marketplace_product"))

"""Buyer-facing order endpoints for the storefront account area.

Orders are scoped to the signed-in user: we match the Marketplace Order's email
to their login, and also any ERPNext Customer their login is a portal user of.
"""

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

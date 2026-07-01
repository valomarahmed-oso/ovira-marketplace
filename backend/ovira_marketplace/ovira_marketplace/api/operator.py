"""Operator console API — manage the whole marketplace from the branded
storefront admin (``/admin/*``), so operators never open the ERPNext Desk.

Operator-only (System Manager / Marketplace Operator). Grows one module at a
time (vendors, products, orders, CMS, categories, payouts, reports). The
operator gate is shared with :mod:`ovira_marketplace.api.admin`.
"""

import frappe
from frappe import _
from frappe.utils import cint

from ovira_marketplace.api.admin import _require_operator

# ---------------------------------------------------------------------------
# Vendors
# ---------------------------------------------------------------------------

VENDOR_STATUSES = ("Pending", "Active", "Suspended", "Draft")
VENDOR_LIST_FIELDS = [
    "name",
    "vendor_name",
    "slug",
    "status",
    "email",
    "phone",
    "user",
    "supplier",
    "customer",
    "creation",
]


@frappe.whitelist()
def list_vendors(status=None, search=None, limit=200):
    """Vendor directory for the operator, filterable by status + free text."""
    _require_operator()
    filters = {}
    if status and status not in ("All", ""):
        filters["status"] = status
    or_filters = None
    if search:
        like = f"%{search}%"
        or_filters = [["vendor_name", "like", like], ["email", "like", like]]
    return frappe.get_all(
        "Marketplace Vendor",
        filters=filters,
        or_filters=or_filters,
        fields=VENDOR_LIST_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 200,
        ignore_permissions=True,
    )


@frappe.whitelist()
def vendor_status_counts():
    """Counts per status, for the filter tabs."""
    _require_operator()
    counts = {"All": frappe.db.count("Marketplace Vendor")}
    for status in VENDOR_STATUSES:
        counts[status] = frappe.db.count("Marketplace Vendor", {"status": status})
    return counts


@frappe.whitelist()
def set_vendor_status(name, status):
    """Approve / reject / suspend / reactivate a vendor.

    Setting the status to ``Active`` triggers ``on_update`` on the vendor, which
    idempotently provisions the linked Supplier/Customer + grants the vendor role.
    """
    _require_operator()
    if status not in VENDOR_STATUSES:
        frappe.throw(_("حالة غير صالحة."))
    vendor = frappe.get_doc("Marketplace Vendor", name)
    vendor.status = status
    vendor.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": vendor.name, "status": vendor.status}


@frappe.whitelist()
def get_vendor(name):
    """Full vendor record for the operator detail view."""
    _require_operator()
    return frappe.get_doc("Marketplace Vendor", name).as_dict()


# ---------------------------------------------------------------------------
# Products (moderation)
# ---------------------------------------------------------------------------

PRODUCT_STATUSES = ("Pending", "Approved", "Rejected", "Draft")
PRODUCT_LIST_FIELDS = [
    "name",
    "title",
    "slug",
    "vendor",
    "approval_status",
    "published",
    "price",
    "currency",
    "stock_qty",
    "creation",
]


@frappe.whitelist()
def list_products(status=None, search=None, limit=200):
    """Product moderation queue, filterable by approval status + free text."""
    _require_operator()
    filters = {}
    if status and status not in ("All", ""):
        filters["approval_status"] = status
    or_filters = None
    if search:
        like = f"%{search}%"
        or_filters = [["title", "like", like], ["slug", "like", like]]
    rows = frappe.get_all(
        "Marketplace Product",
        filters=filters,
        or_filters=or_filters,
        fields=PRODUCT_LIST_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 200,
        ignore_permissions=True,
    )
    _attach_vendor_and_image(rows)
    return rows


@frappe.whitelist()
def product_status_counts():
    """Counts per approval status, for the filter tabs."""
    _require_operator()
    counts = {"All": frappe.db.count("Marketplace Product")}
    for status in PRODUCT_STATUSES:
        counts[status] = frappe.db.count("Marketplace Product", {"approval_status": status})
    return counts


@frappe.whitelist()
def set_product_status(name, status, rejection_reason=None):
    """Approve / reject a product. Approving triggers ``on_update`` →
    ``sync_to_erpnext`` (idempotently creates the Item + optional Website Item)."""
    _require_operator()
    if status not in PRODUCT_STATUSES:
        frappe.throw(_("حالة غير صالحة."))
    product = frappe.get_doc("Marketplace Product", name)
    product.approval_status = status
    if status == "Rejected" and rejection_reason:
        product.rejection_reason = rejection_reason
    product.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": product.name, "approval_status": product.approval_status}


def _attach_vendor_and_image(rows):
    """Enrich product rows with the vendor's display name + primary image."""
    if not rows:
        return
    vendor_ids = list({r["vendor"] for r in rows if r.get("vendor")})
    vendor_names = {}
    if vendor_ids:
        for v in frappe.get_all(
            "Marketplace Vendor",
            filters={"name": ["in", vendor_ids]},
            fields=["name", "vendor_name"],
            ignore_permissions=True,
        ):
            vendor_names[v["name"]] = v["vendor_name"]

    product_ids = [r["name"] for r in rows]
    images = {}
    media = frappe.get_all(
        "Marketplace Product Media",
        filters={"parenttype": "Marketplace Product", "parent": ["in", product_ids]},
        fields=["parent", "image"],
        order_by="is_primary desc, idx asc",
        ignore_permissions=True,
    )
    for m in media:
        images.setdefault(m["parent"], m["image"])

    for r in rows:
        r["vendor_name"] = vendor_names.get(r.get("vendor"))
        r["image"] = images.get(r["name"])


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

ORDER_STATUSES = ("Pending Payment", "Paid", "Processing", "Shipped", "Completed", "Cancelled")
ORDER_LIST_FIELDS = [
    "name",
    "customer_name",
    "phone",
    "status",
    "payment_status",
    "total",
    "currency",
    "creation",
]


@frappe.whitelist()
def list_orders(status=None, search=None, limit=200):
    """All marketplace orders for the operator, filterable by status + text."""
    _require_operator()
    filters = {}
    if status and status not in ("All", ""):
        filters["status"] = status
    or_filters = None
    if search:
        like = f"%{search}%"
        or_filters = [["customer_name", "like", like], ["name", "like", like]]
    rows = frappe.get_all(
        "Marketplace Order",
        filters=filters,
        or_filters=or_filters,
        fields=ORDER_LIST_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 200,
        ignore_permissions=True,
    )
    ids = [r["name"] for r in rows]
    item_counts = {}
    if ids:
        for row in frappe.get_all(
            "Marketplace Order Item",
            filters={"parent": ["in", ids]},
            fields=["parent"],
            ignore_permissions=True,
        ):
            item_counts[row["parent"]] = item_counts.get(row["parent"], 0) + 1
    for r in rows:
        r["item_count"] = item_counts.get(r["name"], 0)
    return rows


@frappe.whitelist()
def order_status_counts():
    """Counts per order status, for the filter tabs."""
    _require_operator()
    counts = {"All": frappe.db.count("Marketplace Order")}
    for status in ORDER_STATUSES:
        counts[status] = frappe.db.count("Marketplace Order", {"status": status})
    return counts


@frappe.whitelist()
def get_order(name):
    """Full order (items enriched with vendor name) for the detail view."""
    _require_operator()
    order = frappe.get_doc("Marketplace Order", name).as_dict()
    items = order.get("items") or []
    vendor_ids = list({it.get("vendor") for it in items if it.get("vendor")})
    vendor_names = {}
    if vendor_ids:
        for v in frappe.get_all(
            "Marketplace Vendor",
            filters={"name": ["in", vendor_ids]},
            fields=["name", "vendor_name"],
            ignore_permissions=True,
        ):
            vendor_names[v["name"]] = v["vendor_name"]
    for it in items:
        it["vendor_name"] = vendor_names.get(it.get("vendor"))
    return order


@frappe.whitelist()
def set_order_status(name, status):
    """Advance an order through its fulfilment lifecycle."""
    _require_operator()
    if status not in ORDER_STATUSES:
        frappe.throw(_("حالة غير صالحة."))
    order = frappe.get_doc("Marketplace Order", name)
    order.status = status
    order.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": order.name, "status": order.status}

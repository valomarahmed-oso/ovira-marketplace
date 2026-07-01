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

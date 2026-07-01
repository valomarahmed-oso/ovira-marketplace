import frappe
from frappe import _
from frappe.utils import cint

from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)


def _my_vendor():
    """The current user's vendor store name, or None."""
    return frappe.db.get_value("Marketplace Vendor", {"user": frappe.session.user}, "name")


@frappe.whitelist()
def register(vendor_name, email=None, phone=None, description=None):
    """Storefront endpoint: the logged-in user opens a vendor store.

    Creates a Marketplace Vendor, Pending by default (or Active if the
    marketplace auto-approves). Activation provisions the ERPNext records.
    """
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Please sign in to register as a vendor."), frappe.PermissionError)

    settings = get_settings()
    if settings.mode != "Multi Vendor":
        frappe.throw(
            _("Vendor registration is disabled in single-company mode."),
            frappe.PermissionError,
        )

    existing = frappe.db.get_value("Marketplace Vendor", {"user": user}, "name")
    if existing:
        frappe.throw(_("You already have a vendor store: {0}").format(existing))
    vendor = frappe.new_doc("Marketplace Vendor")
    vendor.vendor_name = vendor_name
    vendor.user = user
    vendor.email = email or frappe.db.get_value("User", user, "email")
    vendor.phone = phone
    vendor.description = description
    vendor.status = "Active" if settings.auto_approve_vendors else "Pending"
    vendor.insert(ignore_permissions=True)

    return {"name": vendor.name, "slug": vendor.slug, "status": vendor.status}


@frappe.whitelist()
def my_store():
    """Return the current user's vendor store, or None."""
    name = _my_vendor()
    return frappe.get_doc("Marketplace Vendor", name).as_dict() if name else None


VENDOR_EDITABLE_FIELDS = (
    "vendor_name",
    "description",
    "phone",
    "return_policy",
    "shipping_policy",
    "logo",
    "banner",
)


@frappe.whitelist()
def update_my_store(**kwargs):
    """Let a vendor edit their own store profile (name, policies, media)."""
    name = _my_vendor()
    if not name:
        frappe.throw(_("You don't have a vendor store."), frappe.PermissionError)
    doc = frappe.get_doc("Marketplace Vendor", name)
    for field in VENDOR_EDITABLE_FIELDS:
        if field in kwargs and kwargs[field] is not None:
            doc.set(field, kwargs[field])
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return doc.as_dict()


@frappe.whitelist()
def my_orders(limit=100):
    """Orders that contain at least one line for the current vendor.

    Each row carries the vendor's own slice (item count + subtotal), not the
    whole marketplace order total, so a vendor only ever sees their share.
    """
    vendor = _my_vendor()
    if not vendor:
        return []
    lines = frappe.get_all(
        "Marketplace Order Item",
        filters={"vendor": vendor},
        fields=["parent", "qty", "amount"],
        ignore_permissions=True,
    )
    if not lines:
        return []

    order_ids = list({ln["parent"] for ln in lines})
    orders = {
        o["name"]: o
        for o in frappe.get_all(
            "Marketplace Order",
            filters={"name": ["in", order_ids]},
            fields=["name", "customer_name", "status", "currency", "creation"],
            ignore_permissions=True,
        )
    }

    agg = {}
    for ln in lines:
        row = agg.setdefault(ln["parent"], {"item_count": 0, "vendor_total": 0.0})
        row["item_count"] += 1
        row["vendor_total"] += ln.get("amount") or 0

    result = []
    for oid, a in agg.items():
        order = orders.get(oid)
        if not order:
            continue
        result.append(
            {
                "name": oid,
                "customer_name": order.get("customer_name"),
                "status": order.get("status"),
                "currency": order.get("currency"),
                "creation": order.get("creation"),
                "item_count": a["item_count"],
                "vendor_total": a["vendor_total"],
            }
        )
    result.sort(key=lambda r: r["creation"] or "", reverse=True)
    return result[: cint(limit) or 100]

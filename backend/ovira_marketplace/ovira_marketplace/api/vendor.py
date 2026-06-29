import frappe
from frappe import _

from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)


@frappe.whitelist()
def register(vendor_name, email=None, phone=None, description=None):
    """Storefront endpoint: the logged-in user opens a vendor store.

    Creates a Marketplace Vendor, Pending by default (or Active if the
    marketplace auto-approves). Activation provisions the ERPNext records.
    """
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Please sign in to register as a vendor."), frappe.PermissionError)

    existing = frappe.db.get_value("Marketplace Vendor", {"user": user}, "name")
    if existing:
        frappe.throw(_("You already have a vendor store: {0}").format(existing))

    settings = get_settings()
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
    name = frappe.db.get_value("Marketplace Vendor", {"user": frappe.session.user}, "name")
    return frappe.get_doc("Marketplace Vendor", name).as_dict() if name else None

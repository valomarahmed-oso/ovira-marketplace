import frappe

PRIVILEGED = {"Marketplace Operator", "System Manager", "Administrator"}


def vendor_for_user(user=None):
    user = user or frappe.session.user
    return frappe.db.get_value("Marketplace Vendor", {"user": user}, "name")


def is_privileged(user=None):
    return bool(PRIVILEGED & set(frappe.get_roles(user or frappe.session.user)))


# -- Marketplace Product --------------------------------------------------

def product_query(user):
    user = user or frappe.session.user
    if is_privileged(user):
        return ""
    if "Marketplace Vendor" in frappe.get_roles(user):
        vendor = vendor_for_user(user)
        if vendor:
            return f"`tabMarketplace Product`.vendor = {frappe.db.escape(vendor)}"
        return "1=0"
    return ""


def product_has_permission(doc, user=None, permission_type=None):
    user = user or frappe.session.user
    if is_privileged(user):
        return None
    if "Marketplace Vendor" in frappe.get_roles(user):
        return doc.vendor == vendor_for_user(user)
    return None


# -- Marketplace Vendor ---------------------------------------------------

def vendor_query(user):
    user = user or frappe.session.user
    if is_privileged(user):
        return ""
    if "Marketplace Vendor" in frappe.get_roles(user):
        return f"`tabMarketplace Vendor`.user = {frappe.db.escape(user)}"
    return ""

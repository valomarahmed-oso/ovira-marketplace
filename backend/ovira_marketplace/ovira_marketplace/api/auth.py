"""Storefront authentication + identity endpoints.

The Next.js storefront is served same-origin with ERPNext (reverse proxy), so
the Frappe session cookie flows automatically. Login itself goes through the
stock ``/api/method/login`` endpoint; these helpers give the storefront a
canonical identity (roles, vendor link) and a self-service customer sign-up.
"""

import frappe
from frappe import _

from ovira_marketplace.customers import get_or_create_customer

OPERATOR_ROLES = ("System Manager", "Marketplace Operator")


@frappe.whitelist(allow_guest=True)
def me():
    """Return the current session identity for the storefront.

    Guests get ``{"authenticated": False}``. Logged-in users get their display
    name, roles, and whether they own a vendor store / are an operator — enough
    for the storefront to render the right UI and guard the vendor dashboard.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        return {"authenticated": False}

    roles = frappe.get_roles(user)
    full_name = frappe.db.get_value("User", user, "full_name") or user
    vendor = frappe.db.get_value(
        "Marketplace Vendor", {"user": user}, ["name", "slug", "status"], as_dict=True
    )

    return {
        "authenticated": True,
        "email": user,
        "name": full_name,
        "roles": roles,
        "is_operator": any(r in roles for r in OPERATOR_ROLES),
        "is_vendor": bool(vendor),
        "vendor": vendor.name if vendor else None,
        "vendor_slug": vendor.slug if vendor else None,
        "vendor_status": vendor.status if vendor else None,
    }


@frappe.whitelist(allow_guest=True)
def register_customer(full_name, email, password, phone=None):
    """Self-service buyer sign-up.

    Creates a Website User + an ERPNext Customer linked to that login, so the
    new account can immediately check out and see its own orders. The storefront
    follows this with a normal ``/api/method/login`` call to open the session.
    """
    email = (email or "").strip().lower()
    full_name = (full_name or "").strip()
    if not (email and full_name and password):
        frappe.throw(_("الاسم والبريد وكلمة المرور كلها مطلوبة."))

    if frappe.db.exists("User", email):
        frappe.throw(_("هذا البريد مسجّل بالفعل. سجّل دخولك بدلاً من ذلك."))

    # Frappe enforces password policy + email format here; let it surface.
    user = frappe.new_doc("User")
    user.email = email
    user.first_name = full_name
    user.mobile_no = phone
    user.user_type = "Website User"
    user.send_welcome_email = 0
    user.new_password = password
    user.flags.ignore_permissions = True
    user.insert(ignore_permissions=True)

    # Customer role unlocks the buyer portal (own orders, addresses, invoices).
    if frappe.db.exists("Role", "Customer"):
        user.add_roles("Customer")

    # Bind an ERPNext Customer to this login (by portal-user link, not by name).
    get_or_create_customer(full_name, email=email, phone=phone)
    frappe.db.commit()
    return {"ok": True, "email": email}

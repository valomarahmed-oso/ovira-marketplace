"""Customer resolution for the storefront.

The single rule enforced here: a Customer is resolved by the *login* that owns
it (via the Customer's ``portal_users`` link), never by display name. Two people
who happen to share a name must never resolve to the same Customer record — that
would leak one shopper's orders, invoices and addresses to another.
"""

import frappe

GUEST_CUSTOMER_NAME = "عميل أوفيرا"


def customer_for_user(user):
    """Return the Customer this login is a portal user of, or ``None``."""
    if not user or user == "Guest":
        return None
    return frappe.db.get_value(
        "Portal User", {"parenttype": "Customer", "user": user}, "parent"
    )


def new_customer(full_name, phone=None):
    """Build (but do not insert) a fresh Individual Customer."""
    customer = frappe.new_doc("Customer")
    customer.customer_name = (full_name or "").strip() or GUEST_CUSTOMER_NAME
    customer.customer_type = "Individual"
    customer.customer_group = (
        frappe.db.get_value("Customer Group", {"is_group": 0}, "name") or "All Customer Groups"
    )
    customer.territory = (
        frappe.db.get_value("Territory", {"is_group": 0}, "name") or "All Territories"
    )
    if phone and customer.meta.has_field("mobile_no"):
        customer.mobile_no = phone
    return customer


def link_portal_user(customer, email):
    """Idempotently link a *registered* login to the customer's portal.

    No-op when the email isn't a real User — an unauthenticated shopper can't be
    allowed to attach their order to someone else's account just by typing an
    email.
    """
    if not email or not customer.meta.has_field("portal_users"):
        return
    if not frappe.db.exists("User", email):
        return
    if any(row.user == email for row in customer.get("portal_users", [])):
        return
    customer.append("portal_users", {"user": email})


def get_or_create_customer(full_name, email=None, phone=None):
    """Resolve the Customer for a login, creating one if needed.

    Resolution is by ``portal_users`` link only. Callers pass the *login* email
    (``frappe.session.user`` for a logged-in shopper), so the returned Customer
    always belongs to that account.
    """
    email = (email or "").strip().lower() or None

    if email:
        existing = customer_for_user(email)
        if existing:
            return existing

    customer = new_customer(full_name, phone)
    link_portal_user(customer, email)
    customer.flags.ignore_permissions = True
    customer.insert(ignore_permissions=True)
    return customer.name

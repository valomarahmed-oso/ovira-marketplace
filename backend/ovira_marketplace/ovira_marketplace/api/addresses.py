"""Buyer address book, backed by ERPNext ``Address`` linked to the buyer's
``Customer`` via a Dynamic Link. The storefront only ever sees a flat shape;
the ERPNext specifics stay here.
"""

import frappe
from frappe import _


def _session_email():
    user = frappe.session.user
    if not user or user == "Guest":
        return None
    return frappe.db.get_value("User", user, "email") or user


def _session_customer(create=False):
    """The ERPNext Customer this login is a portal user of (optionally created)."""
    email = _session_email()
    if not email:
        return None
    rows = frappe.get_all(
        "Portal User",
        filters={"user": email, "parenttype": "Customer"},
        fields=["parent"],
        ignore_permissions=True,
    )
    if rows:
        return rows[0]["parent"]
    if not create:
        return None

    full_name = frappe.db.get_value("User", frappe.session.user, "full_name") or email
    customer = frappe.new_doc("Customer")
    customer.customer_name = full_name
    customer.customer_type = "Individual"
    customer.customer_group = (
        frappe.db.get_value("Customer Group", {"is_group": 0}, "name") or "All Customer Groups"
    )
    customer.territory = (
        frappe.db.get_value("Territory", {"is_group": 0}, "name") or "All Territories"
    )
    customer.append("portal_users", {"user": email})
    customer.flags.ignore_permissions = True
    customer.insert(ignore_permissions=True)
    return customer.name


def _customer_address_names(customer):
    links = frappe.get_all(
        "Dynamic Link",
        filters={
            "link_doctype": "Customer",
            "link_name": customer,
            "parenttype": "Address",
        },
        fields=["parent"],
        ignore_permissions=True,
    )
    return [l["parent"] for l in links]


def _to_flat(addr):
    return {
        "name": addr.name,
        "full_name": addr.address_title,
        "phone": addr.phone,
        "governorate": addr.state or addr.city,
        "address": addr.address_line1,
        "is_default": bool(addr.is_shipping_address),
    }


def _default_country():
    return frappe.db.get_value("Country", "Egypt", "name") or frappe.db.get_default("country") or "Egypt"


@frappe.whitelist()
def my_addresses():
    """The signed-in buyer's saved addresses."""
    customer = _session_customer()
    if not customer:
        return []
    names = _customer_address_names(customer)
    if not names:
        return []
    return [
        _to_flat(frappe.get_doc("Address", n))
        for n in names
    ]


@frappe.whitelist()
def upsert_address(full_name, address, governorate, phone=None, name=None, is_default=0):
    """Create or update one of the buyer's addresses."""
    customer = _session_customer(create=True)
    if not customer:
        frappe.throw(_("Please sign in to save an address."), frappe.PermissionError)

    is_default = int(is_default or 0)

    if name:
        if name not in _customer_address_names(customer):
            frappe.throw(_("This address isn't yours."), frappe.PermissionError)
        doc = frappe.get_doc("Address", name)
    else:
        doc = frappe.new_doc("Address")
        doc.address_type = "Shipping"
        doc.append("links", {"link_doctype": "Customer", "link_name": customer})

    doc.address_title = full_name
    doc.address_line1 = address
    doc.city = governorate
    doc.state = governorate
    doc.country = _default_country()
    if phone is not None:
        doc.phone = phone
    if is_default:
        doc.is_shipping_address = 1
        doc.is_primary_address = 1
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)

    if is_default:
        _clear_other_defaults(customer, doc.name)

    frappe.db.commit()
    return _to_flat(doc)


@frappe.whitelist()
def delete_address(name):
    """Delete one of the buyer's addresses."""
    customer = _session_customer()
    if not customer or name not in _customer_address_names(customer):
        frappe.throw(_("This address isn't yours."), frappe.PermissionError)
    frappe.delete_doc("Address", name, ignore_permissions=True)
    frappe.db.commit()
    return {"deleted": name}


@frappe.whitelist()
def set_default_address(name):
    """Mark one address the buyer's default shipping address."""
    customer = _session_customer()
    if not customer or name not in _customer_address_names(customer):
        frappe.throw(_("This address isn't yours."), frappe.PermissionError)
    frappe.db.set_value("Address", name, {"is_shipping_address": 1, "is_primary_address": 1})
    _clear_other_defaults(customer, name)
    frappe.db.commit()
    return {"ok": True}


def _clear_other_defaults(customer, keep):
    for other in _customer_address_names(customer):
        if other != keep:
            frappe.db.set_value(
                "Address", other, {"is_shipping_address": 0, "is_primary_address": 0}
            )

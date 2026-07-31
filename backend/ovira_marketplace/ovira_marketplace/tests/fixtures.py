"""Shared setup for the integration suite.

Deliberately small. A fixture layer that builds a whole marketplace for every
test is a fixture layer nobody maintains, and the tests it produces fail for
reasons that have nothing to do with the thing under test. Each helper here
creates the ONE record it names and returns it.
"""

import frappe
from frappe.utils import flt


def settings(**overrides):
    """Marketplace Settings, with the given fields forced for this test.

    Written straight to the Singles row and the cache cleared, because
    `get_settings` reads through `get_cached_doc` and a stale cache is the
    difference between a passing test and a meaningless one.
    """
    for field, value in overrides.items():
        frappe.db.set_single_value("Marketplace Settings", field, value)
    frappe.clear_cache(doctype="Marketplace Settings")
    return frappe.get_cached_doc("Marketplace Settings")


def company():
    """A company to book against — whatever this site actually has."""
    existing = frappe.db.get_value("Marketplace Settings", None, "operator_company")
    if existing and frappe.db.exists("Company", existing):
        return existing
    return frappe.db.get_value("Company", {}, "name")


def vendor(name="Test Seller", status="Active"):
    existing = frappe.db.get_value("Marketplace Vendor", {"vendor_name": name}, "name")
    if existing:
        frappe.db.set_value("Marketplace Vendor", existing, "status", status)
        return frappe.get_doc("Marketplace Vendor", existing)
    doc = frappe.new_doc("Marketplace Vendor")
    doc.vendor_name = name
    doc.status = status
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    return doc


def product(title="Test Product", price=100, stock=10, vendor_name=None, **fields):
    doc = frappe.new_doc("Marketplace Product")
    doc.title = title
    doc.price = price
    doc.stock_qty = stock
    doc.vendor = vendor_name or vendor().name
    doc.approval_status = "Approved"
    doc.published = 1
    # Off by default: a test that isn't about ERPNext stock should not be
    # creating Stock Reconciliations as a side effect.
    doc.track_inventory = fields.pop("track_inventory", 0)
    for field, value in fields.items():
        setattr(doc, field, value)
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    return doc


def buyer(email="buyer@ovira.test", full_name="Test Buyer"):
    """A registered shopper, created the way the storefront creates one."""
    if frappe.db.exists("User", email):
        return frappe.get_doc("User", email)
    from ovira_marketplace.api.auth import register_customer

    register_customer(full_name=full_name, email=email, password="Ovira!test1234", lang="ar")
    return frappe.get_doc("User", email)


def as_user(email):
    """Run the rest of the test as this login. Callers restore in tearDown."""
    frappe.set_user(email)


def cart(*products, qty=1):
    return [{"slug": p.slug, "qty": qty} for p in products]


def customer_info(name="Test Buyer", **overrides):
    info = {
        "name": name,
        "phone": "01000000000",
        "email": overrides.pop("email", "buyer@ovira.test"),
        "gov": "القاهرة",
        "address": "1 Test Street",
    }
    info.update(overrides)
    return info


def stock_of(product_name):
    return flt(frappe.db.get_value("Marketplace Product", product_name, "stock_qty"))

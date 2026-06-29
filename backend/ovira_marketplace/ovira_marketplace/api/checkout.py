import json

import frappe
from frappe import _
from frappe.utils import flt

from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)

FREE_SHIPPING_THRESHOLD = 500
FLAT_SHIPPING = 50


@frappe.whitelist(allow_guest=True)
def place_order(items, customer, payment_method="cod"):
    """Create a Marketplace Order from the storefront cart and split it into
    per-vendor ERPNext Sales Orders.

    `items`: [{"slug": "...", "qty": 1}, ...]
    `customer`: {"name", "phone", "email", "gov", "address"}
    """
    items = _loads(items)
    customer = _loads(customer)
    if not items:
        frappe.throw(_("Your cart is empty."))

    settings = get_settings()
    order = frappe.new_doc("Marketplace Order")
    order.customer = _ensure_customer(customer)
    order.customer_name = customer.get("name")
    order.phone = customer.get("phone")
    order.email = customer.get("email")
    order.governorate = customer.get("gov")
    order.shipping_address = customer.get("address")
    order.payment_method = payment_method
    order.status = "Pending Payment"
    order.payment_status = "Unpaid"
    order.currency = settings.default_currency

    subtotal = 0.0
    for line in items:
        product = frappe.db.get_value(
            "Marketplace Product",
            {"slug": line.get("slug"), "approval_status": "Approved", "published": 1},
            ["name", "vendor", "price", "title"],
            as_dict=True,
        )
        if not product:
            continue
        qty = int(line.get("qty") or 1)
        amount = flt(product.price) * qty
        subtotal += amount
        order.append(
            "items",
            {
                "marketplace_product": product.name,
                "title": product.title,
                "vendor": product.vendor,
                "qty": qty,
                "rate": product.price,
                "amount": amount,
            },
        )

    if not order.get("items"):
        frappe.throw(_("None of the cart items are available."))

    order.subtotal = subtotal
    order.shipping_amount = 0 if subtotal >= FREE_SHIPPING_THRESHOLD else FLAT_SHIPPING
    order.total = subtotal + order.shipping_amount

    order.insert(ignore_permissions=True)
    order.create_vendor_orders()
    frappe.db.commit()

    return {"name": order.name, "total": order.total, "status": order.status}


def _ensure_customer(info):
    name = (info.get("name") or "عميل أوفيرا").strip()
    existing = frappe.db.get_value("Customer", {"customer_name": name}, "name")
    if existing:
        return existing
    customer = frappe.new_doc("Customer")
    customer.customer_name = name
    customer.customer_type = "Individual"
    customer.customer_group = (
        frappe.db.get_value("Customer Group", {"is_group": 0}, "name") or "All Customer Groups"
    )
    customer.territory = (
        frappe.db.get_value("Territory", {"is_group": 0}, "name") or "All Territories"
    )
    customer.insert(ignore_permissions=True)
    return customer.name


def _loads(value):
    return json.loads(value) if isinstance(value, str) else value

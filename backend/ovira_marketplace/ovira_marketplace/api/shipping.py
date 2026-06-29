import frappe
from frappe import _
from frappe.utils import flt

from ovira_marketplace.shipping.connectors import default_provider, get_shipping_connector

FREE_SHIPPING_THRESHOLD = 500
FLAT_SHIPPING = 50


@frappe.whitelist(allow_guest=True)
def get_rate(subtotal, governorate=None):
    """Shipping fee for a subtotal, from the default provider (with a safe fallback)."""
    provider = default_provider()
    connector = get_shipping_connector(provider) if provider else None
    if not connector:
        return 0 if flt(subtotal) >= FREE_SHIPPING_THRESHOLD else FLAT_SHIPPING
    return connector.rate(flt(subtotal), governorate)


@frappe.whitelist()
def create_shipments_for_order(order, provider=None):
    """Create and book one Shipment per vendor sub-order of a Marketplace Order."""
    order_doc = frappe.get_doc("Marketplace Order", order)
    provider = provider or default_provider()
    if not provider:
        frappe.throw(_("No shipping provider is enabled."))

    created = []
    seen = set()
    for row in order_doc.items:
        if not row.sales_order or row.sales_order in seen:
            continue
        seen.add(row.sales_order)
        shipment = frappe.new_doc("Marketplace Shipment")
        shipment.marketplace_order = order_doc.name
        shipment.vendor = row.vendor
        shipment.sales_order = row.sales_order
        shipment.provider = provider
        shipment.recipient_name = order_doc.customer_name
        shipment.recipient_phone = order_doc.phone
        shipment.governorate = order_doc.governorate
        shipment.address = order_doc.shipping_address
        shipment.shipping_cost = order_doc.shipping_amount
        shipment.insert(ignore_permissions=True)
        shipment.book()
        created.append(shipment.name)

    return {"shipments": created}


@frappe.whitelist()
def track(shipment):
    """Refresh and return a shipment's tracking timeline."""
    doc = frappe.get_doc("Marketplace Shipment", shipment)
    doc.refresh_tracking()
    return {"status": doc.status, "events": [e.as_dict() for e in doc.events]}

import frappe
from frappe.utils import nowdate

from ovira_marketplace.payments.connectors import get_connector


@frappe.whitelist(allow_guest=True)
def create_payment(order, return_url=None):
    """Start payment for a Marketplace Order. Returns a redirect_url for hosted
    gateways, or a `cod`/`manual` method when no redirect is needed."""
    order_doc = frappe.get_doc("Marketplace Order", order)
    provider = _provider_for(order_doc)
    order_doc.db_set("payment_method", provider)

    if provider == "Cash on Delivery":
        return {"method": "cod", "redirect_url": return_url}

    connector = get_connector(provider)
    if not connector:
        return {"method": "manual", "redirect_url": return_url}
    return connector.initiate(order_doc, return_url)


def _provider_for(order):
    if (order.payment_method or "").lower() in ("cod", "cash on delivery"):
        return "Cash on Delivery"
    provider = frappe.db.get_value(
        "Payment Connector", {"enabled": 1, "provider": ["!=", "Cash on Delivery"]}, "provider"
    )
    return provider or "Cash on Delivery"


@frappe.whitelist(allow_guest=True)
def paymob_callback(**kwargs):
    """Paymob response/processed callback. Verifies, captures, and redirects the
    shopper to the order result page. Configure this URL in the Paymob dashboard:
    /api/method/ovira_marketplace.api.payment.paymob_callback
    """
    connector = get_connector("Paymob")
    order = kwargs.get("merchant_order_id")
    success = False

    if connector:
        result = connector.handle_callback(kwargs)
        order = result.get("order") or order
        success = result.get("success")
        if success and order:
            record_payment(order, reference=result.get("reference"), connector="Paymob")

    target = f"/checkout/success?order={order or ''}"
    if not success:
        target += "&status=failed"
    frappe.local.response["type"] = "redirect"
    frappe.local.response["location"] = target


def record_payment(order_name, reference=None, connector=None):
    """Mark an order paid and book a Payment Entry against each vendor Sales Order."""
    order = frappe.get_doc("Marketplace Order", order_name)
    if order.payment_status == "Paid":
        return
    order.db_set("payment_status", "Paid")
    order.db_set("status", "Processing")
    if reference:
        order.db_set("payment_reference", reference)
    _create_payment_entries(order, reference)
    frappe.db.commit()


def _create_payment_entries(order, reference):
    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

    booked = set()
    for row in order.items:
        if not row.sales_order or row.sales_order in booked:
            continue
        booked.add(row.sales_order)
        try:
            entry = get_payment_entry("Sales Order", row.sales_order)
            if reference:
                entry.reference_no = reference
                entry.reference_date = nowdate()
            entry.flags.ignore_permissions = True
            entry.insert()
            entry.submit()
        except Exception:
            frappe.log_error(title="Ovira: payment entry failed", message=frappe.get_traceback())

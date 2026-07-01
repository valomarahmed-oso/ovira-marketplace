import hmac

import frappe
from frappe import _
from frappe.utils import nowdate

from ovira_marketplace.customers import customer_for_user
from ovira_marketplace.marketplace_payments.connectors import get_connector

OPERATOR_ROLES = {"System Manager", "Marketplace Operator", "Administrator"}


@frappe.whitelist(allow_guest=True)
def create_payment(order, token=None, return_url=None):
    """Start payment for a Marketplace Order. Returns a redirect_url for hosted
    gateways, or a `cod`/`manual` method when no redirect is needed.

    The caller must be authorized for this order (operator, the logged-in owner,
    or a holder of the order's access token) — otherwise a guessed order id must
    not be enough to touch it.
    """
    order_doc = frappe.get_doc("Marketplace Order", order)
    _authorize_order(order_doc, token)

    if order_doc.payment_status == "Paid":
        # Nothing to collect; don't re-initiate or flip the method on a paid order.
        return {"method": "paid", "redirect_url": return_url}

    provider = _provider_for(order_doc)
    order_doc.db_set("payment_method", provider)

    if provider == "Cash on Delivery":
        return {"method": "cod", "redirect_url": return_url}

    connector = get_connector(provider)
    if not connector:
        return {"method": "manual", "redirect_url": return_url}
    return connector.initiate(order_doc, return_url)


def _authorize_order(order, token):
    """Guard access to a specific order for a storefront (possibly guest) caller."""
    user = frappe.session.user

    if user and user != "Guest" and (OPERATOR_ROLES & set(frappe.get_roles(user))):
        return

    # The order's own capability token (handed to the shopper at checkout).
    if token and order.access_token and hmac.compare_digest(str(token), order.access_token):
        return

    # A logged-in buyer may pay for an order that resolves to their own account.
    if user and user != "Guest" and order.customer and customer_for_user(user) == order.customer:
        return

    frappe.throw(_("You are not allowed to pay for this order."), frappe.PermissionError)


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
    """Mark an order paid, then invoice each vendor Sales Order and book a
    customer Payment Entry against the resulting Sales Invoice."""
    order = frappe.get_doc("Marketplace Order", order_name)
    if order.payment_status == "Paid":
        return
    order.db_set("payment_status", "Paid")
    order.db_set("status", "Processing")
    if reference:
        order.db_set("payment_reference", reference)
    _invoice_and_settle(order, reference)
    _settle_vendors(order)
    frappe.db.commit()


def _settle_vendors(order):
    """Book each vendor's payable (Debit COGS / Credit vendor payable).
    Best-effort: the customer payment is already captured."""
    try:
        from ovira_marketplace.vendor.settlement import settle_order

        settle_order(order)
    except Exception:
        frappe.log_error(title="Ovira: vendor settlement failed", message=frappe.get_traceback())


def _invoice_and_settle(order, reference):
    """One Sales Invoice + Payment Entry per vendor Sales Order. Best-effort:
    a payment was already captured, so log (not raise) any accounting hiccup."""
    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
    from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice

    done = set()
    for row in order.items:
        if not row.sales_order or row.sales_order in done:
            continue
        done.add(row.sales_order)
        try:
            invoice = make_sales_invoice(row.sales_order)
            invoice.flags.ignore_permissions = True
            invoice.insert()
            invoice.submit()

            payment = get_payment_entry("Sales Invoice", invoice.name)
            payment.reference_no = reference or order.name
            payment.reference_date = nowdate()
            payment.flags.ignore_permissions = True
            payment.insert()
            payment.submit()
        except Exception:
            frappe.log_error(
                title="Ovira: invoice/payment failed",
                message=f"Order {order.name}, SO {row.sales_order}\n{frappe.get_traceback()}",
            )

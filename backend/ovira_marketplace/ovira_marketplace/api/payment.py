import hmac

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import flt, nowdate

from ovira_marketplace.customers import customer_for_user
from ovira_marketplace.marketplace_payments.connectors import get_connector

OPERATOR_ROLES = {"System Manager", "Marketplace Operator", "Administrator"}


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=30, seconds=60 * 60, methods="POST")
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
    """Mark an order paid, then book its accounting (invoices, customer Payment
    Entry, vendor settlement). The capture and the booking are decoupled: if the
    booking fails the payment still stands and the order is flagged for retry."""
    order = frappe.get_doc("Marketplace Order", order_name)
    if order.payment_status == "Paid" and order.get("accounting_status") == "Booked":
        return  # fully done already
    if order.payment_status != "Paid":
        order.db_set("payment_status", "Paid")
        order.db_set("status", "Processing")
        if reference:
            order.db_set("payment_reference", reference)
    book_order_accounting(order, reference or order.payment_reference)
    frappe.db.commit()


def book_order_accounting(order, reference=None):
    """Invoice each vendor Sales Order, book the customer Payment Entry and the
    vendor settlement, then record the outcome on the order.

    Idempotent and safe to re-run: it skips Sales Orders already invoiced and
    invoices already paid, so a retry after a partial failure never double-books.
    A failure after the customer was charged is surfaced (``accounting_status =
    Failed`` + ``accounting_error`` + an Error Log) instead of being lost."""
    if isinstance(order, str):
        order = frappe.get_doc("Marketplace Order", order)

    errors = []
    _invoice_and_pay(order, reference, errors)
    _settle_vendors(order, errors)

    if errors:
        order.db_set("accounting_status", "Failed")
        order.db_set("accounting_error", ("\n".join(errors))[:2000])
        frappe.log_error(
            title="Ovira: order accounting incomplete",
            message=f"Order {order.name}\n" + "\n".join(errors),
        )
    else:
        order.db_set("accounting_status", "Booked")
        order.db_set("accounting_error", None)
    return not errors


def _invoice_and_pay(order, reference, errors):
    """One Sales Invoice + customer Payment Entry per vendor Sales Order."""
    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
    from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice

    done = set()
    for row in order.items:
        so_name = row.sales_order
        if not so_name or so_name in done:
            continue
        done.add(so_name)
        try:
            invoice = _existing_invoice(so_name)
            if not invoice:
                invoice = make_sales_invoice(so_name)
                invoice.flags.ignore_permissions = True
                invoice.insert()
                invoice.submit()
            _ensure_invoice_paid(get_payment_entry, invoice, reference or order.name)
        except Exception:
            errors.append(f"SO {so_name}: {_last_error_line()}")
            frappe.log_error(
                title="Ovira: invoice/payment failed",
                message=f"Order {order.name}, SO {so_name}\n{frappe.get_traceback()}",
            )


def _existing_invoice(so_name):
    """A submitted Sales Invoice already billed against this Sales Order, if any."""
    name = frappe.db.get_value(
        "Sales Invoice Item", {"sales_order": so_name, "docstatus": 1}, "parent"
    )
    return frappe.get_doc("Sales Invoice", name) if name else None


def _ensure_invoice_paid(get_payment_entry, invoice, reference):
    """Book a customer Payment Entry against the invoice unless it's already paid."""
    if flt(invoice.outstanding_amount) <= 0:
        return
    if frappe.db.exists(
        "Payment Entry Reference",
        {"reference_doctype": "Sales Invoice", "reference_name": invoice.name, "docstatus": 1},
    ):
        return
    payment = get_payment_entry("Sales Invoice", invoice.name)
    payment.reference_no = reference
    payment.reference_date = nowdate()
    payment.flags.ignore_permissions = True
    payment.insert()
    payment.submit()


def _settle_vendors(order, errors):
    """Book each vendor's payable (idempotent via settle_order)."""
    try:
        from ovira_marketplace.vendor.settlement import settle_order

        settle_order(order)
    except Exception:
        errors.append(f"settlement: {_last_error_line()}")
        frappe.log_error(title="Ovira: vendor settlement failed", message=frappe.get_traceback())


def _last_error_line():
    return (frappe.get_traceback().strip().splitlines() or [""])[-1][:200]

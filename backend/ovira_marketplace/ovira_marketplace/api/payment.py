import hmac

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint, flt, nowdate

from ovira_marketplace.customers import customer_for_user
from ovira_marketplace.marketplace_payments.connectors import get_connector

OPERATOR_ROLES = {"System Manager", "Marketplace Operator", "Administrator"}


def _require_operator():
    if not (OPERATOR_ROLES & set(frappe.get_roles(frappe.session.user))):
        frappe.throw(_("You are not allowed to do this."), frappe.PermissionError)


# -- dynamic payment methods (portal-managed manual/offline options) ---------
# The operator maintains extra manual methods (bank transfer, InstaPay, Vodafone
# Cash, extra COD variants…) from the portal — no code. Real online gateways
# (Paymob/Fawry) stay as coded Payment Connectors. A Manual Transfer order is
# created Pending Payment and the operator confirms it once the money lands.

PAYMENT_METHOD_FIELDS = [
    "name",
    "method_name",
    "method_name_en",
    "kind",
    "instructions",
    "instructions_en",
    "account_details",
    "icon",
    "display_order",
    "enabled",
]


@frappe.whitelist(allow_guest=True)
def list_payment_methods():
    """Enabled manual payment methods for the checkout (public)."""
    return frappe.get_all(
        "Marketplace Payment Method",
        filters={"enabled": 1},
        fields=[
            "name",
            "method_name",
            "method_name_en",
            "kind",
            "instructions",
            "instructions_en",
            "account_details",
            "icon",
        ],
        order_by="display_order asc, method_name asc",
        ignore_permissions=True,
    )


@frappe.whitelist()
def list_payment_methods_admin():
    """Operator: every manual payment method (enabled or not)."""
    _require_operator()
    return frappe.get_all(
        "Marketplace Payment Method",
        fields=PAYMENT_METHOD_FIELDS,
        order_by="display_order asc, method_name asc",
        ignore_permissions=True,
    )


@frappe.whitelist()
def upsert_payment_method(
    method_name, method_name_en=None, kind="Manual Transfer", instructions=None,
    instructions_en=None, account_details=None, icon=None, display_order=0, enabled=1, name=None,
):
    """Operator: create or update a manual payment method (keyed by method_name)."""
    _require_operator()
    method_name = (method_name or "").strip()
    if not method_name:
        frappe.throw(_("Enter a payment method name."))
    if kind not in ("Cash on Delivery", "Manual Transfer"):
        kind = "Manual Transfer"

    existing = name or frappe.db.get_value("Marketplace Payment Method", {"method_name": method_name})
    doc = (
        frappe.get_doc("Marketplace Payment Method", existing)
        if existing and frappe.db.exists("Marketplace Payment Method", existing)
        else frappe.new_doc("Marketplace Payment Method")
    )
    doc.method_name = method_name
    doc.method_name_en = (method_name_en or "").strip() or None
    doc.kind = kind
    doc.instructions = (instructions or "").strip() or None
    doc.instructions_en = (instructions_en or "").strip() or None
    doc.account_details = (account_details or "").strip() or None
    doc.icon = (icon or "").strip() or None
    doc.display_order = cint(display_order)
    doc.enabled = 1 if cint(enabled) else 0
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {f: doc.get(f) for f in PAYMENT_METHOD_FIELDS}


@frappe.whitelist()
def delete_payment_method(name):
    _require_operator()
    if frappe.db.exists("Marketplace Payment Method", name):
        frappe.delete_doc("Marketplace Payment Method", name, ignore_permissions=True)
        frappe.db.commit()
    return {"deleted": name}


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

    # A manual/offline method (bank transfer, wallet, etc.) collects nothing
    # online — the order stays Pending Payment until the operator confirms it.
    if (order_doc.payment_method or "").strip().lower() == "manual":
        return {"method": "manual", "redirect_url": return_url}

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

    # Coupon discount AND store credit spent are both operator-funded: spread
    # them across the freshly-made vendor invoices so booked revenue + cash
    # collected drop by the total, while vendor settlement (from SO net_total)
    # stays whole. Zero of both ⇒ the original path runs unchanged.
    discount_remaining = flt(order.get("discount_amount")) + flt(order.get("wallet_applied"))
    if discount_remaining > 0:
        # Retry safety: don't re-apply a discount already booked on an invoice
        # from an earlier (partially failed) run — only the shortfall is left.
        discount_remaining = _remaining_discount(order, discount_remaining)

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
                if discount_remaining > 0:
                    discount_remaining = _apply_invoice_discount(invoice, discount_remaining)
                invoice.insert()
                invoice.submit()
            _ensure_invoice_paid(get_payment_entry, invoice, reference or order.name)
        except Exception:
            errors.append(f"SO {so_name}: {_last_error_line()}")
            frappe.log_error(
                title="Ovira: invoice/payment failed",
                message=f"Order {order.name}, SO {so_name}\n{frappe.get_traceback()}",
            )


def _remaining_discount(order, discount_total):
    """Order discount minus what's already booked on this order's existing
    invoices, so a retry after a partial failure never double-discounts."""
    already = 0.0
    seen = set()
    for row in order.items:
        so_name = row.sales_order
        if not so_name or so_name in seen:
            continue
        seen.add(so_name)
        invoice = _existing_invoice(so_name)
        if invoice:
            already += flt(invoice.discount_amount)
    return max(0.0, discount_total - already)


def _apply_invoice_discount(invoice, discount_remaining):
    """Put as much of a remaining order discount as fits onto one (unsaved)
    Sales Invoice, as a grand-total discount. Returns the leftover discount."""
    invoice.run_method("calculate_taxes_and_totals")
    grand_total = flt(invoice.grand_total)
    take = min(discount_remaining, grand_total)
    if take > 0:
        invoice.apply_discount_on = "Grand Total"
        invoice.discount_amount = take
    return discount_remaining - take


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


# -- refunds to the original payment method ---------------------------------


@frappe.whitelist()
def refund_capability(order_name):
    """Whether this order's payment can be refunded to its original instrument.

    Drives the operator UI: COD and manual transfers have no gateway to call
    back, so those refunds can only ever be store credit.
    """
    from ovira_marketplace.api.admin import _require_operator

    _require_operator()
    order = frappe.db.get_value(
        "Marketplace Order",
        order_name,
        ["name", "payment_method", "payment_status", "payment_reference", "total"],
        as_dict=True,
    )
    if not order:
        frappe.throw(_("الطلب غير موجود."), frappe.DoesNotExistError)

    connector = get_connector(order.payment_method) if order.payment_method else None
    supported = bool(connector and getattr(connector, "supports_refund", False))
    return {
        "supported": supported,
        "provider": order.payment_method,
        "paid": order.payment_status == "Paid",
        "has_reference": bool(order.payment_reference),
        "amount": flt(order.total),
    }


@frappe.whitelist()
@rate_limit(limit=20, seconds=60 * 60, methods="POST")
def refund_to_source(return_name, amount=None):
    """Send a refund back to the card/wallet the customer actually paid with.

    Operator-only. The gateway call is the ONLY thing here that can fail
    "loudly": if it succeeds we record the reference on the return, and if it
    fails we report why and change nothing, so the operator can fall back to
    store credit. The vendor chargeback is deliberately NOT repeated here — it
    is booked once when the return completes, whichever way the money went out.
    """
    from ovira_marketplace.api.admin import _require_operator

    _require_operator()
    ret = frappe.get_doc("Marketplace Return", return_name)
    if ret.get("refund_reference"):
        return {"ok": True, "already": True, "reference": ret.refund_reference}

    order = frappe.db.get_value(
        "Marketplace Order",
        ret.marketplace_order,
        ["name", "payment_method", "payment_status", "payment_reference"],
        as_dict=True,
    )
    if not order:
        frappe.throw(_("الطلب غير موجود."), frappe.DoesNotExistError)
    if order.payment_status != "Paid":
        frappe.throw(_("الطلب غير مدفوع — مفيش حاجة تترد."))

    connector = get_connector(order.payment_method) if order.payment_method else None
    if not (connector and getattr(connector, "supports_refund", False)):
        frappe.throw(
            _("وسيلة الدفع ({0}) لا تدعم الاسترداد الآلي — استخدم رصيد المتجر.").format(
                order.payment_method or "—"
            )
        )

    value = flt(amount) if amount is not None else flt(ret.refund_amount)
    if value <= 0:
        frappe.throw(_("حدّد مبلغ الاسترداد."))

    result = connector.refund(order.payment_reference, value)
    if not result.get("ok"):
        frappe.throw(
            _("فشل الاسترداد من بوابة الدفع: {0}").format(result.get("error") or "—")
        )

    frappe.db.set_value(
        "Marketplace Return",
        return_name,
        {"refund_reference": result.get("reference") or "", "refund_method": "Original payment method"},
        update_modified=False,
    )
    frappe.db.commit()
    return {"ok": True, "reference": result.get("reference"), "amount": value}

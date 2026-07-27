"""Buyer return requests (RMA).

A buyer opens a return against a delivered order; the operator approves,
rejects, or completes it. Completing a return refunds the buyer's wallet and
reverses the sale in ERPNext — a Credit Note against each vendor invoice and a
return Delivery Note that restores any tracked stock (see `_post_return_reversal`).

When the return is the **vendor's** fault, the refund is also charged back to
that vendor (`vendor/chargeback.py`): their payable is debited the refunded
amount less the commission we hand back, minus an administration fee the
operator keeps. A store error or goodwill gesture is absorbed by the operator
instead — see `Marketplace Return.fault`.
"""

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import flt

from ovira_marketplace.api.admin import _require_operator
from ovira_marketplace.api.orders import _my_customers, _session_email

RETURN_REASONS = ("Damaged", "Wrong item", "Not as described", "Changed mind", "Other")

# Orders can be returned once they've reached the buyer.
RETURNABLE_ORDER_STATUSES = ("Shipped", "Completed")

# A return is still "open" (blocks a second request) until it's decided.
OPEN_RETURN_STATUSES = ("Requested", "Approved")


def _to_flat(doc):
    return {
        "name": doc.name,
        "order": doc.marketplace_order,
        "status": doc.status,
        "reason": doc.reason,
        "details": doc.details,
        "operator_note": doc.operator_note,
        "refund_amount": flt(doc.refund_amount),
        "date": frappe.utils.get_datetime(doc.creation).strftime("%Y-%m-%d"),
    }


def _owned_order(order):
    """Return the order doc if the signed-in buyer owns it, else throw."""
    email = _session_email()
    if not email:
        frappe.throw(_("Please sign in."), frappe.PermissionError)
    doc = frappe.get_doc("Marketplace Order", order)
    if doc.email != email and doc.customer not in _my_customers(email):
        frappe.throw(_("This order isn't yours."), frappe.PermissionError)
    return doc


@frappe.whitelist()
@rate_limit(limit=20, seconds=60 * 60, methods="POST")
def request_return(order, reason, details=None):
    """Open a return request against an order the buyer owns."""
    order_doc = _owned_order(order)

    if order_doc.status not in RETURNABLE_ORDER_STATUSES:
        frappe.throw(_("This order isn't eligible for a return yet."))
    if reason not in RETURN_REASONS:
        frappe.throw(_("Please choose a valid reason."))

    existing = frappe.get_all(
        "Marketplace Return",
        filters={"marketplace_order": order, "status": ["in", OPEN_RETURN_STATUSES]},
        pluck="name",
        ignore_permissions=True,
    )
    if existing:
        frappe.throw(_("There's already an open return for this order."))

    doc = frappe.new_doc("Marketplace Return")
    doc.marketplace_order = order
    doc.customer_email = order_doc.email or _session_email()
    doc.reason = reason
    doc.details = (details or "").strip()
    doc.status = "Requested"
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return _to_flat(doc)


@frappe.whitelist()
def order_return(order):
    """The latest return for one of the buyer's orders (or None)."""
    _owned_order(order)
    rows = frappe.get_all(
        "Marketplace Return",
        filters={"marketplace_order": order},
        order_by="creation desc",
        limit_page_length=1,
        pluck="name",
        ignore_permissions=True,
    )
    return _to_flat(frappe.get_doc("Marketplace Return", rows[0])) if rows else None


@frappe.whitelist()
def my_returns():
    """All returns opened by the signed-in buyer."""
    email = _session_email()
    if not email:
        return []
    orders = frappe.get_all(
        "Marketplace Order",
        or_filters=[["email", "=", email]] + (
            [["customer", "in", _my_customers(email)]] if _my_customers(email) else []
        ),
        pluck="name",
        ignore_permissions=True,
    )
    if not orders:
        return []
    rows = frappe.get_all(
        "Marketplace Return",
        filters={"marketplace_order": ["in", orders]},
        order_by="creation desc",
        pluck="name",
        ignore_permissions=True,
    )
    return [_to_flat(frappe.get_doc("Marketplace Return", n)) for n in rows]


# -- operator ---------------------------------------------------------------

RETURN_STATUSES = ("Requested", "Approved", "Rejected", "Completed")


@frappe.whitelist()
def list_returns(status=None):
    """All returns for the operator queue, newest first."""
    _require_operator()
    filters = {}
    if status and status != "All":
        filters["status"] = status
    rows = frappe.get_all(
        "Marketplace Return",
        filters=filters,
        fields=[
            "name",
            "marketplace_order",
            "customer_email",
            "status",
            "reason",
            "details",
            "operator_note",
            "refund_amount",
            "fault",
            "refund_method",
            "vendor_charged",
            "commission_returned",
            "admin_fee",
            "chargeback_entry",
            "refund_reference",
            "creation",
        ],
        order_by="creation desc",
        ignore_permissions=True,
    )
    for r in rows:
        r["order"] = r.pop("marketplace_order")
        r["refund_amount"] = flt(r.get("refund_amount"))
        r["date"] = str(r.pop("creation"))[:10]
    return rows


@frappe.whitelist()
def chargeback_preview(name):
    """What charging this return back to the vendor would cost them, computed but
    not booked — so the operator sees the split before choosing a fault."""
    _require_operator()
    doc = frappe.db.get_value(
        "Marketplace Return", name,
        ["name", "marketplace_order", "refund_amount", "fault"], as_dict=True,
    )
    if not doc:
        frappe.throw(_("طلب الإرجاع غير موجود."), frappe.DoesNotExistError)
    from ovira_marketplace.vendor.chargeback import preview

    return preview(doc)


RETURN_EVENT = {
    "Approved": "return.approved",
    "Rejected": "return.rejected",
    "Completed": "return.completed",
}


def _notify_return_status(doc):
    """Announce a return decision. The engine owns channels, language, retry and
    the audit row — this only supplies the facts."""
    event = RETURN_EVENT.get(doc.status)
    if not event:
        return
    from ovira_marketplace.notifications.dispatch import emit

    order = frappe.db.get_value(
        "Marketplace Order", doc.marketplace_order,
        ["name", "phone", "email", "currency"], as_dict=True) or {}
    emit(event, {
        "order": doc.marketplace_order,
        "note": doc.operator_note or "",
        "email": doc.customer_email or order.get("email"),
        "phone": order.get("phone"),
        "currency": order.get("currency") or "",
        "kind": "order",
    }, reference={"doctype": "Marketplace Return", "name": doc.name})


def _refund_to_wallet(doc):
    """Credit the buyer's store credit with the approved refund — idempotent, so
    re-saving a completed return never double-refunds."""
    email = doc.customer_email
    if not email or not frappe.db.exists("User", email):
        return
    if frappe.db.exists(
        "Marketplace Wallet Entry",
        {"reference_doctype": "Marketplace Return", "reference_name": doc.name},
    ):
        return
    from ovira_marketplace.api.wallet import credit

    credit(
        email,
        flt(doc.refund_amount),
        reason="Refund",
        reference_doctype="Marketplace Return",
        reference_name=doc.name,
        note=_("Refund for return {0}").format(doc.name),
    )
    frappe.db.commit()


def _post_return_reversal(doc):
    """On a completed return, reverse the sale in ERPNext: a **Credit Note**
    against each vendor invoice and a **return Delivery Note** that puts any
    tracked stock back into the warehouse, plus the manual marketplace stock.
    Idempotent + best-effort per document — a booking hiccup must never block the
    operator's decision or the buyer's wallet refund."""
    order = frappe.get_doc("Marketplace Order", doc.marketplace_order)
    for so_name in {r.sales_order for r in order.items if r.sales_order}:
        try:
            _credit_note_for_so(so_name)
        except Exception:
            frappe.log_error(title="Ovira: return credit note failed")
        try:
            _return_delivery_for_so(so_name)
        except Exception:
            frappe.log_error(title="Ovira: return delivery note failed")
    # Marketplace (manual) stock — mirror of the reservation made at checkout.
    try:
        from ovira_marketplace.api.checkout import restock_order

        restock_order(order)
    except Exception:
        frappe.log_error(title="Ovira: return manual restock failed")


def _credit_note_for_so(so_name):
    """Credit Note (return Sales Invoice) reversing the customer invoice for one
    vendor Sales Order. Skips if already credited."""
    si = frappe.db.get_value("Sales Invoice Item", {"sales_order": so_name, "docstatus": 1}, "parent")
    if not si:
        return  # order not invoiced (e.g. unpaid) — nothing to reverse
    if frappe.db.exists("Sales Invoice", {"return_against": si, "is_return": 1, "docstatus": 1}):
        return
    from erpnext.accounts.doctype.sales_invoice.sales_invoice import make_sales_return

    cn = make_sales_return(si)
    cn.flags.ignore_permissions = True
    cn.insert()
    cn.submit()


def _return_delivery_for_so(so_name):
    """Return Delivery Note that adds tracked stock back to the warehouse for one
    vendor Sales Order. No-op when nothing shipped from stock (untracked items)."""
    dn = frappe.db.get_value(
        "Delivery Note Item", {"against_sales_order": so_name, "docstatus": 1}, "parent"
    )
    if not dn:
        return
    if frappe.db.exists("Delivery Note", {"return_against": dn, "is_return": 1, "docstatus": 1}):
        return
    from erpnext.stock.doctype.delivery_note.delivery_note import make_sales_return

    rdn = make_sales_return(dn)
    rdn.flags.ignore_permissions = True
    rdn.insert()
    rdn.submit()


@frappe.whitelist()
def set_return_status(name, status, note=None, refund_amount=None, fault=None):
    """Operator decision on a return.

    `fault` decides who funds the refund: "Vendor" charges it back to the seller,
    "Store"/"Goodwill" leaves the operator absorbing it. It must be settled
    before Completed, because that's when the chargeback books.
    """
    _require_operator()
    if status not in RETURN_STATUSES:
        frappe.throw(_("Unknown return status."))
    doc = frappe.get_doc("Marketplace Return", name)
    doc.status = status
    if note is not None:
        doc.operator_note = note
    if refund_amount is not None:
        doc.refund_amount = flt(refund_amount)
    if fault is not None:
        if fault not in ("Vendor", "Store", "Goodwill"):
            frappe.throw(_("قيمة غير معروفة لسبب الإرجاع."))
        doc.fault = fault
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    # A completed return with an approved refund tops up the buyer's store
    # credit (once). Guests without a login just don't get a wallet.
    if status == "Completed" and flt(doc.refund_amount) > 0:
        _refund_to_wallet(doc)
        # …and, when the return is the vendor's fault, the refund is charged back
        # to that vendor instead of the operator absorbing it. Runs AFTER the
        # buyer is made whole, and is best-effort/idempotent, so a GL problem can
        # never leave the customer un-refunded.
        from ovira_marketplace.vendor.chargeback import book_chargeback

        book_chargeback(doc)

    # A completed return also reverses the sale in ERPNext: Credit Note + return
    # Delivery Note (tracked stock back) + manual stock. Best-effort/idempotent.
    if status == "Completed":
        _post_return_reversal(doc)

    _notify_return_status(doc)

    return _to_flat(doc)

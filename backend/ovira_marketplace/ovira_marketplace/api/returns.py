"""Buyer return requests (RMA v1).

A buyer opens a return against a delivered order; the operator approves,
rejects, or completes it. v1 tracks the request/decision only — it does not
post a Credit Note or refund automatically (that comes later).
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
def set_return_status(name, status, note=None, refund_amount=None):
    """Operator decision on a return."""
    _require_operator()
    if status not in RETURN_STATUSES:
        frappe.throw(_("Unknown return status."))
    doc = frappe.get_doc("Marketplace Return", name)
    doc.status = status
    if note is not None:
        doc.operator_note = note
    if refund_amount is not None:
        doc.refund_amount = flt(refund_amount)
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return _to_flat(doc)

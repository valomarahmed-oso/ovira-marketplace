"""Who did what to whose money.

Frappe's own Version table records field changes on a document, which answers
"what changed" but not "who decided, and what did it cost". A refund completed
for 12,380 EGP, a wallet credited by hand, a vendor suspended, an order's books
rebuilt — these are decisions, and a marketplace has to be able to show the
decision, the person and the amount long after the screen that made it has moved
on. Every payment system, every bank and every serious commerce platform keeps
this; this one didn't.

Recording is **never allowed to break the action it records**. An audit row that
fails to write is a problem for the operator to see in the error log, not a
reason to abandon a refund halfway.

    audit("return.completed", "Marketplace Return", doc.name,
          amount=doc.refund_amount, before={"status": was}, after={"status": doc.status})
"""

import json

import frappe

DOCTYPE = "Marketplace Audit Log"


def audit(action, reference_doctype=None, reference_name=None, amount=None,
          before=None, after=None, note=None):
    """Record one decision. Returns the row name, or None if it couldn't be written."""
    try:
        doc = frappe.new_doc(DOCTYPE)
        doc.action = action
        doc.actor = frappe.session.user
        doc.reference_doctype = reference_doctype
        doc.reference_name = reference_name
        doc.amount = amount
        doc.before_value = _dump(before)
        doc.after_value = _dump(after)
        doc.note = (note or "")[:1000] or None
        doc.ip_address = _client_ip()
        doc.flags.ignore_permissions = True
        doc.insert(ignore_permissions=True)
        return doc.name
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Ovira: audit write failed (%s)" % action)
        return None


def _dump(value):
    if value is None:
        return None
    try:
        return json.dumps(value, ensure_ascii=False, default=str)[:4000]
    except Exception:
        return str(value)[:4000]


def _client_ip():
    try:
        return frappe.local.request_ip
    except Exception:
        return None


@frappe.whitelist()
def recent(limit=100, action=None, reference_name=None):
    """The trail, newest first — operator only."""
    from frappe.utils import cint

    from ovira_marketplace.api.admin import _require_operator

    _require_operator()
    filters = {}
    if action:
        filters["action"] = action
    if reference_name:
        filters["reference_name"] = reference_name
    return frappe.get_all(
        DOCTYPE,
        filters=filters,
        fields=["name", "action", "actor", "reference_doctype", "reference_name",
                "amount", "note", "creation"],
        order_by="creation desc",
        limit_page_length=min(cint(limit) or 100, 500),
        ignore_permissions=True,
    )

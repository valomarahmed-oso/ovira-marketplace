"""Buyer notification feed, backed by the Marketplace Notification DocType.

Notifications are created server-side (e.g. on order status changes) via
:func:`create_notification`, and read/marked by the signed-in user through the
whitelisted endpoints below.
"""

import frappe
from frappe import _
from frappe.utils import cint

NOTIFICATION_FIELDS = [
    "name",
    "kind",
    "title",
    "message",
    "is_read",
    "creation",
    "reference_doctype",
    "reference_name",
]


def _session_user():
    user = frappe.session.user
    return None if (not user or user == "Guest") else user


@frappe.whitelist()
def my_notifications(limit=50):
    """The signed-in user's notifications, newest first."""
    user = _session_user()
    if not user:
        return []
    return frappe.get_all(
        "Marketplace Notification",
        filters={"user": user},
        fields=NOTIFICATION_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 50,
        ignore_permissions=True,
    )


@frappe.whitelist()
def unread_count():
    """How many unread notifications the signed-in user has (for the bell badge)."""
    user = _session_user()
    if not user:
        return 0
    return frappe.db.count("Marketplace Notification", {"user": user, "is_read": 0})


@frappe.whitelist()
def mark_read(name):
    """Mark one of the user's notifications read."""
    user = _session_user()
    if not user:
        frappe.throw(_("Please sign in."), frappe.PermissionError)
    if frappe.db.get_value("Marketplace Notification", name, "user") != user:
        frappe.throw(_("This notification isn't yours."), frappe.PermissionError)
    frappe.db.set_value("Marketplace Notification", name, "is_read", 1)
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist()
def mark_all_read():
    """Mark every unread notification for the user as read."""
    user = _session_user()
    if not user:
        frappe.throw(_("Please sign in."), frappe.PermissionError)
    for row in frappe.get_all(
        "Marketplace Notification",
        filters={"user": user, "is_read": 0},
        pluck="name",
        ignore_permissions=True,
    ):
        frappe.db.set_value("Marketplace Notification", row, "is_read", 1)
    frappe.db.commit()
    return {"ok": True}


def create_notification(
    user,
    title,
    message=None,
    kind="system",
    reference_doctype=None,
    reference_name=None,
):
    """Server-side helper to raise a notification for a user. Safe no-op if the
    user is missing/guest. Not whitelisted — callers are trusted backend code."""
    if not user or user == "Guest":
        return None
    doc = frappe.new_doc("Marketplace Notification")
    doc.user = user
    doc.title = title
    doc.message = message
    doc.kind = kind
    doc.reference_doctype = reference_doctype
    doc.reference_name = reference_name
    doc.insert(ignore_permissions=True)
    return doc.name

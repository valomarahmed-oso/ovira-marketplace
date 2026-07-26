"""Customer support tickets — the buyer ↔ operator channel.

The existing chat in `api/messaging.py` is deliberately order-and-vendor scoped:
a buyer talks to a *seller* about one order. Nothing let a shopper reach the
store itself — about a payment, a missing delivery, an account problem, or an
order with no single vendor to blame. That's this module.

Access follows the same rule as the vendor chat: the caller's role is
re-derived from the session on every call, never taken from the request. A
customer only ever sees their own tickets; operators see the queue.

Read state is two flags per message (`read_by_customer`, `read_by_support`) —
a message is unread for the *other* side until they open the thread.
"""

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint, now_datetime

from ovira_marketplace.api.admin import OPERATOR_ROLES
from ovira_marketplace.api.notifications import create_notification

TICKET_DT = "Marketplace Support Ticket"
MSG_DT = "Marketplace Support Message"

TICKET_FIELDS = [
    "name", "subject", "category", "status", "priority",
    "customer_email", "order", "last_activity", "creation",
]

# A customer may reopen or close; only support may mark Resolved.
CUSTOMER_STATUSES = ("Open", "Closed")
OPERATOR_STATUSES = ("Open", "Awaiting customer", "Awaiting support", "Resolved", "Closed")

OPEN_STATUSES = ("Open", "Awaiting customer", "Awaiting support")

MAX_BODY = 4000


# -- identity ---------------------------------------------------------------


def _session_user():
    user = frappe.session.user
    return None if (not user or user == "Guest") else user


def _session_email():
    user = _session_user()
    if not user:
        return None
    return frappe.db.get_value("User", user, "email") or user


def _is_operator():
    user = frappe.session.user
    return user != "Guest" and any(r in frappe.get_roles(user) for r in OPERATOR_ROLES)


def _require_login():
    email = _session_email()
    if not email:
        frappe.throw(_("سجّل الدخول لفتح تذكرة دعم."), frappe.PermissionError)
    return email


def _resolve_role(ticket_name):
    """'customer' or 'support' for the caller on this ticket, or throw."""
    row = frappe.db.get_value(TICKET_DT, ticket_name, ["name", "customer_email"], as_dict=True)
    if not row:
        frappe.throw(_("التذكرة غير موجودة."), frappe.DoesNotExistError)
    email = _session_email()
    if email and row.customer_email == email:
        return "customer", row
    if _is_operator():
        return "support", row
    frappe.throw(_("هذه التذكرة ليست لك."), frappe.PermissionError)


# -- shaping ----------------------------------------------------------------


def _shape_ticket(row, unread=0):
    return {
        "name": row.get("name"),
        "subject": row.get("subject"),
        "category": row.get("category"),
        "status": row.get("status"),
        "priority": row.get("priority"),
        "order": row.get("order"),
        "customer_email": row.get("customer_email"),
        "last_activity": str(row.get("last_activity") or row.get("creation") or ""),
        "created": str(row.get("creation") or ""),
        "unread": unread,
    }


def _shape_messages(rows, role):
    return [
        {
            "id": r.name,
            "body": r.body,
            "sender_role": r.sender_role,
            "sender_name": r.sender_name,
            "mine": (r.sender_role or "").lower() == role,
            "date": str(r.creation),
        }
        for r in rows
    ]


def _unread_field(role):
    return {"customer": "read_by_customer", "support": "read_by_support"}.get(role)


def _mark_read(ticket, role):
    field = _unread_field(role)  # fixed map — never user input
    if not field:
        return
    frappe.db.sql(
        f"UPDATE `tabMarketplace Support Message` SET `{field}` = 1"
        f" WHERE ticket = %(ticket)s AND `{field}` = 0",
        {"ticket": ticket},
    )
    frappe.db.commit()


def _unread_counts(ticket_names, role):
    """{ticket: n} unread for this side, in one query."""
    if not ticket_names:
        return {}
    field = _unread_field(role)
    other = "Support" if role == "customer" else "Customer"
    rows = frappe.get_all(
        MSG_DT,
        filters={"ticket": ["in", ticket_names], field: 0, "sender_role": other},
        fields=["ticket", "count(name) as n"],
        group_by="ticket",
        ignore_permissions=True,
    )
    return {r["ticket"]: cint(r["n"]) for r in rows}


def _post(ticket, role, body):
    doc = frappe.new_doc(MSG_DT)
    doc.ticket = ticket
    doc.sender_role = "Customer" if role == "customer" else "Support"
    doc.sender = _session_user()
    doc.sender_name = _sender_label(role)
    doc.body = body
    # The sender has, by definition, read their own message.
    doc.read_by_customer = 1 if role == "customer" else 0
    doc.read_by_support = 1 if role == "support" else 0
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    return doc


def _sender_label(role):
    if role == "support":
        return _("دعم المتجر")
    return frappe.db.get_value("User", frappe.session.user, "full_name") or _("عميل")


def _clean_body(body):
    body = (body or "").strip()
    if not body:
        frappe.throw(_("اكتب رسالتك."))
    return body[:MAX_BODY]


# -- customer ---------------------------------------------------------------


@frappe.whitelist()
@rate_limit(limit=10, seconds=60 * 60, methods="POST")
def create_ticket(subject, body, category="Other", order=None):
    """Open a ticket. Rate-limited per IP so the queue can't be flooded."""
    email = _require_login()
    subject = (subject or "").strip()
    if not subject:
        frappe.throw(_("اكتب عنوانًا للتذكرة."))
    body = _clean_body(body)

    # An order reference is only accepted when it really belongs to the caller.
    if order:
        owner_email = frappe.db.get_value("Marketplace Order", order, "email")
        if owner_email != email:
            order = None

    doc = frappe.new_doc(TICKET_DT)
    doc.subject = subject[:200]
    doc.category = category if category in _categories() else "Other"
    doc.status = "Open"
    doc.customer_email = email
    doc.user = _session_user()
    doc.order = order
    doc.last_activity = now_datetime()
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)

    _post(doc.name, "customer", body)
    frappe.db.commit()
    _notify_operators(doc.name, subject)
    return {"name": doc.name}


def _categories():
    return frappe.get_meta(TICKET_DT).get_field("category").options.split("\n")


@frappe.whitelist()
def my_tickets(limit=50):
    """The signed-in shopper's own tickets, newest activity first."""
    email = _session_email()
    if not email:
        return []
    rows = frappe.get_all(
        TICKET_DT,
        filters={"customer_email": email},
        fields=TICKET_FIELDS,
        order_by="last_activity desc, creation desc",
        limit_page_length=cint(limit) or 50,
        ignore_permissions=True,
    )
    unread = _unread_counts([r["name"] for r in rows], "customer")
    return [_shape_ticket(r, unread.get(r["name"], 0)) for r in rows]


@frappe.whitelist()
def ticket(name):
    """One thread. Marks it read for whichever side is asking."""
    role, row = _resolve_role(name)
    full = frappe.db.get_value(TICKET_DT, name, TICKET_FIELDS, as_dict=True)
    msgs = frappe.get_all(
        MSG_DT,
        filters={"ticket": name},
        fields=["name", "body", "sender_role", "sender_name", "creation"],
        order_by="creation asc",
        limit_page_length=500,
        ignore_permissions=True,
    )
    _mark_read(name, role)
    return {
        "role": role,
        "ticket": _shape_ticket(full),
        "messages": _shape_messages(msgs, role),
        "can_close": full.status in OPEN_STATUSES,
    }


@frappe.whitelist()
@rate_limit(limit=60, seconds=60 * 10, methods="POST")
def reply(name, body):
    """Add a message. Either side; the status follows who spoke last."""
    role, _row = _resolve_role(name)
    body = _clean_body(body)
    doc = _post(name, role, body)

    # A reply reopens a resolved ticket — the customer clearly isn't done.
    current = frappe.db.get_value(TICKET_DT, name, "status")
    nxt = "Awaiting support" if role == "customer" else "Awaiting customer"
    if current == "Closed" and role == "customer":
        nxt = "Open"
    frappe.db.set_value(TICKET_DT, name, {"status": nxt, "last_activity": now_datetime()})
    frappe.db.commit()

    _notify_counterpart(name, role, body)
    return {
        "id": doc.name,
        "body": doc.body,
        "sender_role": doc.sender_role,
        "sender_name": doc.sender_name,
        "mine": True,
        "date": str(doc.creation),
    }


@frappe.whitelist()
def set_status(name, status):
    """Close/reopen. A customer may only Open or Close their own ticket;
    'Resolved' is support's call, so the two sides can't overwrite each other."""
    role, _row = _resolve_role(name)
    allowed = OPERATOR_STATUSES if role == "support" else CUSTOMER_STATUSES
    if status not in allowed:
        frappe.throw(_("حالة غير مسموح بها."), frappe.PermissionError)

    update = {"status": status, "last_activity": now_datetime()}
    update["closed_on"] = now_datetime() if status in ("Closed", "Resolved") else None
    frappe.db.set_value(TICKET_DT, name, update)
    frappe.db.commit()
    return {"name": name, "status": status}


@frappe.whitelist()
def unread_total():
    """Badge count for the signed-in user, across whichever role(s) they hold."""
    total = 0
    email = _session_email()
    if email:
        mine = frappe.get_all(
            TICKET_DT, filters={"customer_email": email}, pluck="name", ignore_permissions=True
        )
        if mine:
            total += frappe.db.count(
                MSG_DT,
                {"ticket": ["in", mine], "read_by_customer": 0, "sender_role": "Support"},
            )
    if _is_operator():
        total += frappe.db.count(MSG_DT, {"read_by_support": 0, "sender_role": "Customer"})
    return total


# -- operator ---------------------------------------------------------------


@frappe.whitelist()
def all_tickets(status=None, limit=100):
    """The support queue. Open tickets first, then newest activity."""
    if not _is_operator():
        frappe.throw(_("هذه الصفحة لمشغّلي المتجر فقط."), frappe.PermissionError)

    filters = {}
    if status == "open":
        filters["status"] = ["in", list(OPEN_STATUSES)]
    elif status:
        filters["status"] = status

    rows = frappe.get_all(
        TICKET_DT,
        filters=filters,
        fields=TICKET_FIELDS,
        order_by="last_activity desc, creation desc",
        limit_page_length=cint(limit) or 100,
        ignore_permissions=True,
    )
    unread = _unread_counts([r["name"] for r in rows], "support")
    out = [_shape_ticket(r, unread.get(r["name"], 0)) for r in rows]
    return {
        "tickets": out,
        "open_count": frappe.db.count(TICKET_DT, {"status": ["in", list(OPEN_STATUSES)]}),
    }


# -- notifications ----------------------------------------------------------


def _notify_operators(ticket_name, subject):
    """Best-effort — a notification hiccup must never lose the ticket."""
    try:
        users = set()
        for role in OPERATOR_ROLES:
            for u in frappe.get_all(
                "Has Role", filters={"role": role, "parenttype": "User"},
                fields=["parent"], ignore_permissions=True,
            ):
                users.add(u["parent"])
        for user in users:
            if user in ("Administrator", "Guest"):
                continue
            create_notification(
                user,
                title=_("تذكرة دعم جديدة {0}").format(ticket_name),
                message=subject[:120],
                kind="message",
                reference_doctype=TICKET_DT,
                reference_name=ticket_name,
            )
        frappe.db.commit()
    except Exception:
        frappe.log_error(title="Ovira: support ticket notify failed")


def _notify_counterpart(ticket_name, sender_role, body):
    try:
        snippet = (body or "")[:120]
        if sender_role == "customer":
            _notify_operators(ticket_name, snippet)
            return
        email = frappe.db.get_value(TICKET_DT, ticket_name, "customer_email")
        if email and frappe.db.exists("User", email):
            create_notification(
                email,
                title=_("رد من دعم المتجر على {0}").format(ticket_name),
                message=snippet,
                kind="message",
                reference_doctype=TICKET_DT,
                reference_name=ticket_name,
            )
        frappe.db.commit()
    except Exception:
        frappe.log_error(title="Ovira: support reply notify failed")

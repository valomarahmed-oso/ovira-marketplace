"""Order-scoped buyer <-> vendor chat.

A conversation is keyed by (order, vendor): the buyer who placed the order and a
vendor who has at least one line in it can message each other privately about
that order. The operator can read any thread for moderation but does not take
part in this slice.

Access is re-derived from the session on every call — the client names an order
and a vendor, never a role. Read state is two flags per message (`read_by_buyer`,
`read_by_vendor`): a message is unread for the *other* side until they open the
thread, which bulk-marks it.
"""

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint

from ovira_marketplace.api.admin import OPERATOR_ROLES
from ovira_marketplace.api.notifications import create_notification

MSG_FIELDS = ["name", "sender_role", "sender_name", "body", "creation"]


# -- identity / access ------------------------------------------------------


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


def _my_vendor():
    user = _session_user()
    if not user:
        return None
    return frappe.db.get_value("Marketplace Vendor", {"user": user}, "name")


def _my_customers(email):
    try:
        rows = frappe.get_all(
            "Portal User",
            filters={"user": email, "parenttype": "Customer"},
            fields=["parent"],
            ignore_permissions=True,
        )
        return [r["parent"] for r in rows]
    except Exception:
        return []


def _owns_order(order_row, email):
    if not email:
        return False
    if order_row.get("email") == email:
        return True
    customer = order_row.get("customer")
    return bool(customer and customer in _my_customers(email))


def _vendor_in_order(order, vendor):
    return bool(
        frappe.db.exists("Marketplace Order Item", {"parent": order, "vendor": vendor})
    )


def _order_vendor_names(order):
    """Distinct vendors on an order, in a stable order, with display names."""
    codes = frappe.get_all(
        "Marketplace Order Item",
        filters={"parent": order},
        pluck="vendor",
        ignore_permissions=True,
    )
    seen: list[str] = []
    for c in codes:
        if c and c not in seen:
            seen.append(c)
    names = {
        v.name: v.vendor_name
        for v in frappe.get_all(
            "Marketplace Vendor",
            filters={"name": ["in", seen]},
            fields=["name", "vendor_name"],
            ignore_permissions=True,
        )
    } if seen else {}
    return [(c, names.get(c) or c) for c in seen]


def _resolve_role(order, vendor):
    """The caller's role in the (order, vendor) thread, or throw. Returns one of
    'buyer' / 'vendor' / 'operator'."""
    order_row = frappe.db.get_value(
        "Marketplace Order", order, ["name", "email", "customer"], as_dict=True
    )
    if not order_row:
        frappe.throw(_("Order not found."), frappe.DoesNotExistError)
    if not _vendor_in_order(order, vendor):
        frappe.throw(_("This vendor isn't part of the order."), frappe.PermissionError)

    if _owns_order(order_row, _session_email()):
        return "buyer"
    if _my_vendor() == vendor:
        return "vendor"
    if _is_operator():
        return "operator"
    frappe.throw(_("You don't have access to this conversation."), frappe.PermissionError)


# -- read state -------------------------------------------------------------


def _read_field(role):
    return {"buyer": "read_by_buyer", "vendor": "read_by_vendor"}.get(role)


def _mark_thread_read(order, vendor, role):
    """Mark every message in the thread read for this role (its own messages are
    already flagged read on send). No-op for the operator (view only)."""
    field = _read_field(role)  # fixed map — never user input
    if not field:
        return
    frappe.db.sql(
        f"UPDATE `tabMarketplace Message` SET `{field}` = 1"
        f" WHERE `order` = %(order)s AND vendor = %(vendor)s AND `{field}` = 0",
        {"order": order, "vendor": vendor},
    )
    frappe.db.commit()


def _thread_shape(rows, role):
    out = []
    for r in rows:
        out.append(
            {
                "id": r.name,
                "body": r.body,
                "sender_role": r.sender_role,
                "sender_name": r.sender_name,
                "mine": _role_is_sender(role, r.sender_role),
                "date": str(r.creation),
            }
        )
    return out


def _role_is_sender(role, sender_role):
    return (sender_role or "").lower() == role


# -- endpoints --------------------------------------------------------------


@frappe.whitelist()
def order_vendors(order):
    """Vendors the buyer can message on this order, each with an unread count.
    Buyer (order owner) or operator only."""
    order_row = frappe.db.get_value(
        "Marketplace Order", order, ["name", "email", "customer"], as_dict=True
    )
    if not order_row:
        frappe.throw(_("Order not found."), frappe.DoesNotExistError)
    if not (_owns_order(order_row, _session_email()) or _is_operator()):
        frappe.throw(_("This order isn't yours."), frappe.PermissionError)

    result = []
    for code, label in _order_vendor_names(order):
        unread = frappe.db.count(
            "Marketplace Message",
            {"order": order, "vendor": code, "read_by_buyer": 0, "sender_role": ["!=", "Buyer"]},
        )
        result.append({"vendor": code, "vendor_name": label, "unread": unread})
    return result


@frappe.whitelist()
def thread(order, vendor, limit=200):
    """Messages in a (order, vendor) thread, oldest first. Marks the thread read
    for the caller's side."""
    role = _resolve_role(order, vendor)
    rows = frappe.get_all(
        "Marketplace Message",
        filters={"order": order, "vendor": vendor},
        fields=MSG_FIELDS,
        order_by="creation asc",
        limit_page_length=cint(limit) or 200,
        ignore_permissions=True,
    )
    _mark_thread_read(order, vendor, role)
    vendor_name = frappe.db.get_value("Marketplace Vendor", vendor, "vendor_name") or vendor
    return {"role": role, "vendor": vendor, "vendor_name": vendor_name, "messages": _thread_shape(rows, role)}


@frappe.whitelist()
@rate_limit(limit=60, seconds=60 * 10, methods="POST")
def post_message(order, vendor, body):
    """Send a message in a thread. Buyer (owner) or the vendor themselves only —
    the operator reads but doesn't post here."""
    role = _resolve_role(order, vendor)
    if role == "operator":
        frappe.throw(_("Operators can view but not post in buyer–vendor chats."), frappe.PermissionError)

    body = (body or "").strip()
    if not body:
        frappe.throw(_("Please write a message."))

    doc = frappe.new_doc("Marketplace Message")
    doc.order = order
    doc.vendor = vendor
    doc.sender_role = "Buyer" if role == "buyer" else "Vendor"
    doc.sender = _session_user()
    doc.sender_name = _sender_label(role, vendor)
    doc.body = body
    # The sender has, by definition, read their own message.
    doc.read_by_buyer = 1 if role == "buyer" else 0
    doc.read_by_vendor = 1 if role == "vendor" else 0
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    _notify_counterpart(order, vendor, role, body)
    return {
        "id": doc.name,
        "body": doc.body,
        "sender_role": doc.sender_role,
        "sender_name": doc.sender_name,
        "mine": True,
        "date": str(doc.creation),
    }


@frappe.whitelist()
def vendor_threads(limit=100):
    """Threads for the signed-in vendor across their orders: one row per order
    they've exchanged messages on (or could), newest activity first."""
    vendor = _my_vendor()
    if not vendor:
        return []
    rows = frappe.get_all(
        "Marketplace Message",
        filters={"vendor": vendor},
        fields=["order", "body", "sender_role", "creation", "read_by_vendor"],
        order_by="creation desc",
        limit_page_length=1000,
        ignore_permissions=True,
    )
    threads: dict = {}
    for r in rows:
        t = threads.get(r.order)
        if not t:
            t = threads[r.order] = {
                "order": r.order,
                "last_body": r.body,
                "last_date": str(r.creation),
                "unread": 0,
            }
        if not r.read_by_vendor and (r.sender_role or "") != "Vendor":
            t["unread"] += 1
    if not threads:
        return []

    names = {
        o.name: o.customer_name
        for o in frappe.get_all(
            "Marketplace Order",
            filters={"name": ["in", list(threads)]},
            fields=["name", "customer_name"],
            ignore_permissions=True,
        )
    }
    out = list(threads.values())
    for t in out:
        t["customer_name"] = names.get(t["order"])
    out.sort(key=lambda t: t["last_date"], reverse=True)
    return out[: cint(limit) or 100]


@frappe.whitelist()
def unread_total():
    """A single unread-message count for the signed-in user, summed across the
    role(s) they hold. Drives a chat badge."""
    total = 0
    email = _session_email()
    if email:
        orders = frappe.get_all(
            "Marketplace Order",
            or_filters=_buyer_or_filters(email),
            pluck="name",
            ignore_permissions=True,
        )
        if orders:
            total += frappe.db.count(
                "Marketplace Message",
                {"order": ["in", orders], "read_by_buyer": 0, "sender_role": ["!=", "Buyer"]},
            )
    vendor = _my_vendor()
    if vendor:
        total += frappe.db.count(
            "Marketplace Message",
            {"vendor": vendor, "read_by_vendor": 0, "sender_role": ["!=", "Vendor"]},
        )
    return total


# -- helpers ----------------------------------------------------------------


def _buyer_or_filters(email):
    or_filters = [["email", "=", email]]
    customers = _my_customers(email)
    if customers:
        or_filters.append(["customer", "in", customers])
    return or_filters


def _sender_label(role, vendor):
    if role == "vendor":
        return frappe.db.get_value("Marketplace Vendor", vendor, "vendor_name") or _("Vendor")
    return frappe.db.get_value("User", frappe.session.user, "full_name") or _("Buyer")


def _notify_counterpart(order, vendor, sender_role, body):
    """Raise an in-app notification for the other side of the thread. Best-effort:
    a notification hiccup must never fail the send."""
    try:
        snippet = (body or "")[:120]
        if sender_role == "buyer":
            vendor_user = frappe.db.get_value("Marketplace Vendor", vendor, "user")
            create_notification(
                vendor_user,
                title=_("New message about order {0}").format(order),
                message=snippet,
                kind="message",
                reference_doctype="Marketplace Order",
                reference_name=order,
            )
        else:
            email = frappe.db.get_value("Marketplace Order", order, "email")
            # Only notify a real account (guest-checkout emails have no User).
            if email and frappe.db.exists("User", email):
                create_notification(
                    email,
                    title=_("New reply from the seller on order {0}").format(order),
                    message=snippet,
                    kind="message",
                    reference_doctype="Marketplace Order",
                    reference_name=order,
                )
        frappe.db.commit()
    except Exception:
        frappe.log_error(title="Ovira: chat notify failed")

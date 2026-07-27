"""Abandoned-cart capture + recovery.

The storefront snapshots a shopper's cart (once we have an email — a signed-in
user, or one typed at checkout). An hourly sweep emails a gentle reminder for
carts left untouched for a while and never turned into an order. Placing an order
marks the cart recovered. Email is best-effort and only sends when outgoing mail
is configured (see emails.outgoing_configured)."""

import json

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import add_to_date, cint, flt, now_datetime

REMIND_AFTER_HOURS = 2
REMIND_WITHIN_DAYS = 7  # don't pester about very old carts


def _session_email():
    user = frappe.session.user
    if not user or user == "Guest":
        return None
    return frappe.db.get_value("User", user, "email") or user


def _find(email, user):
    name = None
    if user:
        name = frappe.db.get_value("Marketplace Abandoned Cart", {"user": user}, "name")
    if not name and email:
        name = frappe.db.get_value("Marketplace Abandoned Cart", {"email": email}, "name")
    return name


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=60, seconds=60 * 60, methods="POST")
def save_cart(items, email=None, customer_name=None, phone=None, subtotal=0, currency=None):
    """Upsert the shopper's current cart snapshot. Needs an email (session or
    passed). A cleared cart removes the snapshot."""
    user = frappe.session.user if frappe.session.user != "Guest" else None
    email = (email or _session_email() or "").strip() or None
    if not email:
        return {"saved": False}

    try:
        cart = json.loads(items) if isinstance(items, str) else (items or [])
    except (ValueError, TypeError):
        cart = []

    name = _find(email, user)
    if not cart:
        if name:
            frappe.delete_doc("Marketplace Abandoned Cart", name, ignore_permissions=True, force=True)
            frappe.db.commit()
        return {"saved": False}

    doc = (
        frappe.get_doc("Marketplace Abandoned Cart", name)
        if name
        else frappe.new_doc("Marketplace Abandoned Cart")
    )
    doc.email = email
    doc.user = user
    doc.customer_name = customer_name or doc.customer_name
    doc.phone = phone or doc.phone
    doc.subtotal = flt(subtotal)
    doc.currency = currency or doc.currency
    doc.cart_json = json.dumps(cart, ensure_ascii=False)
    # A fresh snapshot re-opens the reminder cycle.
    doc.status = "Open"
    doc.reminded_on = None
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"saved": True}


def mark_recovered(email=None, user=None):
    """Close out a shopper's cart once they place an order (best-effort)."""
    name = _find((email or "").strip() or None, user)
    if not name:
        return
    frappe.db.set_value(
        "Marketplace Abandoned Cart", name, "status", "Recovered", update_modified=False
    )


def sweep_abandoned_carts():
    """Hourly scheduler: remind about carts left open a while, once. This is
    MARKETING, so the engine keeps it off WhatsApp and honours opt-outs."""
    import json as _json

    from ovira_marketplace.notifications.dispatch import emit

    cutoff = add_to_date(now_datetime(), hours=-REMIND_AFTER_HOURS)
    floor = add_to_date(now_datetime(), days=-REMIND_WITHIN_DAYS)
    rows = frappe.get_all(
        "Marketplace Abandoned Cart",
        filters=[
            ["status", "=", "Open"],
            ["modified", "<=", cutoff],
            ["modified", ">=", floor],
        ],
        fields=["name", "email", "customer_name", "cart_json", "subtotal", "currency"],
        limit_page_length=200,
        ignore_permissions=True,
    )
    for row in rows:
        if not row.email:
            continue
        try:
            try:
                count = len(_json.loads(row.get("cart_json") or "[]"))
            except (ValueError, TypeError):
                count = 0
            emit("cart.abandoned", {
                "email": row.email, "customer_name": row.customer_name or "",
                "count": count, "total": row.subtotal, "currency": row.currency or "",
                "kind": "promo",
            }, reference={"doctype": "Marketplace Abandoned Cart", "name": row.name})
            frappe.db.set_value(
                "Marketplace Abandoned Cart",
                row.name,
                {"status": "Reminded", "reminded_on": now_datetime()},
                update_modified=False,
            )
        except Exception:
            frappe.log_error(title="Ovira: abandoned-cart reminder failed")
    frappe.db.commit()

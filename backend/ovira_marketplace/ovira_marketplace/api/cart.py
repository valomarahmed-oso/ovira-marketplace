"""Cross-device cart — mirror the signed-in shopper's cart to the server so it
follows them across devices.

The stored blob is the storefront's own cart JSON; the server treats it as
opaque and only validates its shape and size. Checkout re-prices every line
server-side, so a stale mirror can never influence what the shopper is charged.
Both endpoints are login-gated (guests keep a local-only cart).
"""

import json

import frappe
from frappe import _

MAX_ITEMS = 100
MAX_BYTES = 1_000_000


def _session_user():
    user = frappe.session.user
    return None if (not user or user == "Guest") else user


@frappe.whitelist()
def get_cart():
    """The signed-in shopper's saved cart lines (empty when none saved)."""
    user = _session_user()
    if not user:
        return {"items": []}
    raw = frappe.db.get_value("Marketplace Cart", user, "data")
    if not raw:
        return {"items": []}
    try:
        items = json.loads(raw)
    except (ValueError, TypeError):
        items = []
    return {"items": items if isinstance(items, list) else []}


@frappe.whitelist()
def save_cart(data):
    """Persist the shopper's cart JSON for this login (best-effort, login only)."""
    user = _session_user()
    if not user:
        return {"ok": False}

    try:
        items = json.loads(data) if isinstance(data, str) else data
    except (ValueError, TypeError):
        frappe.throw(_("Invalid cart data."))
    if not isinstance(items, list):
        frappe.throw(_("Invalid cart data."))

    items = items[:MAX_ITEMS]
    blob = frappe.as_json(items)
    if len(blob.encode("utf-8")) > MAX_BYTES:
        frappe.throw(_("Cart is too large to save."))

    if frappe.db.exists("Marketplace Cart", user):
        doc = frappe.get_doc("Marketplace Cart", user)
        doc.data = blob
        doc.item_count = len(items)
        doc.save(ignore_permissions=True)
    else:
        frappe.get_doc(
            {
                "doctype": "Marketplace Cart",
                "user": user,
                "data": blob,
                "item_count": len(items),
            }
        ).insert(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "item_count": len(items)}

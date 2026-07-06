"""Cross-device wishlist — mirror the signed-in shopper's wishlist to the server
so their saved items follow them across devices.

Mirrors the cross-device cart: the stored blob is the storefront's own wishlist
JSON, treated as opaque (shape + size validated only). Both endpoints are
login-gated; guests keep a local-only wishlist.
"""

import json

import frappe
from frappe import _

MAX_ITEMS = 200
MAX_BYTES = 1_000_000


def _session_user():
    user = frappe.session.user
    return None if (not user or user == "Guest") else user


@frappe.whitelist()
def get_wishlist():
    """The signed-in shopper's saved wishlist items (empty when none saved)."""
    user = _session_user()
    if not user:
        return {"items": []}
    raw = frappe.db.get_value("Marketplace Wishlist", user, "data")
    if not raw:
        return {"items": []}
    try:
        items = json.loads(raw)
    except (ValueError, TypeError):
        items = []
    return {"items": items if isinstance(items, list) else []}


@frappe.whitelist()
def save_wishlist(data):
    """Persist the shopper's wishlist JSON for this login (best-effort, login only)."""
    user = _session_user()
    if not user:
        return {"ok": False}

    try:
        items = json.loads(data) if isinstance(data, str) else data
    except (ValueError, TypeError):
        frappe.throw(_("Invalid wishlist data."))
    if not isinstance(items, list):
        frappe.throw(_("Invalid wishlist data."))

    items = items[:MAX_ITEMS]
    blob = frappe.as_json(items)
    if len(blob.encode("utf-8")) > MAX_BYTES:
        frappe.throw(_("Wishlist is too large to save."))

    if frappe.db.exists("Marketplace Wishlist", user):
        doc = frappe.get_doc("Marketplace Wishlist", user)
        doc.data = blob
        doc.item_count = len(items)
        doc.save(ignore_permissions=True)
    else:
        frappe.get_doc(
            {
                "doctype": "Marketplace Wishlist",
                "user": user,
                "data": blob,
                "item_count": len(items),
            }
        ).insert(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "item_count": len(items)}

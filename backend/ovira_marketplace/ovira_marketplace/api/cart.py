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
        _count_new_items(doc.data, items)
        doc.data = blob
        doc.item_count = len(items)
        doc.save(ignore_permissions=True)
    else:
        _count_new_items(None, items)
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


def _count_new_items(previous_blob, items):
    """Record the products that just entered this cart.

    The storefront saves the whole cart, so an "add" is whatever is in the new
    blob and wasn't in the old one — a re-save of an unchanged cart counts
    nothing, which is the only way this number stays meaningful.
    """
    try:
        before = set()
        if previous_blob:
            for row in json.loads(previous_blob) or []:
                if isinstance(row, dict) and row.get("slug"):
                    before.add(row["slug"])
        added = [r.get("slug") for r in items
                 if isinstance(r, dict) and r.get("slug") and r["slug"] not in before]
        if not added:
            return
        names = frappe.get_all("Marketplace Product", filters={"slug": ["in", added]},
                               pluck="name", ignore_permissions=True)
        from ovira_marketplace.api.product_stats import record_cart_adds

        record_cart_adds(names)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Ovira: cart add tracking")

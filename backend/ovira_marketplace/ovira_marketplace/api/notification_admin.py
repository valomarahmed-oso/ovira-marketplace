"""Operator console + customer preferences for the notification pipeline.

Three audiences, one module:

* the **operator** edits wording, previews it, and watches the outbox;
* the **customer** sets what marketing they want, or unsubscribes from a link;
* the **engine** stays untouched — everything here reads and writes the same
  records `notifications/dispatch.py` uses, so there is one behaviour, not two.
"""

import json

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint

from ovira_marketplace.api.admin import _require_operator
from ovira_marketplace.marketplace.doctype.marketplace_notification_preference.marketplace_notification_preference import (
    by_token,
    for_recipient,
)
from ovira_marketplace.notifications import events as catalog

TEMPLATE_DT = "Marketplace Notification Template"
OUTBOX_DT = "Marketplace Notification Outbox"

# Values used to render a preview, so an operator sees a real-looking message
# instead of raw {placeholders}.
SAMPLE = {
    "order": "MO-2026-00042", "total": "1,250.00", "currency": "EGP",
    "customer_name": "أحمد", "status": "Shipped", "otp": "4821",
    "points": "125", "product": "سماعة بلوتوث", "count": "3",
    "note": "—", "subject": "استفسار عن الشحن", "ticket": "TKT-0007",
    "store": "أوفيرا",
}


# ── templates ───────────────────────────────────────────────────────────────
@frappe.whitelist()
def list_events():
    """Every event the store can raise, with its default wording and any override.

    The catalogue is the source of truth for what EXISTS; the doctype only ever
    overrides wording. So a new event ships working, and an operator's edit
    survives an upgrade.
    """
    _require_operator()
    overrides = {}
    try:
        for row in frappe.get_all(
            TEMPLATE_DT, fields=["event", "language", "title", "lines", "enabled"],
            ignore_permissions=True,
        ):
            overrides[(row["event"], row["language"])] = row
    except Exception:
        overrides = {}

    out = []
    for event_id, event in catalog.EVENTS.items():
        entry = {
            "event": event_id,
            "audience": event.audience,
            "transactional": bool(event.transactional),
            "channels": list(event.channels),
            "languages": {},
        }
        for lang in ("ar", "en"):
            default = catalog.default_content(event_id, lang)
            ov = overrides.get((event_id, lang))
            entry["languages"][lang] = {
                "default_title": default.title if default else "",
                "default_lines": list(default.lines) if default else [],
                "title": (ov or {}).get("title") or "",
                "lines": [ln for ln in ((ov or {}).get("lines") or "").splitlines() if ln.strip()],
                "overridden": bool(ov),
                "enabled": bool(cint((ov or {}).get("enabled", 1))),
            }
        out.append(entry)
    out.sort(key=lambda e: e["event"])
    return out


@frappe.whitelist()
def save_template(event, language, title, lines, enabled=1):
    """Override one event's wording in one language."""
    _require_operator()
    if event not in catalog.EVENTS:
        frappe.throw(_("حدث غير معروف."))
    if language not in ("ar", "en"):
        frappe.throw(_("لغة غير مدعومة."))
    if isinstance(lines, str) and lines.strip().startswith("["):
        try:
            lines = "\n".join(json.loads(lines))
        except Exception:
            pass
    elif isinstance(lines, (list, tuple)):
        lines = "\n".join(lines)

    name = "{0}::{1}".format(event, language)
    values = {"title": (title or "").strip(), "lines": lines or "", "enabled": cint(enabled)}
    if not values["title"]:
        frappe.throw(_("العنوان مطلوب."))
    if frappe.db.exists(TEMPLATE_DT, name):
        doc = frappe.get_doc(TEMPLATE_DT, name)
        doc.update(values)
        doc.save(ignore_permissions=True)
    else:
        values.update({"doctype": TEMPLATE_DT, "event": event, "language": language})
        doc = frappe.get_doc(values)
        doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True, "name": doc.name}


@frappe.whitelist()
def reset_template(event, language):
    """Drop the override and go back to the shipped wording."""
    _require_operator()
    name = "{0}::{1}".format(event, language)
    if frappe.db.exists(TEMPLATE_DT, name):
        frappe.delete_doc(TEMPLATE_DT, name, ignore_permissions=True, force=True)
        frappe.db.commit()
    return {"ok": True}


@frappe.whitelist()
def preview_template(event, language, title=None, lines=None):
    """Render wording against sample values — what the customer would actually
    read, including how each channel shapes it."""
    _require_operator()
    if isinstance(lines, str):
        try:
            lines = json.loads(lines) if lines.strip().startswith("[") else lines.splitlines()
        except Exception:
            lines = lines.splitlines()
    if not title:
        content = catalog.content_for(event, language)
        title, lines = (content.title, list(content.lines)) if content else ("", [])

    from ovira_marketplace.notifications.dispatch import _fill

    rendered_title = _fill(title, SAMPLE)
    rendered_lines = [_fill(x, SAMPLE) for x in (lines or []) if str(x).strip()]
    return {
        "title": rendered_title,
        "lines": rendered_lines,
        # How each medium presents the same block (see notifications/channels.py).
        "email_subject": rendered_title,
        "text": "\n".join([rendered_title, ""] + rendered_lines),
        "inapp": {"title": rendered_title, "message": rendered_lines[0] if rendered_lines else ""},
    }


# ── outbox ──────────────────────────────────────────────────────────────────
@frappe.whitelist()
def outbox(limit=60, status=None, channel=None, event=None):
    """What the pipeline actually did. Recipients are masked the same way the
    message log masks them: enough to recognise a customer, not to harvest one."""
    _require_operator()
    filters = {}
    if status:
        filters["status"] = status
    if channel:
        filters["channel"] = channel
    if event:
        filters["event"] = event
    rows = frappe.get_all(
        OUTBOX_DT, filters=filters,
        fields=["name", "event", "channel", "status", "attempts", "language",
                "recipient_email", "recipient_phone", "recipient_user", "subject",
                "last_error", "reference_doctype", "reference_name", "sent_at",
                "next_attempt_at", "creation", "transactional"],
        order_by="creation desc", limit_page_length=cint(limit) or 60,
        ignore_permissions=True,
    )
    from ovira_marketplace.api.messaging_hub import _mask_recipient

    for r in rows:
        r["creation"] = str(r["creation"])
        r["sent_at"] = str(r["sent_at"]) if r.get("sent_at") else None
        r["next_attempt_at"] = str(r["next_attempt_at"]) if r.get("next_attempt_at") else None
        r["recipient"] = _mask_recipient(
            r.pop("recipient_email", None) or r.pop("recipient_phone", None) or r.get("recipient_user") or "")
        r.pop("recipient_email", None)
        r.pop("recipient_phone", None)
    return rows


@frappe.whitelist()
@rate_limit(limit=60, seconds=60 * 10, methods="POST")
def retry_outbox(name):
    """Send a failed (or skipped) row again, now."""
    _require_operator()
    if not frappe.db.exists(OUTBOX_DT, name):
        frappe.throw(_("لا يوجد سجل بهذا الاسم."))
    frappe.db.set_value(OUTBOX_DT, name,
                        {"status": "queued", "attempts": 0, "next_attempt_at": None},
                        update_modified=False)
    frappe.db.commit()
    from ovira_marketplace.notifications.dispatch import deliver_one

    deliver_one(name)
    return frappe.db.get_value(OUTBOX_DT, name, ["status", "last_error"], as_dict=True)


@frappe.whitelist()
def outbox_summary(days=7):
    """Counts by status for the last `days` — the one number an operator checks."""
    _require_operator()
    since = frappe.utils.add_to_date(frappe.utils.now_datetime(), days=-cint(days or 7))
    rows = frappe.get_all(
        OUTBOX_DT, filters=[["creation", ">", since]],
        fields=["status", "count(name) as count"], group_by="status",
        ignore_permissions=True,
    )
    return {r["status"]: r["count"] for r in rows}


# ── customer preferences ────────────────────────────────────────────────────
@frappe.whitelist()
def my_preferences():
    """What the signed-in customer currently receives."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw(_("سجّل الدخول أولاً."), frappe.PermissionError)
    pref = for_recipient(user, user=user)
    return {
        "marketing_email": bool(pref.marketing_email) if pref else True,
        "marketing_push": bool(pref.marketing_push) if pref else True,
    }


@frappe.whitelist()
def set_my_preferences(marketing_email=1, marketing_push=1):
    """Transactional messages aren't listed here on purpose: a receipt is part of
    the purchase, not a subscription."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw(_("سجّل الدخول أولاً."), frappe.PermissionError)
    pref = for_recipient(user, user=user, create=True)
    pref.marketing_email = cint(marketing_email)
    pref.marketing_push = cint(marketing_push)
    pref.save(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=30, seconds=60 * 10)
def unsubscribe(token):
    """One-click unsubscribe from a marketing email. Guest-accessible by design —
    a link that demands a login isn't an unsubscribe link. The token proves the
    click came from a message we sent, so nobody can unsubscribe a stranger."""
    pref = by_token(token)
    if not pref:
        return {"ok": False}
    pref.marketing_email = 0
    pref.save(ignore_permissions=True)
    frappe.db.commit()
    return {"ok": True}

"""The notification engine: one `emit()` in, delivered messages out.

Feature code says *what happened* and hands over the facts. Everything else —
who hears about it, in which language, over which channels, when to retry, and
what to record — is decided here, once.

Guarantees the callers depend on:

* **Never breaks the caller.** `emit()` swallows everything. An order is not
  allowed to fail because a message did.
* **Never sends twice.** Every (event, reference, recipient, channel) is written
  to the outbox under a unique key, so a replayed hook or a double save is a
  no-op the second time.
* **Never blocks.** Rendering is cheap and synchronous; delivery is queued.
* **Never loses a failure.** Three attempts with backoff, then a `failed` row
  that says why. Skips are recorded too — "why didn't the customer get this?"
  is the question you actually have to answer.
"""

import hashlib
import json

import frappe
from frappe.utils import add_to_date, cint, now_datetime

from ovira_marketplace.notifications import events as catalog
from ovira_marketplace.notifications.channels import ADAPTERS

OUTBOX = "Marketplace Notification Outbox"

MAX_ATTEMPTS = 3
# Backoff between attempts (minutes): quick, then patient.
BACKOFF_MINUTES = (5, 30, 120)


# ── public API ──────────────────────────────────────────────────────────────
def emit(event_id, context=None, doc=None, recipients=None, reference=None, force=False):
    """Announce that something happened. Safe to call from anywhere, any time.

    context     — flat dict of values the templates interpolate
    doc         — the document the event is about (used for recipients + reference)
    recipients  — explicit list of recipient dicts, when the audience isn't derivable
    reference   — {"doctype","name"} override for the audit row
    force       — deliberately send again (an operator re-sending a delivery code).
                  Without it the dedupe key would swallow the second copy, which is
                  exactly what you want for retries and exactly not what you want here.
    """
    try:
        return _emit(event_id, context or {}, doc, recipients, reference, force)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Ovira notifications: emit %s" % event_id)
        return []


def _emit(event_id, context, doc, recipients, reference, force=False):
    event = catalog.get(event_id)
    if not event:
        frappe.log_error("Unknown notification event: %s" % event_id, "Ovira notifications")
        return []

    if reference is None and doc is not None:
        reference = {"doctype": doc.doctype, "name": doc.name}
    reference = reference or {}

    people = recipients if recipients is not None else resolve_recipients(event, doc, context)
    # A forced re-send salts the dedupe key so it lands as a NEW row.
    salt = frappe.utils.now() if force else ""
    queued = []
    for rcpt in people:
        for channel in event.channels:
            row = _queue(event_id, event, channel, rcpt, context, reference, salt)
            if row:
                queued.append(row)

    # Hand the whole batch to the worker in one go, outside this transaction.
    if queued:
        frappe.enqueue(
            "ovira_marketplace.notifications.dispatch.deliver_batch",
            queue="short", enqueue_after_commit=True, names=queued,
        )
    return queued


def _allowed(event, channel, rcpt):
    """Marketing obeys the recipient; transactional does not.

    A receipt, a shipping update or a delivery code is part of the purchase — the
    same line Amazon draws. Everything else is the customer's call, and a missing
    preference row means they never objected.
    """
    if event.transactional:
        return True, None
    pref = None
    try:
        from ovira_marketplace.marketplace.doctype.marketplace_notification_preference.marketplace_notification_preference import (
            for_recipient,
        )

        pref = for_recipient(rcpt.get("email"), user=rcpt.get("user"))
    except Exception:
        pref = None   # doctype not migrated yet — don't silence the store
    if not pref:
        return True, None
    if channel == "email" and not pref.marketing_email:
        return False, "unsubscribed from marketing email"
    if channel == "push" and not pref.marketing_push:
        return False, "unsubscribed from marketing push"
    return True, None


def _quiet_until():
    """End of the store's quiet hours, if we're inside them right now.

    Marketing that lands at 3am reads as spam even when the customer asked for
    it, so it waits for morning instead of being dropped.
    """
    try:
        settings = frappe.get_cached_doc("Marketplace Settings")
        start = cint(settings.get("quiet_hours_start"))
        end = cint(settings.get("quiet_hours_end"))
    except Exception:
        return None
    if start == end:
        return None
    hour = now_datetime().hour
    inside = (start <= hour < end) if start < end else (hour >= start or hour < end)
    if not inside:
        return None
    target = now_datetime().replace(minute=0, second=0, microsecond=0)
    while target.hour != end:
        target = add_to_date(target, hours=1)
    return target


def _queue(event_id, event, channel, rcpt, context, reference, salt=""):
    """Render now, deliver later. Returns the outbox row name, or None when this
    (event, recipient, channel) was already written."""
    if channel not in ADAPTERS:
        return None
    # Explicit recipients may omit the language; look it up rather than assuming.
    lang = rcpt.get("lang") or _lang_of(rcpt.get("user"))
    content = catalog.content_for(event_id, lang)
    if not content:
        return None

    ctx = _with_defaults(context)
    title = _fill(content.title, ctx)
    lines = [ln for ln in (_fill(x, ctx) for x in content.lines) if ln.strip()]

    key = _dedupe_key(event_id, channel, rcpt, reference, salt)
    if frappe.db.exists(OUTBOX, {"dedupe_key": key}):
        return None

    allowed, refusal = _allowed(event, channel, rcpt)
    # Marketing outside waking hours waits rather than lands at 3am.
    hold = None if (event.transactional or not allowed) else _quiet_until()

    doc = frappe.get_doc({
        "doctype": OUTBOX,
        "event": event_id, "channel": channel,
        "status": "skipped" if not allowed else "queued",
        "recipient_user": rcpt.get("user"), "recipient_email": rcpt.get("email"),
        "recipient_phone": rcpt.get("phone"), "language": lang,
        "transactional": 1 if event.transactional else 0,
        "subject": title[:140], "body": json.dumps(lines, ensure_ascii=False),
        "reference_doctype": reference.get("doctype"), "reference_name": reference.get("name"),
        "dedupe_key": key, "attempts": 0,
        "last_error": refusal, "next_attempt_at": hold,
    })
    doc.insert(ignore_permissions=True)
    # A held or refused row is not handed to the worker: the sweep picks the held
    # one up when its hour comes, and the refused one is already final.
    return None if (not allowed or hold) else doc.name


def _dedupe_key(event_id, channel, rcpt, reference, salt=""):
    who = rcpt.get("user") or rcpt.get("email") or rcpt.get("phone") or "?"
    raw = "|".join([event_id, channel, str(who),
                    str(reference.get("doctype") or ""), str(reference.get("name") or ""), str(salt)])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _with_defaults(context):
    """Values every message may use without each call site remembering them."""
    ctx = dict(context or {})
    if "store" not in ctx:
        try:
            from ovira_marketplace.emails import STORE_NAME

            ctx["store"] = STORE_NAME
        except Exception:
            ctx["store"] = ""
    return ctx


class _Safe(dict):
    """A missing placeholder renders as empty, never as a crash mid-checkout."""

    def __missing__(self, key):
        return ""


def _fill(template, context):
    try:
        return str(template).format_map(_Safe(context or {}))
    except Exception:
        return str(template)


# ── recipients ──────────────────────────────────────────────────────────────
def resolve_recipients(event, doc, context):
    if event.audience == catalog.BUYER:
        return _buyer_of(doc, context)
    if event.audience == catalog.VENDOR:
        return _vendors_of(doc, context)
    if event.audience == catalog.OPERATOR:
        return _operators()
    return []


def _person(user=None, email=None, phone=None, lang=None, kind=None):
    if not (user or email or phone):
        return None
    return {"user": user, "email": email, "phone": phone, "lang": lang or _lang_of(user), "kind": kind}


def _lang_of(user):
    """The recipient's own language, Arabic by default (the storefront's default)."""
    if not user or user == "Guest":
        return "ar"
    try:
        return (frappe.db.get_value("User", user, "language") or "ar").lower()[:2]
    except Exception:
        return "ar"


def _buyer_of(doc, context):
    email = (doc.get("email") if doc else None) or context.get("email")
    phone = (doc.get("phone") if doc else None) or context.get("phone")
    user = context.get("user")
    if not user and email and frappe.db.exists("User", email):
        user = email
    p = _person(user, email, phone, kind=context.get("kind") or "order")
    return [p] if p else []


def _vendors_of(doc, context):
    """Vendors on a marketplace order (each vendor hears about their own lines)."""
    names = context.get("vendors")
    if names is None and doc is not None:
        names = list({r.vendor for r in (doc.get("items") or []) if r.get("vendor")})
    out = []
    for vendor in names or []:
        row = frappe.db.get_value(
            "Marketplace Vendor", vendor, ["email", "phone", "user"], as_dict=True)
        if not row:
            continue
        user = row.get("user") if row.get("user") not in (None, "", "Administrator") else None
        p = _person(user, row.get("email"), row.get("phone"), kind="order")
        if p:
            out.append(p)
    return out


def _operators():
    from ovira_marketplace.api.admin import OPERATOR_ROLES

    users = set()
    for role in OPERATOR_ROLES:
        for u in frappe.get_all("Has Role", filters={"role": role, "parenttype": "User"},
                                pluck="parent") or []:
            users.add(u)
    out = []
    for u in users:
        if u in ("Guest", "Administrator"):
            continue
        if not frappe.db.get_value("User", u, "enabled"):
            continue
        p = _person(u, u, frappe.db.get_value("User", u, "mobile_no"), kind="system")
        if p:
            out.append(p)
    return out


# ── delivery ────────────────────────────────────────────────────────────────
def deliver_batch(names=None):
    for name in names or []:
        deliver_one(name)


def deliver_one(name):
    """Deliver a single outbox row. Records the outcome either way."""
    try:
        row = frappe.get_doc(OUTBOX, name)
    except Exception:
        return
    if row.status not in ("queued", "retry"):
        return

    adapter = ADAPTERS.get(row.channel)
    if not adapter:
        _finish(row, "skipped", reason="unknown channel")
        return

    rcpt = {"user": row.recipient_user, "email": row.recipient_email,
            "phone": row.recipient_phone, "lang": row.language}
    try:
        lines = json.loads(row.body or "[]")
    except Exception:
        lines = []
    reference = {"doctype": row.reference_doctype, "name": row.reference_name}

    result = adapter(rcpt, row.subject or "", lines, reference=reference,
                     transactional=bool(row.transactional)) or {}
    if result.get("skipped"):
        _finish(row, "skipped", reason=result["skipped"])
        return
    if result.get("ok"):
        _finish(row, "sent", provider_id=result.get("id"))
        return

    attempts = (row.attempts or 0) + 1
    if attempts >= MAX_ATTEMPTS:
        _finish(row, "failed", reason=result.get("error"), attempts=attempts)
        return
    delay = BACKOFF_MINUTES[min(attempts - 1, len(BACKOFF_MINUTES) - 1)]
    row.db_set({
        "status": "retry", "attempts": attempts,
        "last_error": (result.get("error") or "")[:400],
        "next_attempt_at": add_to_date(now_datetime(), minutes=delay),
    }, update_modified=False)
    frappe.db.commit()


def _finish(row, status, reason=None, provider_id=None, attempts=None):
    row.db_set({
        "status": status,
        "attempts": attempts if attempts is not None else (row.attempts or 0) + (1 if status == "sent" else 0),
        "last_error": (reason or "")[:400],
        "provider_id": provider_id,
        "sent_at": now_datetime() if status == "sent" else None,
        "next_attempt_at": None,
    }, update_modified=False)
    frappe.db.commit()


def retry_pending():
    """Scheduled sweep: pick up everything whose backoff has elapsed. Also catches
    rows whose enqueue was lost to a worker restart."""
    rows = frappe.get_all(
        OUTBOX,
        filters=[["status", "in", ["retry", "queued"]],
                 ["next_attempt_at", "<", now_datetime()]],
        pluck="name", limit_page_length=200, order_by="creation asc",
    )   # includes marketing held for quiet hours, once its hour has come
    # A queued row with no next_attempt_at is either in flight or was dropped; give
    # it a grace period before re-sending so we don't race the original worker.
    stale = frappe.get_all(
        OUTBOX,
        filters=[["status", "=", "queued"], ["next_attempt_at", "is", "not set"],
                 ["creation", "<", add_to_date(now_datetime(), minutes=-20)]],
        pluck="name", limit_page_length=100, order_by="creation asc",
    )
    for name in list(dict.fromkeys(list(rows) + list(stale))):
        try:
            deliver_one(name)
        except Exception:
            frappe.log_error(frappe.get_traceback(), "Ovira notifications: retry")

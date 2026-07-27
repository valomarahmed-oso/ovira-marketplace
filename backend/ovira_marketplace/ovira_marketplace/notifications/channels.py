"""Channel adapters: how one rendered content block leaves the building.

Each adapter takes (recipient, title, lines) and returns
`{"ok": bool, "id": str|None, "error": str|None, "skipped": reason|None}`.
`skipped` means "this recipient has no address for this channel" or "the channel
isn't configured" — a fact worth recording, not a failure to retry.

Nothing here raises: the caller is a queue worker whose job is to record an
outcome, not to crash.
"""

import frappe

from ovira_marketplace.notifications.events import EMAIL, INAPP, PUSH, SMS, WHATSAPP


def _skip(reason):
    return {"ok": False, "id": None, "error": None, "skipped": reason}


def _fail(error):
    return {"ok": False, "id": None, "error": str(error)[:400], "skipped": None}


def _sent(id_=None):
    return {"ok": True, "id": id_, "error": None, "skipped": None}


# ── in-app ──────────────────────────────────────────────────────────────────
def send_inapp(rcpt, title, lines, reference=None, **_):
    user = rcpt.get("user")
    if not user or user == "Guest":
        return _skip("no account")   # guest checkout: email/WhatsApp still carry it
    try:
        from ovira_marketplace.api.notifications import create_notification

        name = create_notification(
            user=user, title=title, message=(lines[0] if lines else title),
            kind=rcpt.get("kind") or "system",
            reference_doctype=(reference or {}).get("doctype"),
            reference_name=(reference or {}).get("name"),
            push=False,   # the push channel is dispatched separately
        )
        return _sent(name)
    except Exception as e:
        return _fail(e)


# ── web push ────────────────────────────────────────────────────────────────
def send_push(rcpt, title, lines, reference=None, **_):
    user = rcpt.get("user")
    if not user or user == "Guest":
        return _skip("no account")
    try:
        from ovira_marketplace.api.push import send_to_user

        url = "/shop/account/notifications"
        ref = reference or {}
        if ref.get("doctype") == "Marketplace Order" and ref.get("name"):
            url = "/shop/track?order=" + ref["name"]
        count = send_to_user(user, title, (lines[0] if lines else title), url=url)
        return _sent() if count else _skip("no push subscription")
    except Exception as e:
        return _fail(e)


# ── email ───────────────────────────────────────────────────────────────────
def send_email(rcpt, title, lines, reference=None, **_):
    to = rcpt.get("email")
    if not to or "@" not in to:
        return _skip("no email address")
    html = _html(title, lines, rtl=not str(rcpt.get("lang") or "ar").startswith("en"))
    # Prefer the messaging hub (per-company sender + unified log); fall back to the
    # site's own outgoing account so a store with no hub sender still emails.
    try:
        from ovira_marketplace.api import messaging_hub

        if messaging_hub.has_sender(family="email") and messaging_hub.deliver(
            to, html, subject=title, family="email",
            reference_doctype=(reference or {}).get("doctype"),
            reference_name=(reference or {}).get("name"),
        ):
            return _sent()
    except Exception:
        pass   # fall through to frappe's own mail
    try:
        from ovira_marketplace.emails import outgoing_configured

        if not outgoing_configured():
            return _skip("no outgoing email account")
        frappe.sendmail(recipients=[to], subject=title, message=html, now=False)
        return _sent()
    except Exception as e:
        return _fail(e)


def _html(title, lines, rtl=True):
    """The branded shell every marketplace email shares."""
    from ovira_marketplace.emails import STORE_NAME

    body = "".join("<p style='margin:6px 0;color:#444'>%s</p>" % ln for ln in lines if ln)
    direction = "rtl" if rtl else "ltr"
    return (
        "<div dir='%s' style='font-family:Tahoma,Arial,sans-serif;font-size:14px;"
        "line-height:1.9;color:#222'>"
        "<h2 style='color:#1a56db;margin:0 0 12px'>%s</h2>%s"
        "<hr style='border:none;border-top:1px solid #eee;margin:16px 0'>"
        "<p style='color:#999;font-size:12px'>%s</p></div>" % (direction, title, body, STORE_NAME)
    )


# ── WhatsApp / SMS (both through the shared hub) ────────────────────────────
def _via_hub(family, rcpt, title, lines, reference=None, limit=None):
    phone = rcpt.get("phone")
    if not phone:
        return _skip("no phone number")
    try:
        from ovira_marketplace.api import messaging_hub

        if not messaging_hub.has_sender(family=family):
            return _skip("no %s sender configured" % family)
        text = "\n".join([title, ""] + [ln for ln in lines if ln])
        if limit:
            text = text[:limit]
        ref = reference or {}
        ok = messaging_hub.deliver(
            phone, text, subject=None, family=family,
            reference_doctype=ref.get("doctype"), reference_name=ref.get("name"),
        )
        return _sent() if ok else _fail("the hub could not deliver it — see the messaging log")
    except Exception as e:
        return _fail(e)


def send_whatsapp(rcpt, title, lines, reference=None, **_):
    return _via_hub("whatsapp", rcpt, title, lines, reference)


def send_sms(rcpt, title, lines, reference=None, **_):
    # One segment-ish. SMS is the only channel that bills per message.
    return _via_hub("sms", rcpt, title, lines, reference, limit=300)


ADAPTERS = {
    INAPP: send_inapp,
    PUSH: send_push,
    EMAIL: send_email,
    WHATSAPP: send_whatsapp,
    SMS: send_sms,
}

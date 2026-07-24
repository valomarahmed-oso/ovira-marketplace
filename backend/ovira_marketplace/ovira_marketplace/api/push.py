"""Web push notifications.

Gated like the other integrations: it stays a no-op until an operator adds VAPID
keys in Marketplace Settings AND the ``pywebpush`` library is installed on the
server. Subscriptions are always captured so push works the moment it's enabled;
sending simply skips (and logs) while disabled. Never let a push failure break
the action that triggered it."""

import json

import frappe
from frappe import _


def _settings():
    return frappe.get_cached_doc("Marketplace Settings")


@frappe.whitelist(allow_guest=True)
def vapid_public_key():
    """The public VAPID key for the browser to subscribe with, or None when push
    isn't configured (the client then just doesn't offer push)."""
    key = (_settings().get("vapid_public_key") or "").strip()
    return key or None


@frappe.whitelist()
def subscribe(subscription, user_agent=None):
    """Store the signed-in user's push subscription (idempotent by endpoint)."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw(_("Please sign in."), frappe.PermissionError)
    try:
        sub = json.loads(subscription) if isinstance(subscription, str) else subscription
    except (ValueError, TypeError):
        frappe.throw(_("Invalid subscription."))
    endpoint = (sub or {}).get("endpoint")
    keys = (sub or {}).get("keys") or {}
    if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
        frappe.throw(_("Invalid subscription."))

    name = frappe.db.get_value("Marketplace Push Subscription", {"endpoint": endpoint}, "name")
    doc = (
        frappe.get_doc("Marketplace Push Subscription", name)
        if name
        else frappe.new_doc("Marketplace Push Subscription")
    )
    doc.user = user
    doc.endpoint = endpoint
    doc.p256dh = keys.get("p256dh")
    doc.auth = keys.get("auth")
    doc.user_agent = (user_agent or "")[:140]
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"subscribed": True}


@frappe.whitelist()
def unsubscribe(endpoint):
    name = frappe.db.get_value("Marketplace Push Subscription", {"endpoint": endpoint}, "name")
    if name:
        frappe.delete_doc("Marketplace Push Subscription", name, ignore_permissions=True, force=True)
        frappe.db.commit()
    return {"unsubscribed": True}


def _webpush():
    """The pywebpush send fn + exception, or (None, None) if unavailable."""
    try:
        from pywebpush import WebPushException, webpush

        return webpush, WebPushException
    except Exception:
        return None, None


def push_enabled():
    s = _settings()
    webpush, _exc = _webpush()
    return bool(webpush and (s.get("vapid_public_key") or "").strip() and s.get_password("vapid_private_key", raise_exception=False))


def send_to_user(user, title, body, url="/shop", tag=None):
    """Best-effort push to every subscription of a user. No-ops (and returns 0)
    when push isn't configured or the library is missing. A dead subscription
    (410/404) is pruned."""
    webpush, WebPushException = _webpush()
    if not webpush:
        return 0
    s = _settings()
    private_key = s.get_password("vapid_private_key", raise_exception=False)
    public_key = (s.get("vapid_public_key") or "").strip()
    if not private_key or not public_key:
        return 0
    subject = (s.get("vapid_subject") or "mailto:admin@ovira.cloud").strip()

    subs = frappe.get_all(
        "Marketplace Push Subscription",
        filters={"user": user},
        fields=["name", "endpoint", "p256dh", "auth"],
        ignore_permissions=True,
    )
    payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag or "ovira"})
    sent = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": subject},
            )
            sent += 1
        except Exception as e:  # noqa: BLE001 - prune dead subs, log the rest
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (404, 410):
                frappe.delete_doc(
                    "Marketplace Push Subscription", sub.name, ignore_permissions=True, force=True
                )
            else:
                frappe.log_error(title="Ovira: web push send failed")
    if sent or subs:
        frappe.db.commit()
    return sent

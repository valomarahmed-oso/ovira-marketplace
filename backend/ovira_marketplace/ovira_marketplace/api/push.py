"""Push notifications, over the two transports this store actually has.

**Browsers** get web push (VAPID + ``pywebpush``). **The mobile app** cannot:
web push is a Service Worker mechanism, and a React Native app has no service
worker and no browser endpoint. It carries an Expo push token instead, which is
delivered through Expo's service to APNs/FCM. The two are not interchangeable,
so both are kept and `send_to_user` fans out to whichever the shopper has.

Gated like the other integrations: web push stays a no-op until an operator adds
VAPID keys AND ``pywebpush`` is installed; Expo push needs no keys at all for
tokens issued to a published app. Registrations are always captured so delivery
starts the moment the transport is available. **A push failure must never break
the action that triggered it** — an order is placed whether or not the phone
buzzes."""

import json

import frappe
import requests
from frappe import _
from frappe.utils import now_datetime


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


# -- native app (Expo) ------------------------------------------------------

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
#: Expo accepts up to 100 messages per request; this store will never approach
#: that for one user, but the cap is honoured rather than assumed away.
EXPO_BATCH = 100


@frappe.whitelist()
def register_device(token, platform=None, device_name=None, app_version=None):
    """Store the signed-in shopper's Expo push token, keyed by the token itself.

    Idempotent: the same device re-registering updates `last_seen` rather than
    accumulating rows. The token also MOVES to whoever is signed in now — one
    phone shared by two people must not keep delivering the first person's order
    updates to the second.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw(_("Please sign in."), frappe.PermissionError)

    token = (token or "").strip()
    if not token.startswith(("ExponentPushToken[", "ExpoPushToken[")):
        frappe.throw(_("Invalid push token."))

    name = frappe.db.get_value("Marketplace Device Token", {"token": token}, "name")
    doc = (
        frappe.get_doc("Marketplace Device Token", name)
        if name
        else frappe.new_doc("Marketplace Device Token")
    )
    doc.user = user
    doc.token = token
    doc.platform = (platform or "other").lower()[:20]
    doc.device_name = (device_name or "")[:140]
    doc.app_version = (app_version or "")[:40]
    doc.last_seen = now_datetime()
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"registered": True}


@frappe.whitelist()
def unregister_device(token):
    """Drop a device — on sign-out, or when the shopper turns notifications off."""
    name = frappe.db.get_value("Marketplace Device Token", {"token": (token or "").strip()}, "name")
    if name:
        frappe.delete_doc("Marketplace Device Token", name, ignore_permissions=True, force=True)
        frappe.db.commit()
    return {"unregistered": True}


def read_tickets(tokens, tickets):
    """Split Expo's reply into (accepted count, tokens to delete).

    Kept pure so it can be tested without a site. Two things it must get right:

    * Only `DeviceNotRegistered` means "this phone is gone". Every other error —
      a rate limit, a message-too-big, an Expo outage — is transient, and
      deleting on those would quietly unsubscribe shoppers whose phones are
      fine.
    * A short or missing reply must not be read as failure for the messages it
      simply didn't cover. Zipping tokens to tickets positionally only holds for
      the ones actually returned.
    """
    accepted = 0
    dead = []
    for token, ticket in zip(tokens, tickets or []):
        status = (ticket or {}).get("status")
        if status == "ok":
            accepted += 1
            continue
        if ((ticket or {}).get("details") or {}).get("error") == "DeviceNotRegistered":
            dead.append(token)
    return accepted, dead


def send_expo(user, title, body, url="/shop", tag=None):
    """Best-effort Expo push to every device a user has registered.

    Returns the number accepted. Tokens Expo reports as dead
    (`DeviceNotRegistered`) are pruned, because a phone that has uninstalled the
    app will otherwise be retried forever.
    """
    rows = frappe.get_all(
        "Marketplace Device Token",
        filters={"user": user},
        fields=["name", "token"],
        ignore_permissions=True,
    )
    if not rows:
        return 0

    messages = [
        {
            "to": row.token,
            "title": title,
            "body": body,
            # `url` travels in data, not in the title — the app routes on it
            # when the notification is tapped.
            "data": {"url": url, "tag": tag or "ovira"},
            "sound": "default",
            "channelId": "orders",
        }
        for row in rows
    ]

    sent = 0
    for start in range(0, len(messages), EXPO_BATCH):
        batch = messages[start : start + EXPO_BATCH]
        try:
            res = requests.post(
                EXPO_PUSH_URL,
                json=batch,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=10,
            )
            tickets = (res.json() or {}).get("data") or []
        except Exception:  # noqa: BLE001 — a push must never break its trigger
            frappe.log_error(title="Ovira: expo push send failed")
            continue

        accepted, dead = read_tickets([m["to"] for m in batch], tickets)
        sent += accepted
        for token in dead:
            stale = frappe.db.get_value("Marketplace Device Token", {"token": token}, "name")
            if stale:
                frappe.delete_doc(
                    "Marketplace Device Token", stale, ignore_permissions=True, force=True
                )
    if sent or rows:
        frappe.db.commit()
    return sent


# -- browser (web push) -----------------------------------------------------


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
    """Reach a shopper on whatever they have — browser, phone, or both.

    Neither transport is required and neither blocks the other: someone who only
    ever uses the website gets web push, someone who only has the app gets Expo,
    and a shopper with both is told once on each. Returns the total accepted.
    """
    delivered = 0
    try:
        delivered += send_expo(user, title, body, url=url, tag=tag)
    except Exception:  # noqa: BLE001 — IGNORABLE: the user is unaffected
        frappe.log_error(title="Ovira: expo push fan-out failed")
    try:
        delivered += send_web(user, title, body, url=url, tag=tag)
    except Exception:  # noqa: BLE001
        frappe.log_error(title="Ovira: web push fan-out failed")
    return delivered


def send_web(user, title, body, url="/shop", tag=None):
    """Best-effort web push to every browser subscription of a user. No-ops (and
    returns 0) when push isn't configured or the library is missing. A dead
    subscription (410/404) is pruned."""
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

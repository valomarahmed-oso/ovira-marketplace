"""Operator console for the Ovira Messaging Hub (the `ovira_messaging` app).

The hub owns **all** messaging configuration — numbers, tokens, channels,
per-company senders, the fallback order and the delivery log. This module is a
thin, operator-gated adapter so the marketplace's own branded admin can drive
that hub without handing anyone an ERPNext Desk / System Manager login.

Three rules shape everything here:

* **Secrets are write-only.** A stored credential is never echoed back — the API
  reports `has_secret` and nothing more. Any secret-looking key an operator
  pastes into the free-form config JSON is redacted on the way out too, so a
  token can't leak through the one field that accepts arbitrary text.
* **The hub is optional.** Every endpoint feature-detects it, so the marketplace
  behaves identically on a bench where `ovira_messaging` isn't installed — the
  admin page just reports "not installed" instead of erroring.
* **We depend on the hub's doctypes, not its private Python.** The schema is the
  stable contract; `Ovira Message Sender` / `Ovira Message Log` / `Ovira
  Messaging Settings` are read directly. The one exception is the send path,
  flagged at `_hub_dispatch`.

`probe_sender` is the "fetch from the provider" action: it asks the live
provider what it knows about itself (WAHA sessions and their connection state,
the WhatsApp Business display name, the Telegram bot identity, an SMTP
handshake) using the stored credential, and returns only non-sensitive facts.
"""

import json

import frappe
import requests
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint
from frappe.utils.password import get_decrypted_password

from ovira_marketplace.api.admin import _require_operator

HUB_APP = "shop"
"""The `app` id the marketplace stamps on every hub call, so the hub's log is
readable and senders can be routed per app later."""

SENDER_DT = "Ovira Message Sender"
LOG_DT = "Ovira Message Log"
SETTINGS_DT = "Ovira Messaging Settings"

PROBE_TIMEOUT = 15

# Which cred key the (encrypted) Secret field maps to, per channel. Mirrors the
# hub's own map — kept local so we depend on the doctype, not a private symbol.
SECRET_KEY = {
    "email": "password",
    "telegram": "bot_token",
    "whatsapp_waha": "api_key",
    "whatsapp_official": "token",
    "sms_http": "auth_value",
    "sms_twilio": "auth_token",
}

# Free-form config JSON is operator-authored, so a token may well end up in it by
# mistake. Any key containing one of these is masked before it leaves the server.
_SECRET_HINTS = ("token", "key", "secret", "password", "passwd", "auth", "credential", "sid")

MASK = "••••••••"

SENDER_FIELDS = [
    "name",
    "sender_name",
    "channel",
    "enabled",
    "is_default",
    "company",
    "app_source",
    "priority",
    "config_json",
]


# -- hub availability -------------------------------------------------------


def hub_installed():
    """True when the messaging hub's doctypes exist on this site. Safe to call
    anywhere — a bench without the hub just gets False."""
    try:
        return bool(frappe.db.exists("DocType", SENDER_DT))
    except Exception:
        return False


def _require_hub():
    if not hub_installed():
        frappe.throw(
            _("تطبيق الرسائل (Ovira Messaging) غير مثبّت على هذا الخادم."),
            frappe.DoesNotExistError,
        )


def _channel_catalog():
    """[{id, label, family, needs, supports_attachments}] from the hub's own
    registry, or [] when the hub isn't installed."""
    try:
        from ovira_messaging.messaging import registry

        return registry.channels()
    except Exception:
        return []


# -- secrets ----------------------------------------------------------------


def _parse_config(raw):
    try:
        cfg = json.loads(raw or "{}")
        return cfg if isinstance(cfg, dict) else {}
    except Exception:
        return {}


def _is_secretish(key):
    low = str(key or "").lower()
    return any(hint in low for hint in _SECRET_HINTS)


def _redact_config(cfg):
    """Config safe to send to the browser: every secret-looking value masked.
    Returns (redacted_dict, [masked_keys])."""
    out, masked = {}, []
    for key, value in (cfg or {}).items():
        if _is_secretish(key) and value not in (None, "", 0):
            out[key] = MASK
            masked.append(key)
        else:
            out[key] = value
    return out, masked


def _stored_secret(sender_name):
    return get_decrypted_password(SENDER_DT, sender_name, "secret", raise_exception=False)


def _cred_for(sender_name, channel, config):
    """The full credential dict a provider needs: the non-secret config plus the
    decrypted secret under the key that channel expects. Never leaves the server."""
    cred = dict(config or {})
    secret = _stored_secret(sender_name)
    if secret:
        cred[SECRET_KEY.get(channel, "secret")] = secret
    return cred


# -- shaping ----------------------------------------------------------------


def _sender_shape(row, meta_by_id):
    config = _parse_config(row.get("config_json"))
    redacted, masked = _redact_config(config)
    meta = meta_by_id.get(row.get("channel")) or {}
    return {
        "name": row.get("name"),
        "sender_name": row.get("sender_name"),
        "channel": row.get("channel"),
        "channel_label": meta.get("label") or row.get("channel"),
        "family": meta.get("family"),
        "supports_attachments": bool(meta.get("supports_attachments")),
        "needs": meta.get("needs") or [],
        "enabled": cint(row.get("enabled")),
        "is_default": cint(row.get("is_default")),
        "company": row.get("company"),
        "app_source": row.get("app_source"),
        "priority": cint(row.get("priority")),
        "config": redacted,
        "masked_config_keys": masked,
        # Write-only: whether a credential is stored, never the credential.
        "has_secret": bool(_stored_secret(row.get("name"))),
        "can_probe": row.get("channel") in _PROBES,
    }


# -- endpoints: status + senders --------------------------------------------


@frappe.whitelist()
def hub_status():
    """Everything the admin page needs to render its header: is the hub there,
    what channels does it know, how is fallback ordered, and how many senders
    are live. Never throws for a missing hub — reports it."""
    _require_operator()
    if not hub_installed():
        return {"installed": False, "channels": [], "senders": 0, "enabled_senders": 0}

    settings = {}
    try:
        doc = frappe.get_single(SETTINGS_DT)
        settings = {
            "enable_logging": cint(doc.get("enable_logging")),
            "fallback_family_order": doc.get("fallback_family_order")
            or "whatsapp,telegram,sms,email",
            "has_api_key": bool(
                get_decrypted_password(SETTINGS_DT, SETTINGS_DT, "api_key", raise_exception=False)
            ),
        }
    except Exception:
        settings = {}

    total = frappe.db.count(SENDER_DT)
    enabled = frappe.db.count(SENDER_DT, {"enabled": 1})
    families = frappe.get_all(
        SENDER_DT, filters={"enabled": 1}, pluck="channel", ignore_permissions=True
    )
    catalog = _channel_catalog()
    fam_by_channel = {c["id"]: c["family"] for c in catalog}
    return {
        "installed": True,
        "channels": catalog,
        "senders": total,
        "enabled_senders": enabled,
        "live_families": sorted({fam_by_channel.get(c) for c in families if fam_by_channel.get(c)}),
        "app": HUB_APP,
        **settings,
    }


@frappe.whitelist()
def list_senders():
    """Every configured sender, secrets stripped."""
    _require_operator()
    _require_hub()
    rows = frappe.get_all(
        SENDER_DT,
        fields=SENDER_FIELDS,
        order_by="channel asc, priority asc, sender_name asc",
        limit_page_length=0,
        ignore_permissions=True,
    )
    meta_by_id = {c["id"]: c for c in _channel_catalog()}
    return [_sender_shape(r, meta_by_id) for r in rows]


@frappe.whitelist()
def upsert_sender(
    name=None,
    sender_name=None,
    channel=None,
    enabled=None,
    is_default=None,
    company=None,
    app_source=None,
    priority=None,
    config=None,
    secret=None,
):
    """Create or update a sender.

    `secret` is write-only: it is stored only when a fresh non-empty value is
    supplied, so saving any other field never wipes the credential. Likewise a
    config value that comes back as the mask is treated as "unchanged" — the UI
    round-trips masked values, and we must not persist the mask itself.
    """
    _require_operator()
    _require_hub()

    incoming = config if isinstance(config, dict) else _parse_config(config)

    if name:
        doc = frappe.get_doc(SENDER_DT, name)
    else:
        if not (sender_name and channel):
            frappe.throw(_("اسم المرسِل والقناة مطلوبان."))
        doc = frappe.new_doc(SENDER_DT)
        doc.sender_name = sender_name
        doc.channel = channel

    if sender_name and name:
        doc.sender_name = sender_name
    if channel and name:
        doc.channel = channel
    if enabled is not None:
        doc.enabled = cint(enabled)
    if is_default is not None:
        doc.is_default = cint(is_default)
    if priority is not None:
        doc.priority = cint(priority)
    # Blank clears the scope (blank = serves every company / every app).
    if company is not None:
        doc.company = company or None
    if app_source is not None:
        doc.app_source = app_source or None

    if incoming:
        current = _parse_config(doc.config_json)
        merged = dict(current)
        for key, value in incoming.items():
            # A masked value means "leave what's stored" — never persist the mask.
            if value == MASK:
                continue
            merged[key] = value
        doc.config_json = json.dumps(merged, ensure_ascii=False, indent=2)

    if secret:
        doc.secret = secret

    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    meta_by_id = {c["id"]: c for c in _channel_catalog()}
    row = frappe.db.get_value(SENDER_DT, doc.name, SENDER_FIELDS, as_dict=True)
    return _sender_shape(row, meta_by_id)


@frappe.whitelist()
def delete_sender(name):
    _require_operator()
    _require_hub()
    if not frappe.db.exists(SENDER_DT, name):
        frappe.throw(_("المرسِل غير موجود."), frappe.DoesNotExistError)
    frappe.delete_doc(SENDER_DT, name, ignore_permissions=True, force=True)
    frappe.db.commit()
    return {"ok": True}


# -- endpoints: probe -------------------------------------------------------


def _probe_whatsapp_waha(cred):
    """Ask a self-hosted WAHA container which sessions it has and whether each
    is actually connected to WhatsApp. This is the 'fetch from the provider'
    payload the operator sees."""
    base = (cred.get("base_url") or "").rstrip("/")
    if not base:
        return {"ok": False, "error": "base_url غير مضبوط."}
    res = requests.get(
        base + "/api/sessions",
        headers={"X-Api-Key": cred.get("api_key") or ""},
        timeout=PROBE_TIMEOUT,
    )
    if res.status_code >= 400:
        return {"ok": False, "error": "HTTP {0}".format(res.status_code)}
    rows = res.json() if res.content else []
    if isinstance(rows, dict):
        rows = rows.get("sessions") or [rows]
    sessions = []
    for s in rows or []:
        me = s.get("me") or {}
        sessions.append(
            {
                "session": s.get("name"),
                "status": s.get("status"),
                # WORKING is the only state that can actually send.
                "connected": (s.get("status") or "").upper() == "WORKING",
                "number": (me.get("id") or "").split("@")[0] or None,
                "display_name": me.get("pushName"),
            }
        )
    return {
        "ok": True,
        "summary": _("{0} جلسة").format(len(sessions)),
        "sessions": sessions,
    }


def _probe_telegram(cred):
    token = cred.get("bot_token")
    if not token:
        return {"ok": False, "error": "bot_token غير مخزَّن."}
    res = requests.get(
        "https://api.telegram.org/bot{0}/getMe".format(token), timeout=PROBE_TIMEOUT
    )
    data = res.json() if res.content else {}
    if not data.get("ok"):
        return {"ok": False, "error": data.get("description") or "HTTP {0}".format(res.status_code)}
    bot = data.get("result") or {}
    return {
        "ok": True,
        "summary": "@{0}".format(bot.get("username") or "?"),
        "bot": {
            "username": bot.get("username"),
            "name": bot.get("first_name"),
            "id": bot.get("id"),
        },
    }


def _probe_whatsapp_official(cred):
    token = cred.get("token")
    phone_id = cred.get("phone_id")
    if not (token and phone_id):
        return {"ok": False, "error": "phone_id أو token غير مضبوط."}
    version = cred.get("version") or "v21.0"
    res = requests.get(
        "https://graph.facebook.com/{0}/{1}".format(version, phone_id),
        params={"fields": "verified_name,display_phone_number,quality_rating"},
        headers={"Authorization": "Bearer {0}".format(token)},
        timeout=PROBE_TIMEOUT,
    )
    data = res.json() if res.content else {}
    if res.status_code >= 400:
        return {"ok": False, "error": ((data.get("error") or {}).get("message")) or "HTTP {0}".format(res.status_code)}
    return {
        "ok": True,
        "summary": data.get("verified_name") or data.get("display_phone_number") or "OK",
        "number": {
            "verified_name": data.get("verified_name"),
            "display_phone_number": data.get("display_phone_number"),
            "quality_rating": data.get("quality_rating"),
        },
    }


def _probe_email(cred):
    """An SMTP handshake — connect, STARTTLS if asked, and log in. Proves the
    credential without sending anything."""
    import smtplib

    host = cred.get("host")
    if not host:
        return {"ok": False, "error": "host غير مضبوط."}
    port = cint(cred.get("port")) or 587
    # JSON config may carry a real bool, 0/1, or the string "false" — treat the
    # textual falsey values as false rather than as a non-empty (truthy) string.
    raw_tls = cred.get("use_tls")
    if raw_tls is None:
        use_tls = True
    elif isinstance(raw_tls, str):
        use_tls = raw_tls.strip().lower() not in ("", "0", "false", "no")
    else:
        use_tls = bool(raw_tls)
    server = None
    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=PROBE_TIMEOUT)
        else:
            server = smtplib.SMTP(host, port, timeout=PROBE_TIMEOUT)
            if use_tls:
                server.starttls()
        username = cred.get("username") or cred.get("from_addr")
        password = cred.get("password")
        if username and password:
            server.login(username, password)
            return {"ok": True, "summary": _("تم تسجيل الدخول إلى {0}").format(host),
                    "smtp": {"host": host, "port": port, "authenticated": True}}
        return {"ok": True, "summary": _("الاتصال بـ {0} ناجح").format(host),
                "smtp": {"host": host, "port": port, "authenticated": False}}
    finally:
        try:
            if server:
                server.quit()
        except Exception:
            pass


def _probe_sms_twilio(cred):
    sid = cred.get("account_sid")
    token = cred.get("auth_token")
    if not (sid and token):
        return {"ok": False, "error": "account_sid أو auth_token غير مضبوط."}
    res = requests.get(
        "https://api.twilio.com/2010-04-01/Accounts/{0}.json".format(sid),
        auth=(sid, token),
        timeout=PROBE_TIMEOUT,
    )
    data = res.json() if res.content else {}
    if res.status_code >= 400:
        return {"ok": False, "error": data.get("message") or "HTTP {0}".format(res.status_code)}
    return {
        "ok": True,
        "summary": data.get("friendly_name") or data.get("status") or "OK",
        "account": {"friendly_name": data.get("friendly_name"), "status": data.get("status")},
    }


_PROBES = {
    "whatsapp_waha": _probe_whatsapp_waha,
    "telegram": _probe_telegram,
    "whatsapp_official": _probe_whatsapp_official,
    "email": _probe_email,
    "sms_twilio": _probe_sms_twilio,
    # sms_http is a generic user-defined HTTP endpoint — there's nothing
    # standard to interrogate, so it deliberately has no probe.
}


@frappe.whitelist()
@rate_limit(limit=30, seconds=60 * 10, methods="POST")
def probe_sender(name):
    """Fetch live data from the sender's provider using the stored credential.

    Read-only against the provider: it lists WAHA sessions, resolves the
    WhatsApp Business number, identifies the Telegram bot, or completes an SMTP
    login. Nothing is sent, and the credential never appears in the response —
    only the facts the provider reports about itself.
    """
    _require_operator()
    _require_hub()
    row = frappe.db.get_value(
        SENDER_DT, name, ["name", "channel", "config_json"], as_dict=True
    )
    if not row:
        frappe.throw(_("المرسِل غير موجود."), frappe.DoesNotExistError)

    probe = _PROBES.get(row.channel)
    if not probe:
        return {
            "ok": False,
            "channel": row.channel,
            "unsupported": True,
            "error": _("لا يوجد فحص متاح لهذه القناة."),
        }

    cred = _cred_for(row.name, row.channel, _parse_config(row.config_json))
    try:
        result = probe(cred)
    except requests.Timeout:
        result = {"ok": False, "error": _("انتهت مهلة الاتصال بالمزوّد.")}
    except Exception as exc:
        # Provider errors can embed the URL or credential — keep the class and a
        # short message, never the raw payload.
        result = {"ok": False, "error": "{0}: {1}".format(type(exc).__name__, str(exc)[:200])}
    result["channel"] = row.channel
    return result


# -- endpoints: test send + log ---------------------------------------------


def _hub_dispatch(channel, recipient, body, subject, company):
    """Send through the hub, naming the channel explicitly (no fallback).

    NOTE: this reaches for the hub's internal `_dispatch` rather than its public
    `api.send`, because `api.send` re-authenticates as System Manager or the hub
    API key — neither of which a Marketplace Operator has. Authorization already
    happened here, and more strictly. If the hub ever drops `_dispatch` we fall
    back to the public call, which still works for a System Manager.
    """
    from ovira_messaging import api as hub_api

    dispatch = getattr(hub_api, "_dispatch", None)
    if callable(dispatch):
        return dispatch(channel, None, recipient, body, subject, None, company, HUB_APP, None, None)
    return hub_api.send(
        recipient=recipient, body=body, subject=subject, channel=channel,
        company=company, app=HUB_APP,
    )


def _family_channels(family):
    return [c["id"] for c in _channel_catalog() if c["family"] == family]


def has_sender(family=None, channel=None):
    """True when the hub has an enabled sender that could serve this request.

    Callers use it to decide whether to route through the hub at all, so a
    marketplace notification never waits on a hub that has nothing configured.
    """
    if not hub_installed():
        return False
    filters = {"enabled": 1}
    if channel:
        filters["channel"] = channel
    elif family:
        channels = _family_channels(family)
        if not channels:
            return False
        filters["channel"] = ["in", channels]
    try:
        return bool(frappe.db.count(SENDER_DT, filters))
    except Exception:
        return False


def deliver(recipient, body, subject=None, family="whatsapp", company=None,
            reference_doctype=None, reference_name=None):
    """INTERNAL — not whitelisted. Best-effort send through the shared hub.

    Returns True only when the hub actually accepted the message, so a caller
    can fall back to its own direct integration on False. Never raises: a
    messaging hiccup must not break the order or return it accompanies.
    """
    if not (recipient and body) or not has_sender(family=family):
        return False
    try:
        from ovira_messaging import api as hub_api

        dispatch = getattr(hub_api, "_dispatch", None)
        if not callable(dispatch):
            return False
        result = dispatch(
            None, family, recipient, body, subject, None, company, HUB_APP,
            reference_doctype, reference_name,
        )
        return bool(result and result.get("ok"))
    except Exception:
        frappe.log_error(title="Ovira: messaging hub delivery failed")
        return False


@frappe.whitelist()
@rate_limit(limit=20, seconds=60 * 10, methods="POST")
def send_test(recipient, body=None, sender=None, channel=None, subject=None, company=None):
    """Send one test message so the operator can prove a sender end-to-end.

    Either name a `sender` (its channel is used) or a `channel` directly. The
    attempt is written to the hub's log like any other send.
    """
    _require_operator()
    _require_hub()

    recipient = (recipient or "").strip()
    if not recipient:
        frappe.throw(_("أدخل المستلم (رقم أو بريد)."))

    if sender and not channel:
        channel = frappe.db.get_value(SENDER_DT, sender, "channel")
        if not channel:
            frappe.throw(_("المرسِل غير موجود."), frappe.DoesNotExistError)
    if not channel:
        frappe.throw(_("اختر قناة أو مرسِلاً."))

    body = (body or "").strip() or _("رسالة اختبار من متجر أوفيرا ✅")
    result = _hub_dispatch(channel, recipient, body, subject, company)
    return {
        "ok": bool(result.get("ok")),
        "status": result.get("status"),
        "error": result.get("error"),
        "channel": result.get("channel") or channel,
        "sender": result.get("sender"),
        "id": result.get("id"),
    }


@frappe.whitelist()
def message_log(limit=50, status=None, channel=None, app_only=0):
    """Recent delivery attempts from the hub's log, newest first.

    `app_only` narrows to messages the marketplace itself sent (`app_source`
    = 'shop'); by default the operator sees every app on the hub, which is the
    point of a shared hub.
    """
    _require_operator()
    _require_hub()

    filters = {}
    if status:
        filters["status"] = status
    if channel:
        filters["channel"] = channel
    if cint(app_only):
        filters["app_source"] = HUB_APP

    rows = frappe.get_all(
        LOG_DT,
        filters=filters,
        fields=[
            "name", "channel", "sender", "recipient", "subject", "status",
            "message_id", "company", "app_source", "reference_doctype",
            "reference_name", "error", "creation",
        ],
        order_by="creation desc",
        limit_page_length=min(cint(limit) or 50, 200),
        ignore_permissions=True,
    )
    for r in rows:
        r["creation"] = str(r["creation"])
        # A recipient is personal data; the operator needs to recognise it, not
        # harvest it. Show enough to match a customer, not the full address.
        r["recipient"] = _mask_recipient(r.get("recipient"))
    return rows


def _mask_recipient(value):
    """Keep a recipient recognisable without printing it in full."""
    val = str(value or "")
    if not val:
        return val
    if "@" in val:
        # Deliberately not unpacking with `_` — that name is Frappe's translator.
        user, domain = val.split("@", 1)
        head = user[:2] if len(user) > 3 else user[:1]
        return "{0}{1}@{2}".format(head, "•" * 4, domain)
    if len(val) > 5:
        return "{0}{1}{2}".format(val[:3], "•" * 4, val[-2:])
    return val

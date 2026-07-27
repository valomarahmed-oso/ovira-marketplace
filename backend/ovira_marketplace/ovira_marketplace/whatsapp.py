"""The store's own WhatsApp Business (Meta Cloud API) configuration.

Sending moved to the notification engine, which routes WhatsApp through the
shared messaging hub. What remains here is this store's Meta credentials — read
by the admin console, and importable into the hub as a sender — plus the number
normalisation and the plain-text hub send the OTP/back-office paths still use.
"""

import frappe


def _config():
    try:
        return frappe.get_cached_doc("Marketplace WhatsApp Settings")
    except Exception:
        return None


def whatsapp_configured():
    """True only when a send could actually go out, so we never build a request
    that will just fail."""
    cfg = _config()
    return bool(
        cfg
        and cfg.enabled
        and cfg.phone_number_id
        and cfg.get_password("access_token", raise_exception=False)
    )


def _normalize(phone, default_cc):
    """WhatsApp wants a bare international number (digits only, no +/spaces)."""
    if not phone:
        return None
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if not digits:
        return None
    cc = "".join(ch for ch in str(default_cc or "") if ch.isdigit())
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0") and cc:
        digits = cc + digits[1:]
    elif cc and not digits.startswith(cc) and len(digits) <= 10:
        digits = cc + digits
    return digits


DEFAULT_CC = "20"  # Egypt — matches the WhatsApp Settings doctype default.


def _hub_text(to, text, reference_name=None):
    """Deliver plain text through the shared Ovira Messaging hub.

    This is the FALLBACK transport, used only when the store's own Meta
    integration isn't live (`whatsapp_configured()` is False). Keeping the
    store's own path first means an operator who already set up approved
    templates keeps exactly the behaviour they had — the hub only picks up
    stores that never configured WhatsApp here, which is the whole benefit:
    configure one WAHA session in the hub and every Ovira app can send.

    Returns True when the hub accepted the message. Never raises.

    NOTE: the hub sends plain text. That's right for WAHA, but the official
    Cloud API only allows free-form text inside the 24-hour customer-service
    window; outside it a template is required. Operators on the official API
    should configure `Marketplace WhatsApp Settings` (templates) instead.
    """
    cfg = _config()
    number = _normalize(to, (cfg.default_country_code if cfg else None) or DEFAULT_CC)
    if not number:
        return False
    try:
        from ovira_marketplace.api.messaging_hub import deliver

        return deliver(
            number,
            text,
            family="whatsapp",
            reference_doctype="Marketplace Order" if reference_name else None,
            reference_name=reference_name,
        )
    except Exception:
        frappe.log_error(title="Ovira: WhatsApp hub bridge failed")
        return False



"""Transactional WhatsApp notifications (order + return lifecycle).

Mirrors the email layer: every send is best-effort and gated on the operator
having configured the WhatsApp Business API (Meta Cloud API) + approved
templates. Until then these silently no-op — nothing breaks, in-app + email
notifications still fire. A send failure never blocks the order/return it
accompanies.

Meta Cloud API template message:
  POST {api_base}/{phone_number_id}/messages
  Authorization: Bearer {access_token}
  { messaging_product: whatsapp, to, type: template,
    template: { name, language: {code}, components: [{type: body, parameters:[...]}] } }
"""

import frappe
from frappe.utils import flt

# Single source of truth for the store name across every channel.
from ovira_marketplace.emails import STORE_NAME

ORDER_STATUS_LABEL = {
    "Paid": "تم استلام الدفع",
    "Processing": "قيد التجهيز",
    "Shipped": "تم الشحن",
    "Completed": "تم التسليم",
    "Cancelled": "أُلغي",
}

RETURN_STATUS_LABEL = {
    "Approved": "تمت الموافقة",
    "Rejected": "مرفوض",
    "Completed": "تم الإرجاع",
}


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


def _send_template(to, template_name, params):
    """Best-effort template send. No-ops unless fully configured."""
    cfg = _config()
    if not (cfg and cfg.enabled and template_name):
        return
    token = cfg.get_password("access_token", raise_exception=False)
    number = _normalize(to, cfg.default_country_code)
    if not (cfg.phone_number_id and token and number):
        return
    try:
        import requests

        base = (cfg.api_base or "https://graph.facebook.com/v21.0").rstrip("/")
        url = f"{base}/{cfg.phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": number,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": cfg.template_lang or "ar"},
                "components": [
                    {
                        "type": "body",
                        "parameters": [{"type": "text", "text": str(p)} for p in params],
                    }
                ],
            },
        }
        requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except Exception:
        frappe.log_error(title="Ovira: WhatsApp send failed")


def notify_order_confirmation(order):
    amount = f"{flt(order.total):g} {order.currency or ''}".strip()
    if whatsapp_configured():
        _send_template(order.get("phone"), _config().template_order_confirmation, [order.name, amount])
        return
    _hub_text(
        order.get("phone"),
        f"تم استلام طلبك {order.name} بقيمة {amount}. شكرًا لثقتك في {STORE_NAME} 🎉",
        reference_name=order.name,
    )


def notify_order_status(order):
    label = ORDER_STATUS_LABEL.get(order.status)
    if not label:
        return
    if whatsapp_configured():
        _send_template(order.get("phone"), _config().template_order_status, [order.name, label])
        return
    _hub_text(
        order.get("phone"),
        f"تحديث على طلبك {order.name}: {label}.",
        reference_name=order.name,
    )


def notify_return_update(phone, order_name, status):
    label = RETURN_STATUS_LABEL.get(status)
    if not label:
        return
    if whatsapp_configured():
        _send_template(phone, _config().template_return_update, [order_name, label])
        return
    _hub_text(
        phone,
        f"تحديث على طلب الإرجاع الخاص بالطلب {order_name}: {label}.",
        reference_name=order_name,
    )


def notify_delivery_otp(order, otp):
    """Send the buyer their delivery confirmation code over WhatsApp."""
    if whatsapp_configured():
        _send_template(order.get("phone"), _config().get("template_delivery_otp"), [order.name, str(otp)])
        return
    _hub_text(
        order.get("phone"),
        f"كود تأكيد استلام طلبك {order.name} هو: {otp}\nلا تشاركه إلا مع مندوب التسليم.",
        reference_name=order.name,
    )

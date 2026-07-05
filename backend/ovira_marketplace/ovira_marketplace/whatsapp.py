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
    cfg = _config()
    if not cfg:
        return
    ccy = order.currency or ""
    _send_template(
        order.get("phone"),
        cfg.template_order_confirmation,
        [order.name, f"{flt(order.total):g} {ccy}".strip()],
    )


def notify_order_status(order):
    cfg = _config()
    if not cfg:
        return
    label = ORDER_STATUS_LABEL.get(order.status)
    if not label:
        return
    _send_template(order.get("phone"), cfg.template_order_status, [order.name, label])


def notify_return_update(phone, order_name, status):
    cfg = _config()
    if not cfg:
        return
    label = RETURN_STATUS_LABEL.get(status)
    if not label:
        return
    _send_template(phone, cfg.template_return_update, [order_name, label])


def notify_delivery_otp(order, otp):
    """Send the buyer their delivery confirmation code over WhatsApp."""
    cfg = _config()
    if not cfg:
        return
    _send_template(order.get("phone"), cfg.get("template_delivery_otp"), [order.name, str(otp)])

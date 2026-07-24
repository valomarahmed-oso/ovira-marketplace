"""Transactional emails for the storefront (order + return lifecycle).

Every send is best-effort and gated on the site actually having outgoing email
configured — until an operator adds a default outgoing Email Account in ERPNext
Desk, these silently no-op (in-app notifications still fire). A send failure
must never break the order/return it accompanies.
"""

import frappe
from frappe.utils import flt

STORE_NAME = "أوفيرا"

ORDER_STATUS_SUBJECT = {
    "Paid": "تم استلام دفع طلبك",
    "Processing": "طلبك قيد التجهيز",
    "Shipped": "تم شحن طلبك",
    "Completed": "تم تسليم طلبك",
    "Cancelled": "تم إلغاء طلبك",
}

RETURN_STATUS_SUBJECT = {
    "Approved": "تمت الموافقة على طلب الإرجاع",
    "Rejected": "تم رفض طلب الإرجاع",
    "Completed": "تم إتمام الإرجاع",
}


def outgoing_configured():
    """True only when the site can actually send mail, so we don't enqueue mail
    that will just fail. Cached per request."""
    if frappe.conf.get("mail_server"):
        return True
    return bool(
        frappe.db.get_value(
            "Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
        )
    )


def _valid_recipient(email):
    return email if email and "@" in email else None


def _send(recipient, subject, body):
    recipient = _valid_recipient(recipient)
    if not recipient or not outgoing_configured():
        return
    try:
        frappe.sendmail(
            recipients=[recipient],
            subject=f"{subject} | {STORE_NAME}",
            message=body,
            now=False,
        )
    except Exception:
        frappe.log_error(title="Ovira: email send failed")


def _shell(heading, lines):
    rows = "".join(f"<p style='margin:6px 0;color:#444'>{ln}</p>" for ln in lines)
    return (
        "<div dir='rtl' style='font-family:Tahoma,Arial,sans-serif;font-size:14px;"
        "line-height:1.9;color:#222'>"
        f"<h2 style='color:#1a56db;margin:0 0 12px'>{heading}</h2>{rows}"
        f"<hr style='border:none;border-top:1px solid #eee;margin:16px 0'>"
        f"<p style='color:#999;font-size:12px'>{STORE_NAME}</p></div>"
    )


def _order_lines(order):
    ccy = order.currency or ""
    lines = [f"رقم الطلب: <b>{order.name}</b>"]
    if flt(order.discount_amount):
        lines.append(f"الخصم: {flt(order.discount_amount):g} {ccy}")
    lines.append(f"الإجمالي: <b>{flt(order.total):g} {ccy}</b>")
    return lines


def send_order_confirmation(order):
    _send(
        order.email,
        f"تأكيد طلبك {order.name}",
        _shell("تم استلام طلبك 🎉", _order_lines(order) + ["هنبلّغك بأي تحديث على حالة الطلب."]),
    )


def send_order_status(order):
    subject = ORDER_STATUS_SUBJECT.get(order.status)
    if not subject:
        return
    _send(order.email, f"{subject} — {order.name}", _shell(subject, _order_lines(order)))


def send_delivery_otp(order, otp):
    """Email the buyer their delivery confirmation code."""
    _send(
        order.email,
        f"رمز تأكيد استلام طلبك {order.name}",
        _shell(
            "رمز تأكيد الاستلام",
            [
                f"طلبك <b>{order.name}</b> في الطريق إليك.",
                f"رمز الاستلام: <b style='font-size:20px;letter-spacing:3px'>{otp}</b>",
                "أعطِ هذا الرمز لمندوب التوصيل عند استلام طلبك فقط.",
            ],
        ),
    )


def send_operator_report(recipient, report):
    """Weekly performance digest for an operator. `report` is the dict from
    reports.full_report."""
    s = report.get("summary", {})
    ccy = report.get("currency", "")
    lines = [
        f"الفترة: {report.get('from_date')} → {report.get('to_date')}",
        f"الإيرادات: <b>{flt(s.get('revenue')):g} {ccy}</b>",
        f"الطلبات المدفوعة: <b>{int(s.get('paid_orders') or 0)}</b>",
        f"متوسط قيمة الطلب: {flt(s.get('aov')):g} {ccy}",
        f"إجمالي الطلبات: {int(s.get('orders') or 0)}",
    ]
    top = report.get("top_products") or []
    if top:
        lines.append("<br><b>أفضل المنتجات:</b>")
        for r in top[:5]:
            lines.append(f"• {r.get('title')} — {int(r.get('qty') or 0)} قطعة")
    _send(recipient, "تقرير أداء المتجر الأسبوعي", _shell("تقرير الأداء الأسبوعي", lines))


def send_abandoned_cart(cart):
    """Gentle reminder for a cart left behind. `cart` is a dict/row with email,
    customer_name, subtotal, currency."""
    import json as _json

    try:
        count = len(_json.loads(cart.get("cart_json") or "[]"))
    except (ValueError, TypeError):
        count = 0
    name = cart.get("customer_name") or ""
    ccy = cart.get("currency") or ""
    hello = f"أهلاً {name}،" if name else "أهلاً،"
    lines = [
        hello,
        "سيبت منتجات في سلة التسوق ولسه ما أكملتش الطلب.",
    ]
    if count:
        lines.append(f"عندك <b>{count}</b> منتج مستنيك في السلة.")
    if flt(cart.get("subtotal")):
        lines.append(f"إجمالي السلة: <b>{flt(cart.get('subtotal')):g} {ccy}</b>")
    lines.append(
        "<a href='/shop/cart' style='display:inline-block;margin-top:8px;"
        "background:#1a56db;color:#fff;padding:10px 18px;border-radius:8px;"
        "text-decoration:none'>أكمل طلبك الآن</a>"
    )
    _send(cart.get("email"), "سلة التسوق مستنياك 🛒", _shell("منتجاتك في انتظارك", lines))


def send_return_update(order_email, order_name, status, note=None):
    subject = RETURN_STATUS_SUBJECT.get(status)
    if not subject:
        return
    lines = [f"طلب الإرجاع الخاص بالطلب <b>{order_name}</b>."]
    if note:
        lines.append(f"ملاحظة المتجر: {note}")
    _send(order_email, subject, _shell(subject, lines))

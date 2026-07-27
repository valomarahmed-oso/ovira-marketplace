"""Email plumbing the notification engine builds on, plus the operator digest.

The per-event customer emails that used to live here now come from
`notifications/events.py` (one bilingual definition per event, rendered by
`notifications/channels.py`) — keeping a second copy of that wording here is how
the two drift apart. What stays is the shared shell, the "can this site send at
all?" check, and the weekly operator report, which is a document, not an event.
"""

import frappe
from frappe.utils import flt

STORE_NAME = "أوفيرا"


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



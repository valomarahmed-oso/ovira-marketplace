"""Cash-on-delivery risk screening.

COD is the default in Egypt and it is where a marketplace bleeds money: fake
orders, serial refusers, and one buyer stacking many undelivered orders at once.
Every shipment that comes back is paid-for logistics against zero revenue.

This module scores a COD order **before** it is created, from signals the
marketplace already has — no external service, no personal data leaving the box:

* an explicit operator blocklist (phone or email),
* how many COD orders this buyer already has in flight,
* their historical refusal rate (orders cancelled after they were shipped),
* the order value, with a tighter ceiling for a first-time buyer,
* an obviously invalid phone number.

The outcome is one of three, and the default is deliberately the middle one:

    allow   → proceed silently
    review  → create the order but flag it, so a human calls before dispatch
    block   → refuse COD and ask for prepayment instead

**Blocking a real customer costs more than screening a fraudulent one**, so only
the blocklist and a hard value ceiling block outright; everything else flags for
review. The whole thing is inert until the operator switches it on.
"""

import frappe
from frappe import _
from frappe.utils import cint, flt

from ovira_marketplace.marketplace.doctype.marketplace_cod_blocklist.marketplace_cod_blocklist import (
    normalise_phone,
)
from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)

BLOCKLIST_DT = "Marketplace COD Blocklist"
ORDER_DT = "Marketplace Order"

# Still on the hook: shipped but not delivered, or awaiting dispatch.
OPEN_STATUSES = ("Pending Payment", "Paid", "Processing", "Shipped")

# A refusal = we shipped it and it ended cancelled.
REFUSED_STATUSES = ("Cancelled",)


def _cod_order_filters(phone, email):
    """Match this buyer's past orders by either identifier they used."""
    or_filters = []
    if email:
        or_filters.append(["email", "=", email])
    if phone:
        or_filters.append(["phone", "=", phone])
    return or_filters


def is_blocked(phone, email):
    """True when the operator has explicitly barred this buyer from COD."""
    digits = normalise_phone(phone)
    checks = []
    if digits:
        checks.append(digits)
    if email:
        checks.append(str(email).strip().lower())
    if not checks:
        return False
    return bool(
        frappe.db.exists(BLOCKLIST_DT, {"identifier": ["in", checks], "active": 1})
    )


def _history(phone, email):
    """(open COD orders, delivered, refused) for this buyer."""
    or_filters = _cod_order_filters(phone, email)
    if not or_filters:
        return 0, 0, 0

    rows = frappe.get_all(
        ORDER_DT,
        or_filters=or_filters,
        fields=["status", "payment_method"],
        limit_page_length=500,
        ignore_permissions=True,
    )
    open_cod = delivered = refused = 0
    for r in rows:
        is_cod = (r.payment_method or "").lower() in ("cod", "cash on delivery")
        if not is_cod:
            continue
        if r.status in OPEN_STATUSES:
            open_cod += 1
        elif r.status == "Completed":
            delivered += 1
        elif r.status in REFUSED_STATUSES:
            refused += 1
    return open_cod, delivered, refused


def assess(phone=None, email=None, amount=0, settings=None):
    """Score a prospective COD order. Pure read — never writes, never throws.

    Returns {decision, score, reasons, open_orders, refused, delivered}.
    `reasons` are translated strings safe to show an operator (not the shopper —
    telling a fraudster exactly which rule caught them just teaches them to
    route around it).
    """
    settings = settings or get_settings()
    result = {
        "decision": "allow",
        "score": 0,
        "reasons": [],
        "open_orders": 0,
        "refused": 0,
        "delivered": 0,
    }
    if not cint(settings.get("cod_risk_enabled")):
        return result

    amount = flt(amount)

    # 1. Explicit blocklist — the operator's own call, always wins.
    if is_blocked(phone, email):
        result.update(decision="block", score=100)
        result["reasons"].append(_("العميل في قائمة الحظر."))
        return result

    # 2. A hard ceiling on COD value. Above it we ask for prepayment.
    hard_cap = flt(settings.get("cod_max_order_value"))
    if hard_cap > 0 and amount > hard_cap:
        result.update(decision="block", score=90)
        result["reasons"].append(
            _("قيمة الطلب {0} تتجاوز الحد المسموح للدفع عند الاستلام ({1}).").format(
                amount, hard_cap
            )
        )
        return result

    open_cod, delivered, refused = _history(phone, email)
    result.update(open_orders=open_cod, refused=refused, delivered=delivered)
    score = 0

    # 3. Too many undelivered COD orders already in flight.
    max_open = cint(settings.get("cod_max_open_orders"))
    if max_open > 0 and open_cod >= max_open:
        score += 40
        result["reasons"].append(
            _("لدى العميل {0} طلب دفع عند الاستلام غير مُسلَّم.").format(open_cod)
        )

    # 4. Historical refusal rate. Needs a few decided orders before it means
    #    anything — one refusal out of one order is noise, not a pattern.
    decided = delivered + refused
    if decided >= 3:
        rate = (refused / decided) * 100
        max_rate = flt(settings.get("cod_max_refusal_rate"))
        if max_rate > 0 and rate > max_rate:
            score += 40
            result["reasons"].append(
                _("نسبة رفض الاستلام {0}% من {1} طلب.").format(round(rate), decided)
            )

    # 5. A first-time buyer placing an unusually large COD order.
    new_cap = flt(settings.get("cod_new_customer_max_value"))
    if new_cap > 0 and decided == 0 and amount > new_cap:
        score += 30
        result["reasons"].append(
            _("عميل جديد وقيمة الطلب {0} أعلى من حد العميل الجديد ({1}).").format(
                amount, new_cap
            )
        )

    # 6. A phone we could never actually call.
    digits = normalise_phone(phone)
    if not digits or len(digits) < 8:
        score += 30
        result["reasons"].append(_("رقم الهاتف غير صالح."))

    result["score"] = min(score, 99)
    # Anything that scored at all is worth a human glance before dispatch.
    if score >= 40:
        result["decision"] = "review"
    return result


def screen_order(order, settings=None):
    """Apply the assessment to an order being placed.

    Throws (blocking checkout) only on a `block` decision; a `review` decision
    stamps the order so the operator queue can surface it, and lets the customer
    complete their purchase normally.
    """
    settings = settings or get_settings()
    if not cint(settings.get("cod_risk_enabled")):
        return None

    verdict = assess(
        phone=order.get("phone"),
        email=order.get("email"),
        amount=flt(order.get("total")) or flt(order.get("subtotal")),
        settings=settings,
    )

    if verdict["decision"] == "block":
        # Deliberately generic: naming the rule teaches a fraudster how to dodge
        # it. The operator sees the real reason on the order.
        frappe.throw(
            _(
                "الدفع عند الاستلام غير متاح لهذا الطلب. من فضلك اختر وسيلة دفع أخرى "
                "أو تواصل مع خدمة العملاء."
            )
        )

    order.cod_risk_score = verdict["score"]
    order.cod_risk_flags = " | ".join(verdict["reasons"])[:500] or None
    order.cod_risk_review = 1 if verdict["decision"] == "review" else 0
    return verdict


# -- operator API -----------------------------------------------------------


def _require_operator():
    from ovira_marketplace.api.admin import _require_operator as guard

    guard()


@frappe.whitelist()
def list_blocklist(limit=200):
    _require_operator()
    rows = frappe.get_all(
        BLOCKLIST_DT,
        fields=["name", "identifier", "kind", "active", "reason", "orders_refused", "note", "creation"],
        order_by="creation desc",
        limit_page_length=cint(limit) or 200,
        ignore_permissions=True,
    )
    for r in rows:
        r["creation"] = str(r["creation"])[:16]
    return rows


@frappe.whitelist()
def upsert_blocklist(name=None, identifier=None, kind="Phone", reason=None, note=None, active=None,
                     orders_refused=None):
    _require_operator()
    if name:
        doc = frappe.get_doc(BLOCKLIST_DT, name)
    else:
        if not identifier:
            frappe.throw(_("أدخل رقم هاتف أو بريدًا."))
        doc = frappe.new_doc(BLOCKLIST_DT)
        doc.identifier = identifier
        doc.kind = kind
    if identifier and name:
        doc.identifier = identifier
    if kind and name:
        doc.kind = kind
    if reason is not None:
        doc.reason = reason
    if note is not None:
        doc.note = note
    if orders_refused is not None:
        doc.orders_refused = cint(orders_refused)
    if active is not None:
        doc.active = cint(active)
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return list_blocklist()


@frappe.whitelist()
def delete_blocklist(name):
    _require_operator()
    if not frappe.db.exists(BLOCKLIST_DT, name):
        frappe.throw(_("غير موجود."), frappe.DoesNotExistError)
    frappe.delete_doc(BLOCKLIST_DT, name, ignore_permissions=True, force=True)
    frappe.db.commit()
    return list_blocklist()


@frappe.whitelist()
def flagged_orders(limit=100):
    """COD orders held for a human check, newest first."""
    _require_operator()
    rows = frappe.get_all(
        ORDER_DT,
        filters={"cod_risk_review": 1, "status": ["in", list(OPEN_STATUSES)]},
        fields=[
            "name", "customer_name", "phone", "email", "governorate", "total",
            "status", "cod_risk_score", "cod_risk_flags", "creation",
        ],
        order_by="cod_risk_score desc, creation desc",
        limit_page_length=cint(limit) or 100,
        ignore_permissions=True,
    )
    for r in rows:
        r["creation"] = str(r["creation"])[:16]
    return rows


@frappe.whitelist()
def clear_flag(order):
    """Operator has called the customer and is happy — release the order."""
    _require_operator()
    if not frappe.db.exists(ORDER_DT, order):
        frappe.throw(_("الطلب غير موجود."), frappe.DoesNotExistError)
    frappe.db.set_value(ORDER_DT, order, "cod_risk_review", 0)
    frappe.db.commit()
    return {"ok": True}


@frappe.whitelist()
def preview_assessment(phone=None, email=None, amount=0):
    """Score a hypothetical order — lets the operator test their thresholds
    against a real customer without placing anything."""
    _require_operator()
    return assess(phone=phone, email=email, amount=flt(amount))

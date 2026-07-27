"""What the store does when a customer replies on WhatsApp.

The store already talks to people there. This is the other half: a customer who
types "فين طلبي" gets their order status, and one who was asked to confirm a
cash-on-delivery order can answer with a single character.

Design rules, learned from every bot that annoys people:

* **Never guess.** If the message doesn't clearly match an intent, the handler
  declines and the hub records it as unhandled — a human reading the inbox beats
  a wrong automated answer.
* **Only speak about the sender's own orders**, matched on the number the message
  came from. There is no way to ask about someone else's order.
* **Answer once.** A duplicate webhook delivery must not send the reply twice.
"""

import re

import frappe
from frappe.utils import cint, flt

from ovira_marketplace.marketplace.doctype.marketplace_order.marketplace_order import STATUS_TITLE

# Words a customer actually types, not a menu we wish they'd use.
_ASK_STATUS = ("فين طلبي", "فين الاوردر", "فين الأوردر", "طلبي", "الاوردر", "الأوردر",
               "حالة الطلب", "تتبع", "where is my order", "order status", "track")
_CONFIRM = ("1", "١", "تأكيد", "اكد", "أكد", "موافق", "تمام", "ايوه", "أيوه", "نعم",
            "confirm", "yes", "ok")
_CANCEL = ("2", "٢", "الغاء", "إلغاء", "لا", "مش عايز", "cancel", "no")

_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def handle(inbound):
    """Hub entry point. Returns True when this app dealt with the message."""
    if inbound.channel not in ("whatsapp_waha", "whatsapp_official"):
        return False
    text = (inbound.body or "").strip().translate(_ARABIC_DIGITS)
    phone = _digits(inbound.sender_phone)
    if not phone:
        return False

    # A location share belongs to whichever order is waiting for an address pin.
    if inbound.get("latitude") and inbound.get("longitude"):
        return _handle_location(inbound, phone)
    if not text:
        return False

    lowered = text.lower()
    # Confirmation first: a customer answering a question we asked outranks any
    # keyword they happen to have typed.
    pending = _pending_cod_order(phone)
    if pending:
        if _matches(lowered, _CONFIRM):
            return _confirm_cod(inbound, pending)
        if _matches(lowered, _CANCEL):
            return _cancel_cod(inbound, pending)

    if _matches(lowered, _ASK_STATUS) or _looks_like_order_id(text):
        return _answer_status(inbound, phone, text)
    return False


# ── helpers ─────────────────────────────────────────────────────────────────
def _digits(value):
    return re.sub(r"\D", "", frappe.utils.cstr(value or ""))


def _matches(text, words):
    return any(w in text for w in words) or text in words


def _looks_like_order_id(text):
    return bool(re.search(r"\b[A-Z]{2,}-?\d{3,}\b", text.upper()))


def _orders_for(phone, statuses=None, limit=5):
    """The sender's own orders, matched on the last 9 digits so a number saved as
    +20 10…, 0020 10… or 010… all find the same customer."""
    tail = phone[-9:]
    filters = [["phone", "like", "%" + tail]]
    if statuses:
        filters.append(["status", "in", statuses])
    return frappe.get_all(
        "Marketplace Order", filters=filters,
        fields=["name", "status", "total", "currency", "payment_method",
                "cod_confirm_state", "customer_name"],
        order_by="creation desc", limit_page_length=limit, ignore_permissions=True,
    )


def _reply(inbound, text):
    from ovira_messaging.inbound import reply

    reply(inbound, text)
    return True


# ── intent: where is my order ───────────────────────────────────────────────
def _answer_status(inbound, phone, text):
    orders = _orders_for(phone)
    if not orders:
        return _reply(inbound, "مالقيناش طلبات مرتبطة بالرقم ده. لو طلبت برقم تاني، ابعتلنا رقم الطلب.")

    named = re.search(r"\b([A-Za-z]{2,}-?\d{3,})\b", text)
    if named:
        wanted = named.group(1).upper().replace("-", "")
        match = next((o for o in orders if o["name"].upper().replace("-", "") == wanted), None)
        orders = [match] if match else orders[:1]

    lines = []
    for o in orders[:3]:
        lines.append("• {0} — {1}".format(o["name"], STATUS_TITLE.get(o["status"], o["status"])))
    return _reply(inbound, "حالة طلباتك:\n" + "\n".join(lines))


# ── intent: confirm a cash-on-delivery order ────────────────────────────────
def _pending_cod_order(phone):
    rows = _orders_for(phone, statuses=["Pending Payment", "Paid", "Processing"], limit=5)
    return next((o for o in rows if (o.get("cod_confirm_state") or "") == "Awaiting"), None)


def _confirm_cod(inbound, order):
    frappe.db.set_value("Marketplace Order", order["name"], {
        "cod_confirm_state": "Confirmed",
        "cod_confirmed_on": frappe.utils.now_datetime(),
    }, update_modified=False)
    frappe.db.commit()
    return _reply(inbound, "تمام، أكدنا طلبك {0} وهيتجهّز للشحن. شكراً!".format(order["name"]))


def _cancel_cod(inbound, order):
    frappe.db.set_value("Marketplace Order", order["name"], {
        "cod_confirm_state": "Declined",
        "cod_confirmed_on": frappe.utils.now_datetime(),
    }, update_modified=False)
    frappe.db.commit()
    # Deliberately NOT cancelling the order here: a "no" over WhatsApp is a
    # signal to a human, not an irreversible action taken by a keyword match.
    return _reply(inbound, "تمام، سجّلنا إنك مش عايز تكمّل طلب {0}. هنتواصل معاك للتأكيد.".format(order["name"]))


# ── intent: a shared location pins the delivery address ─────────────────────
def _handle_location(inbound, phone):
    orders = _orders_for(phone, statuses=["Pending Payment", "Paid", "Processing", "Shipped"], limit=1)
    if not orders:
        return False
    order = orders[0]
    frappe.db.set_value("Marketplace Order", order["name"], {
        "delivery_latitude": flt(inbound.latitude),
        "delivery_longitude": flt(inbound.longitude),
    }, update_modified=False)
    frappe.db.commit()
    return _reply(inbound, "استلمنا موقعك وثبّتناه على طلب {0} — ده هيسهّل التسليم كتير. شكراً!".format(order["name"]))


# ── asking for the confirmation ─────────────────────────────────────────────
def request_cod_confirmation(order):
    """Ask the buyer to confirm a cash-on-delivery order before it ships.

    Refused deliveries are the single most expensive thing in a COD market: the
    goods travel twice and nobody pays for either leg. One question, answered
    with one character, is the cheapest insurance available — and it is only
    asked of orders the risk screen already flagged, so a normal customer is
    never interrogated.
    """
    if not order.get("phone"):
        return False
    frappe.db.set_value("Marketplace Order", order.name, "cod_confirm_state", "Awaiting",
                        update_modified=False)
    frappe.db.commit()

    from ovira_marketplace.notifications.dispatch import emit

    ctx = order.notification_context()
    emit("order.cod_confirm", ctx, doc=order)
    return True


def is_dispatchable(order_name):
    """False while a flagged order is still waiting on its confirmation — the
    hold that makes the question worth asking."""
    state = frappe.db.get_value("Marketplace Order", order_name, "cod_confirm_state")
    return (state or "") not in ("Awaiting", "Declined")

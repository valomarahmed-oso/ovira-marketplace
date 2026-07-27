"""The event catalogue — the single place that says what the store can announce.

Each entry describes ONE thing that happened, not one message: who should hear
about it, whether the recipient is allowed to opt out, which channels carry it,
and the wording in both languages. A channel renders the same content block its
own way (see `channels.py`), so a store writes each message once instead of
maintaining four near-identical copies that drift apart.

Adding an event = one entry here + one `emit()` call where it happens.
"""

from collections import namedtuple

# Who the event is for. The engine turns this into concrete recipients.
BUYER = "buyer"
VENDOR = "vendor"
OPERATOR = "operator"

# Channel ids the adapters understand.
INAPP = "inapp"
PUSH = "push"
EMAIL = "email"
WHATSAPP = "whatsapp"
SMS = "sms"

Content = namedtuple("Content", ["title", "lines"])
Event = namedtuple("Event", ["audience", "transactional", "channels", "ar", "en"])


def _ev(audience, channels, ar, en, transactional=True):
    return Event(audience=audience, transactional=transactional, channels=channels, ar=ar, en=en)


# Transactional order/return traffic goes everywhere it can; marketing is email +
# push only (a marketing WhatsApp is the fastest way to get a number banned).
_FULL = (INAPP, PUSH, EMAIL, WHATSAPP)
_QUIET = (INAPP, PUSH, EMAIL)

EVENTS = {
    # ── order lifecycle (buyer) ──────────────────────────────────────────
    "order.placed": _ev(
        BUYER, _FULL,
        Content("تم استلام طلبك 🎉", [
            "رقم الطلب: {order}", "الإجمالي: {total} {currency}",
            "هنبلّغك بأول تحديث على حالة الطلب.",
        ]),
        Content("We got your order 🎉", [
            "Order: {order}", "Total: {total} {currency}",
            "We'll message you the moment anything changes.",
        ]),
    ),
    "order.paid": _ev(
        BUYER, _FULL,
        Content("تم استلام دفع طلبك ✅", ["رقم الطلب: {order}", "المدفوع: {total} {currency}"]),
        Content("Payment received ✅", ["Order: {order}", "Paid: {total} {currency}"]),
    ),
    "order.processing": _ev(
        BUYER, _FULL,
        Content("طلبك قيد التجهيز 📦", ["رقم الطلب: {order}", "بنجهّز طلبك دلوقتي."]),
        Content("Your order is being prepared 📦", ["Order: {order}", "We're packing it now."]),
    ),
    "order.shipped": _ev(
        BUYER, _FULL,
        Content("تم شحن طلبك 🚚", ["رقم الطلب: {order}", "تقدر تتابع الشحنة من صفحة الطلب."]),
        Content("Your order shipped 🚚", ["Order: {order}", "Track it from your order page."]),
    ),
    "order.out_for_delivery": _ev(
        BUYER, _FULL,
        Content("طلبك خرج للتسليم 🛵", ["رقم الطلب: {order}", "المندوب في الطريق إليك النهاردة."]),
        Content("Out for delivery 🛵", ["Order: {order}", "Your courier is on the way today."]),
    ),
    "order.delivery_otp": _ev(
        BUYER, (EMAIL, WHATSAPP, SMS),   # the one event worth an SMS fallback
        Content("رمز تأكيد الاستلام", [
            "طلبك {order} في الطريق إليك.", "رمز الاستلام: {otp}",
            "أعطِ الرمز لمندوب التوصيل عند الاستلام فقط.",
        ]),
        Content("Your delivery code", [
            "Order {order} is on its way.", "Delivery code: {otp}",
            "Give this code to the courier at handover only.",
        ]),
    ),
    "order.delivered": _ev(
        BUYER, _FULL,
        Content("تم تسليم طلبك ✅", ["رقم الطلب: {order}", "نتمنى المنتج يعجبك!"]),
        Content("Delivered ✅", ["Order: {order}", "We hope you love it!"]),
    ),
    "order.cancelled": _ev(
        BUYER, _FULL,
        Content("تم إلغاء طلبك", ["رقم الطلب: {order}", "لو الإلغاء مش بطلب منك، كلّمنا فوراً."]),
        Content("Order cancelled", ["Order: {order}", "If this wasn't you, contact us right away."]),
    ),

    # ── returns & refunds ────────────────────────────────────────────────
    "return.requested": _ev(
        BUYER, _QUIET,
        Content("استلمنا طلب الإرجاع", ["الطلب: {order}", "هنراجعه ونرد عليك."]),
        Content("Return request received", ["Order: {order}", "We're reviewing it and will reply."]),
    ),
    "return.approved": _ev(
        BUYER, _FULL,
        Content("تمت الموافقة على الإرجاع ✅", ["الطلب: {order}", "{note}"]),
        Content("Return approved ✅", ["Order: {order}", "{note}"]),
    ),
    "return.rejected": _ev(
        BUYER, _FULL,
        Content("تم رفض طلب الإرجاع", ["الطلب: {order}", "{note}"]),
        Content("Return rejected", ["Order: {order}", "{note}"]),
    ),
    "return.completed": _ev(
        BUYER, _FULL,
        Content("تم إتمام الإرجاع", ["الطلب: {order}", "{note}"]),
        Content("Return completed", ["Order: {order}", "{note}"]),
    ),
    "order.refund_completed": _ev(
        BUYER, _FULL,
        Content("تم استرداد مبلغك 💸", ["الطلب: {order}", "المبلغ: {total} {currency}"]),
        Content("Refund sent 💸", ["Order: {order}", "Amount: {total} {currency}"]),
    ),

    # ── post-purchase ────────────────────────────────────────────────────
    "loyalty.earned": _ev(
        BUYER, (INAPP, PUSH),
        Content("كسبت نقاط ولاء ⭐", ["+{points} نقطة من طلب {order}"]),
        Content("You earned points ⭐", ["+{points} points from order {order}"]),
    ),

    # ── marketing (opt-out; never over WhatsApp) ─────────────────────────
    "cart.abandoned": _ev(
        BUYER, (EMAIL, PUSH),
        Content("سلة التسوق مستنياك 🛒", [
            "سيبت {count} منتج في السلة.", "إجمالي السلة: {total} {currency}",
        ]),
        Content("Your cart is waiting 🛒", [
            "You left {count} item(s) behind.", "Cart total: {total} {currency}",
        ]),
        transactional=False,
    ),
    "product.back_in_stock": _ev(
        BUYER, (INAPP, PUSH, EMAIL),
        Content("رجع للمخزون 🎉", ["{product} متاح تاني — احجزه قبل ما يخلص."]),
        Content("Back in stock 🎉", ["{product} is available again — grab it before it's gone."]),
        transactional=False,
    ),

    # ── vendor ───────────────────────────────────────────────────────────
    "vendor.new_order": _ev(
        VENDOR, _FULL,
        Content("طلب جديد 🛍️", ["رقم الطلب: {order}", "الإجمالي: {total} {currency}", "جهّزه في أقرب وقت."]),
        Content("New order 🛍️", ["Order: {order}", "Total: {total} {currency}", "Please prepare it soon."]),
    ),

    "account.welcome": _ev(
        BUYER, (INAPP, EMAIL),
        Content("أهلاً بيك في {store} 👋", [
            "حسابك اتفتح بنجاح.", "تقدر تتابع طلباتك وعناوينك من صفحة حسابك.",
        ]),
        Content("Welcome to {store} 👋", [
            "Your account is ready.", "Track your orders and addresses from your account page.",
        ]),
    ),

    # ── operator ─────────────────────────────────────────────────────────
    "operator.support_ticket": _ev(
        OPERATOR, (INAPP, EMAIL),
        Content("تذكرة دعم جديدة", ["{subject}", "التذكرة: {ticket}"]),
        Content("New support ticket", ["{subject}", "Ticket: {ticket}"]),
    ),
}


def get(event_id):
    return EVENTS.get(event_id)


def default_content(event_id, lang):
    """The SHIPPED wording, ignoring any operator override."""
    ev = EVENTS.get(event_id)
    if not ev:
        return None
    return ev.en if (lang or "").lower().startswith("en") else ev.ar


def _overrides():
    """{(event, lang): Content} from Marketplace Notification Template, cached.

    Kept here rather than in the engine so every reader — the dispatcher, the
    preview, the admin list — resolves wording exactly one way.
    """
    import frappe

    cached = frappe.cache().get_value("ovira_notification_templates")
    if cached is not None:
        return {tuple(k.split("::", 1)): Content(v[0], v[1]) for k, v in cached.items()}

    out = {}
    try:
        rows = frappe.get_all(
            "Marketplace Notification Template",
            filters={"enabled": 1}, fields=["event", "language", "title", "lines"],
            ignore_permissions=True,
        )
    except Exception:
        return {}   # doctype not migrated yet — defaults still work
    for r in rows:
        lines = [ln.strip() for ln in (r.get("lines") or "").splitlines() if ln.strip()]
        out["{0}::{1}".format(r["event"], r["language"])] = [r.get("title") or "", lines]
    try:
        frappe.cache().set_value("ovira_notification_templates", out)
    except Exception:
        pass
    return {tuple(k.split("::", 1)): Content(v[0], v[1]) for k, v in out.items()}


def content_for(event_id, lang):
    """The content block for an event in `lang` ('ar'/'en'), Arabic by default —
    the operator's override when there is one, otherwise the shipped default."""
    code = (lang or "ar").lower()[:2]
    code = "en" if code == "en" else "ar"
    override = _overrides().get((event_id, code))
    if override and override.title:
        return override
    return default_content(event_id, code)

"""Store health: the configuration problems that don't announce themselves.

Every check here exists because the condition it looks for was live on a real
store and nothing said so. A misconfigured loyalty rate, a tax template that
would invoice more than the customer agreed to, stock that disagrees with the
ledger, products nobody can open — none of these throw. They just quietly do the
wrong thing until somebody notices a number they can't explain.

Each finding names the problem, why it matters, and where to fix it. Severity is
`critical` (money or orders are wrong right now), `warning` (will bite), or
`info` (worth knowing).
"""

import frappe
from frappe.utils import cint, flt

from ovira_marketplace.api.admin import _require_operator
from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)


def _finding(severity, code, title, detail, fix=None, count=None):
    return {
        "severity": severity, "code": code, "title": title,
        "detail": detail, "fix": fix, "count": count,
    }


# -- individual checks -------------------------------------------------------


def _check_loyalty(settings, out):
    if not cint(settings.get("loyalty_enabled")):
        return
    earn = flt(settings.get("loyalty_earn_rate"))
    value = flt(settings.get("loyalty_redeem_value"))
    giveback = earn * value
    if giveback > 0.20:
        out.append(_finding(
            "critical", "loyalty_giveback",
            "برنامج النقاط يعيد {0}% من كل عملية شراء".format(round(giveback * 100, 1)),
            "معدل الكسب {0} نقطة لكل جنيه، وقيمة النقطة {1} جنيه — أي أن كل ١٠٠ جنيه مبيعات "
            "تُنتج {2} جنيه رصيد متجر. الأغلب أن «قيمة النقطة» أُدخلت مقلوبة: هي كم يساوي "
            "النقطة الواحدة بالمال، وليست كم نقطة تساوي جنيهًا.".format(
                earn, value, round(giveback * 100, 1)),
            "إعدادات المتجر ← قيمة النقطة (١٪ استرداد = {0})".format(
                round(0.01 / earn, 4) if earn else 0.01),
        ))
    elif giveback <= 0 and earn > 0:
        out.append(_finding(
            "warning", "loyalty_worthless",
            "العملاء يكسبون نقاطًا لا قيمة لها",
            "معدل الكسب مفعّل لكن قيمة النقطة صفر، فالنقاط تتراكم ولا يمكن استبدالها بشيء.",
            "إعدادات المتجر ← قيمة النقطة",
        ))


def _check_tax(settings, out):
    from ovira_marketplace.taxes import sales_tax_profile

    profile = sales_tax_profile(settings)
    if not profile.get("rate"):
        out.append(_finding(
            "info", "no_tax_template",
            "لا يوجد قالب ضريبة مبيعات",
            "الفواتير تصدر بدون ضريبة. هذا صحيح لو المتجر غير مسجَّل ضريبيًا فقط.",
            "إعدادات المتجر ← قالب ضريبة المبيعات",
        ))
        return
    if not profile.get("inclusive"):
        out.append(_finding(
            "warning", "tax_exclusive",
            "الضريبة تُضاف فوق السعر المعروض",
            "قالب «{0}» غير شامل، فالعميل يرى السعر ثم يُضاف {1}% عند الدفع. "
            "هذا مسموح لكنه غير معتاد في التجزئة المصرية، وأي عميل يتوقع أن السعر "
            "المعروض هو ما سيدفعه.".format(profile.get("template"), round(profile["rate"] * 100, 2)),
            "إعدادات المتجر ← قالب ضريبة المبيعات، أو فعّل «شامل الضريبة» على القالب في ERPNext",
        ))


def _check_stock(out):
    from ovira_marketplace.inventory import stock_mismatches

    rows = stock_mismatches(limit=50)
    blocked = [r for r in rows if r.get("blocked")]
    drifted = [r for r in rows if not r.get("blocked")]
    if drifted:
        out.append(_finding(
            "critical", "stock_drift",
            "مخزون {0} منتج لا يطابق ERPNext".format(len(drifted)),
            "الكمية المعروضة في المتجر تختلف عن رصيد ERPNext. الطلبات ستُقبل على كميات "
            "قد لا تكون موجودة، وإذن التسليم قد يفشل.",
            "لوحة المخزون ← إعادة المزامنة",
            len(drifted),
        ))
    if blocked:
        out.append(_finding(
            "warning", "stock_blocked",
            "{0} منتج لا يمكن مزامنته".format(len(blocked)),
            "أصنافها معطَّلة في ERPNext، والتسوية المخزنية ترفض الصنف المعطَّل. "
            "المنتجات: {0}".format("، ".join(r["title"] for r in blocked[:5])),
            "فعّل الصنف في ERPNext، أو أطفئ تتبّع المخزون على المنتج",
            len(blocked),
        ))


def _check_hidden_vendor_products(out):
    from ovira_marketplace.api.catalog import hidden_vendors

    hidden = hidden_vendors()
    if not hidden:
        return
    stranded = frappe.get_all(
        "Marketplace Product",
        filters=[["vendor", "in", hidden], ["approval_status", "=", "Approved"],
                 ["published", "=", 1]],
        fields=["name", "title"], limit_page_length=0, ignore_permissions=True,
    )
    if stranded:
        out.append(_finding(
            "info", "hidden_vendor_products",
            "{0} منتج منشور لبائعين مخفيّين".format(len(stranded)),
            "بائعون موقوفون (أو غير البائع المالك في وضع المتجر الفردي). منتجاتهم "
            "مخفية عن المتجر تلقائيًا، لكنها ما زالت مُعلَّمة كمنشورة — فتظهر في "
            "تقارير المشغّل وكأنها معروضة.",
            "لوحة البائعين ← فعّل البائع، أو ألغِ نشر منتجاته",
            len(stranded),
        ))


def _check_slugs(out):
    from ovira_marketplace.slugs import is_web_slug

    bad = []
    for doctype in ("Marketplace Product", "Marketplace Category", "Marketplace Vendor"):
        for row in frappe.get_all(doctype, fields=["name", "slug"], limit_page_length=0):
            if row.get("slug") and not is_web_slug(row["slug"]):
                bad.append("%s %s" % (doctype.split()[-1], row["name"]))
    if bad:
        out.append(_finding(
            "critical", "non_ascii_slug",
            "{0} عنوان URL غير لاتيني".format(len(bad)),
            "الروابط العربية تُرمَّز في كل رابط ويعيدها المتصفّح مُرمَّزة، فالصفحة "
            "تبحث عن «%D8%A7…» ولا تجد شيئًا. هذه الصفحات لا تفتح.",
            "احفظ السجل مرة واحدة — يُصحَّح تلقائيًا",
            len(bad),
        ))


def _check_outgoing_email(out):
    from ovira_marketplace.emails import outgoing_configured

    if not outgoing_configured():
        out.append(_finding(
            "warning", "no_outgoing_email",
            "لا يوجد حساب بريد صادر",
            "كل رسائل العملاء (تأكيد الطلب، الشحن، رمز الاستلام، الاسترداد) "
            "تُسجَّل كـ«متخطّاة» ولا تصل أحدًا.",
            "إعدادات البريد في ERPNext، أو مركز الرسائل",
        ))


def _check_zero_refunds(out):
    rows = frappe.get_all(
        "Marketplace Return",
        filters={"status": "Completed", "refund_amount": ["<=", 0]},
        fields=["name", "marketplace_order"], limit_page_length=0, ignore_permissions=True,
    )
    if rows:
        out.append(_finding(
            "critical", "zero_refund",
            "{0} مرتجع مكتمل بمبلغ صفر".format(len(rows)),
            "المرتجع أُغلق دون تحديد مبلغ، فلم يُضَف رصيد للعميل ولم تُخصم قيمة "
            "المرتجع من البائع ولم تصل رسالة استرداد. العميل يرى مرتجعًا مقبولًا "
            "ومحفظة فارغة: {0}".format("، ".join(r["name"] for r in rows[:5])),
            "لوحة المرتجعات ← حدّد مبلغ الاسترداد وأعد الإكمال",
            len(rows),
        ))


def _check_failed_accounting(out):
    rows = frappe.get_all(
        "Marketplace Order",
        filters={"accounting_status": "Failed"},
        fields=["name"], limit_page_length=0, ignore_permissions=True,
    )
    if rows:
        out.append(_finding(
            "critical", "accounting_failed",
            "{0} طلب حُصّل دفعه ولم تكتمل محاسبته".format(len(rows)),
            "الدفع تم لكن الفاتورة أو التسوية فشلت، فالإيراد غير مسجَّل "
            "ومستحقات البائع غير محجوزة: {0}".format("، ".join(r["name"] for r in rows[:5])),
            "لوحة الطلبات ← إعادة المحاولة أو إعادة إنشاء أوامر البيع",
            len(rows),
        ))


def _check_operator_vendor(settings, out):
    if (settings.get("mode") or "") != "Single Company":
        return
    if settings.get("operator_vendor"):
        return
    active = frappe.get_all("Marketplace Vendor", filters={"status": "Active"}, pluck="name")
    if len(active) == 1:
        return  # unambiguous — the catalog resolves it on its own
    out.append(_finding(
        "warning", "no_operator_vendor",
        "وضع المتجر الفردي بلا بائع محدَّد",
        "يوجد {0} بائع نشط ولم يُحدَّد أيّهم هو المتجر، فلا يمكن إخفاء منتجات "
        "الباقين تلقائيًا وستظهر كلها للعملاء.".format(len(active)),
        "إعدادات المتجر ← بائع المتجر",
    ))


def _check_deferred_work(out):
    """Work that was put off and hasn't been picked up.

    `failures.guard(..., DEFERRABLE)` records the things that didn't happen but
    still should — a chargeback that didn't book, a payout that failed, points
    not clawed back, a stock sync refused. Recording them is only worth anything
    if somebody is shown the list.
    """
    from ovira_marketplace.failures import deferred_work

    pending = deferred_work()
    if not pending:
        return
    out.append(_finding(
        "warning", "deferred_work",
        "{0} عملية مؤجّلة لم تكتمل".format(len(pending)),
        "عمليات فشلت ولم تُوقف ما كانت جزءًا منه — لكنها لم تحدث: {0}".format(
            "، ".join(pending[:6])),
        "راجع سجل الأخطاء للتفاصيل، ثم أعد تنفيذ العملية المعنية",
        len(pending),
    ))


#: Files the installed app and the notifications depend on, which live in the
#: storefront container rather than in this one — so nothing here can import
#: them, and a rename or a wrong path is invisible from the Frappe side.
STOREFRONT_ASSETS = (
    ("/shop/sw.js", "عامل الخدمة — بدونه مفيش تثبيت ولا إشعارات ولا وضع بدون نت"),
    ("/shop/manifest.webmanifest", "ملف التثبيت — بدونه المتجر مايتثبّتش على الشاشة الرئيسية"),
    ("/shop/icons/icon-192.png", "أيقونة الإشعارات — لو ناقصة كل إشعار بيظهر بأيقونة المتصفح"),
    ("/shop/icons/icon-512.png", "أيقونة التثبيت"),
    ("/shop/icons/icon-maskable-512.png", "أيقونة أندرويد المقصوصة"),
    ("/shop/offline.html", "صفحة انقطاع الاتصال"),
)


def _check_pwa_assets(out):
    """The installable-app files actually resolve.

    Every one of these is referenced by a string in another container, so a
    rename breaks them silently: the notification icon pointed at a path that
    had never existed, and for months every push this store sent showed the
    browser's generic bell. Nothing logged it, because a 404 on an icon is not
    an error anyone raises.
    """
    import requests

    base = (frappe.utils.get_url() or "").rstrip("/")
    if not base:
        return
    missing = []
    for path, why in STOREFRONT_ASSETS:
        try:
            res = requests.head(base + path, timeout=5, allow_redirects=True)
            if res.status_code >= 400:
                missing.append("{0} ({1})".format(path, why))
        except Exception:
            # The storefront being unreachable is a different problem, and
            # guessing about it here would be a false alarm.
            return
    if missing:
        out.append(_finding(
            "warning", "pwa_assets",
            "{0} ملف من ملفات التطبيق المثبَّت مفقود".format(len(missing)),
            "؛ ".join(missing[:6]),
            "تأكد إن حاوية المتجر متبنيّة من آخر نسخة، والمسارات في public/ متطابقة",
            len(missing),
        ))


CHECKS_WITH_SETTINGS = (_check_loyalty, _check_tax, _check_operator_vendor)
CHECKS = (
    _check_stock, _check_hidden_vendor_products, _check_slugs,
    _check_outgoing_email, _check_zero_refunds, _check_failed_accounting,
    _check_deferred_work, _check_pwa_assets,
)

SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}


@frappe.whitelist()
def store_health():
    """Every configuration problem the store can't see about itself.

    One failing check never hides the others — a broken query is reported as its
    own finding, because "the health screen was blank" must never mean "we
    couldn't tell".
    """
    _require_operator()
    settings = get_settings()
    out = []
    for check in CHECKS_WITH_SETTINGS:
        try:
            check(settings, out)
        except Exception:
            out.append(_bad_check(check))
    for check in CHECKS:
        try:
            check(out)
        except Exception:
            out.append(_bad_check(check))

    out.sort(key=lambda f: SEVERITY_ORDER.get(f["severity"], 3))
    return {
        "findings": out,
        "critical": sum(1 for f in out if f["severity"] == "critical"),
        "warnings": sum(1 for f in out if f["severity"] == "warning"),
        "healthy": not out,
    }


def _bad_check(check):
    frappe.log_error(frappe.get_traceback(), "Ovira: health check %s failed" % check.__name__)
    return _finding(
        "warning", "check_failed",
        "تعذّر تشغيل أحد الفحوص",
        "الفحص «{0}» فشل — راجع سجل الأخطاء. باقي الفحوص أعلاه صحيحة.".format(check.__name__),
    )

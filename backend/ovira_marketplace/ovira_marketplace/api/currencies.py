"""Storefront display currencies.

The marketplace owns this list outright — it is NOT read from ERPNext, and the
screen works on a bench where no exchange rate has ever been entered. Two
optional helpers can *fill in* a rate (from ERPNext's Currency Exchange, or from
a free public API), but the stored value always wins and either helper can be
ignored entirely.

**Display only.** Prices, orders, invoices and vendor settlement all stay in the
base currency; the storefront divides by `rate_to_base` purely to render. That
keeps every money path in `checkout.py` / `settlement.py` untouched.
"""

import frappe
import requests
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint, flt

from ovira_marketplace.api.admin import _require_operator
from ovira_marketplace.marketplace.doctype.marketplace_currency.marketplace_currency import (
    base_currency,
    touch_rate,
)

DT = "Marketplace Currency"

PUBLIC_FIELDS = [
    "currency_code",
    "currency_name",
    "currency_name_ar",
    "symbol",
    "rate_to_base",
    "decimals",
    "is_base",
    "display_order",
]

ADMIN_FIELDS = PUBLIC_FIELDS + ["name", "enabled", "rate_source", "rate_updated_on"]

RATE_API = "https://open.er-api.com/v6/latest/{base}"
"""Free, key-less FX endpoint. Only ever called when the operator presses the
fetch button — never on a customer request path."""


def _shape(row):
    return {
        "code": row.get("currency_code"),
        "name": row.get("currency_name") or row.get("currency_code"),
        "name_ar": row.get("currency_name_ar") or row.get("currency_name") or row.get("currency_code"),
        "symbol": row.get("symbol") or row.get("currency_code"),
        "rate": flt(row.get("rate_to_base")) or 1,
        "decimals": cint(row.get("decimals")),
        "is_base": bool(row.get("is_base")),
    }


# -- public ------------------------------------------------------------------


def public_currencies():
    """Enabled currencies for the storefront switcher, base first.

    Returns [] when the operator hasn't configured any — the storefront then
    simply shows base-currency prices with no switcher, exactly as before.
    """
    rows = frappe.get_all(
        DT,
        filters={"enabled": 1},
        fields=PUBLIC_FIELDS,
        order_by="is_base desc, display_order asc, currency_code asc",
        limit_page_length=0,
        ignore_permissions=True,
    )
    return [_shape(r) for r in rows]


@frappe.whitelist(allow_guest=True)
def list_currencies():
    """Guest-readable currency list + which one prices are stored in."""
    return {"base": base_currency(), "currencies": public_currencies()}


# -- operator ----------------------------------------------------------------


@frappe.whitelist()
def list_all_currencies():
    _require_operator()
    rows = frappe.get_all(
        DT,
        fields=ADMIN_FIELDS,
        order_by="is_base desc, display_order asc, currency_code asc",
        limit_page_length=0,
        ignore_permissions=True,
    )
    for r in rows:
        r["rate_updated_on"] = str(r["rate_updated_on"]) if r.get("rate_updated_on") else None
    return {"base": base_currency(), "rows": rows}


@frappe.whitelist()
def upsert_currency(
    name=None,
    currency_code=None,
    currency_name=None,
    currency_name_ar=None,
    symbol=None,
    rate_to_base=None,
    decimals=None,
    enabled=None,
    is_base=None,
    display_order=None,
    rate_source=None,
):
    _require_operator()

    if name:
        doc = frappe.get_doc(DT, name)
    else:
        if not currency_code:
            frappe.throw(_("أدخل رمز العملة."))
        code = str(currency_code).strip().upper()
        if frappe.db.exists(DT, code):
            frappe.throw(_("العملة {0} مضافة بالفعل.").format(code))
        doc = frappe.new_doc(DT)
        doc.currency_code = code

    for field, value in (
        ("currency_name", currency_name),
        ("currency_name_ar", currency_name_ar),
        ("symbol", symbol),
    ):
        if value is not None:
            doc.set(field, value or None)

    if rate_to_base is not None:
        doc.rate_to_base = flt(rate_to_base)
    if decimals is not None:
        doc.decimals = cint(decimals)
    if enabled is not None:
        doc.enabled = cint(enabled)
    if is_base is not None:
        doc.is_base = cint(is_base)
    if display_order is not None:
        doc.display_order = cint(display_order)
    if rate_source:
        doc.rate_source = rate_source

    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return list_all_currencies()


@frappe.whitelist()
def delete_currency(name):
    _require_operator()
    if not frappe.db.exists(DT, name):
        frappe.throw(_("العملة غير موجودة."), frappe.DoesNotExistError)
    if frappe.db.get_value(DT, name, "is_base"):
        frappe.throw(_("لا يمكن حذف العملة الأساسية."))
    frappe.delete_doc(DT, name, ignore_permissions=True, force=True)
    frappe.db.commit()
    return list_all_currencies()


# -- optional rate helpers ---------------------------------------------------


def _rate_from_erpnext(code, base):
    """Latest ERPNext Currency Exchange rate, if the operator keeps one there.

    Tries base→code first (ERPNext stores `exchange_rate` as "1 from = N to"),
    then the reverse pair, inverting it. Returns None when nothing is on file —
    the caller reports that plainly instead of guessing a number.
    """
    if not frappe.db.exists("DocType", "Currency Exchange"):
        return None

    row = frappe.get_all(
        "Currency Exchange",
        filters={"from_currency": base, "to_currency": code},
        fields=["exchange_rate"],
        order_by="date desc",
        limit_page_length=1,
        ignore_permissions=True,
    )
    if row and flt(row[0].exchange_rate) > 0:
        # 1 base = N code  →  1 code = 1/N base
        return 1 / flt(row[0].exchange_rate)

    row = frappe.get_all(
        "Currency Exchange",
        filters={"from_currency": code, "to_currency": base},
        fields=["exchange_rate"],
        order_by="date desc",
        limit_page_length=1,
        ignore_permissions=True,
    )
    if row and flt(row[0].exchange_rate) > 0:
        # 1 code = N base — already what we store.
        return flt(row[0].exchange_rate)
    return None


def _rate_from_api(code, base):
    """Public FX API. Returns None on any hiccup rather than raising, so a dead
    third party can never break the screen."""
    try:
        res = requests.get(RATE_API.format(base=base), timeout=12)
        data = res.json() if res.content else {}
        rate = flt((data.get("rates") or {}).get(code))
        # The API gives "1 base = N code"; we store "1 code = N base".
        return (1 / rate) if rate > 0 else None
    except Exception:
        return None


@frappe.whitelist()
@rate_limit(limit=60, seconds=60 * 10, methods="POST")
def fetch_rate(name, source="API", apply=0):
    """Look up a rate for one currency without committing to it.

    Returns `{ok, rate, source}` so the screen can drop the number into the
    input for the operator to eyeball. Pass `apply=1` to store it directly.
    Nothing here is automatic — a stored rate only ever changes because someone
    pressed a button.
    """
    _require_operator()
    row = frappe.db.get_value(DT, name, ["name", "currency_code", "is_base"], as_dict=True)
    if not row:
        frappe.throw(_("العملة غير موجودة."), frappe.DoesNotExistError)
    if row.is_base:
        return {"ok": True, "rate": 1, "source": "Base", "applied": False}

    base = base_currency()
    src = (source or "API").strip()
    rate = _rate_from_erpnext(row.currency_code, base) if src == "ERPNext" else _rate_from_api(
        row.currency_code, base
    )

    if not rate or rate <= 0:
        return {
            "ok": False,
            "source": src,
            "error": (
                _("لا يوجد سعر صرف مسجَّل في ERPNext لهذه العملة.")
                if src == "ERPNext"
                else _("تعذّر جلب السعر من الخدمة الخارجية.")
            ),
        }

    rate = round(rate, 9)
    if cint(apply):
        touch_rate(row.name, rate, src)
        frappe.db.commit()
    return {"ok": True, "rate": rate, "source": src, "applied": bool(cint(apply))}

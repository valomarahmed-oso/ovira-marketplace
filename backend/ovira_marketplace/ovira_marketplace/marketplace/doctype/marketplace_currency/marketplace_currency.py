"""A currency the storefront can display prices in.

Display only. Every price, order, invoice and vendor settlement stays in the
base currency — this doctype just carries the rate the storefront divides by, so
a shopper can browse in their own currency without any of the accounting moving.

`rate_to_base` is the value of ONE unit of this currency in the base currency
(1 USD = 48.5 EGP → 48.5). Converting a base price is therefore `price / rate`.
"""

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt, now_datetime


class MarketplaceCurrency(Document):
    def validate(self):
        self.currency_code = (self.currency_code or "").strip().upper()
        if not self.currency_code.isalpha() or not (2 <= len(self.currency_code) <= 5):
            frappe.throw(_("رمز العملة لازم يكون حروف إنجليزية فقط (مثل USD)."))

        if cint(self.decimals) < 0 or cint(self.decimals) > 6:
            frappe.throw(_("عدد الخانات العشرية لازم يكون بين 0 و 6."))

        if self.is_base:
            # The base is the unit of account — its rate is 1 by definition, and
            # it must always be selectable or the storefront has no fallback.
            self.rate_to_base = 1
            self.enabled = 1
            self._demote_other_bases()
        elif flt(self.rate_to_base) <= 0:
            frappe.throw(_("سعر الصرف لازم يكون أكبر من صفر."))

    def _demote_other_bases(self):
        """Exactly one base currency. Setting a new one clears the old flag
        rather than throwing, so the operator can switch base in one step."""
        others = frappe.get_all(
            "Marketplace Currency",
            filters={"is_base": 1, "name": ["!=", self.name or ""]},
            pluck="name",
        )
        for other in others:
            frappe.db.set_value("Marketplace Currency", other, "is_base", 0)

    def on_trash(self):
        if self.is_base:
            frappe.throw(_("لا يمكن حذف العملة الأساسية."))


def base_currency():
    """The store's unit of account. Falls back to Marketplace Settings, then EGP,
    so the storefront always has something to price in."""
    code = frappe.db.get_value("Marketplace Currency", {"is_base": 1}, "currency_code")
    if code:
        return code
    return (
        frappe.db.get_single_value("Marketplace Settings", "default_currency") or "EGP"
    )


def touch_rate(name, rate, source):
    """Record a fetched rate with its provenance. Used by the fetch helpers."""
    frappe.db.set_value(
        "Marketplace Currency",
        name,
        {
            "rate_to_base": flt(rate),
            "rate_source": source,
            "rate_updated_on": now_datetime(),
        },
    )

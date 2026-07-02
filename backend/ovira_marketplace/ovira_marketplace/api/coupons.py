"""Discount coupons.

A coupon is an operator-funded promotion: it reduces what the shopper pays
(booked as a discount on the customer Sales Invoice), but vendor settlement is
untouched — the operator absorbs the discount out of its margin. The discount is
always recomputed server-side; the client's number is never trusted.
"""

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate

from ovira_marketplace.api.admin import _require_operator


def _normalize(code):
    return (code or "").strip().upper()


def compute_discount(coupon, subtotal):
    """Discount amount for a subtotal, or 0. `coupon` is a doc/dict. Does not
    validate eligibility — call `_check_eligible` first for that."""
    subtotal = flt(subtotal)
    if coupon.get("discount_type") == "Fixed":
        discount = flt(coupon.get("discount_value"))
    else:
        discount = subtotal * flt(coupon.get("discount_value")) / 100.0
        cap = flt(coupon.get("max_discount"))
        if cap:
            discount = min(discount, cap)
    # Never discount below zero or above the goods subtotal.
    return round(max(0.0, min(discount, subtotal)), 2)


def _check_eligible(coupon, subtotal):
    """Throw a user-facing reason if the coupon can't be used for this subtotal."""
    if not coupon.get("active"):
        frappe.throw(_("This coupon is no longer active."))
    expires = coupon.get("expires_on")
    if expires and getdate(expires) < getdate(nowdate()):
        frappe.throw(_("This coupon has expired."))
    if flt(subtotal) < flt(coupon.get("min_subtotal")):
        frappe.throw(
            _("Add more to your cart to use this coupon (minimum {0}).").format(
                flt(coupon.get("min_subtotal"))
            )
        )
    limit = int(coupon.get("usage_limit") or 0)
    if limit and int(coupon.get("used_count") or 0) >= limit:
        frappe.throw(_("This coupon has reached its usage limit."))


def resolve(code, subtotal):
    """Return (coupon_doc, discount) for a usable coupon, or throw. Shared by the
    checkout so the discount recorded on the order is always the trusted one."""
    name = frappe.db.get_value("Marketplace Coupon", {"code": _normalize(code)}, "name")
    if not name:
        frappe.throw(_("Invalid coupon code."))
    coupon = frappe.get_doc("Marketplace Coupon", name)
    _check_eligible(coupon, subtotal)
    discount = compute_discount(coupon, subtotal)
    if discount <= 0:
        frappe.throw(_("This coupon doesn't apply to your cart."))
    return coupon, discount


@frappe.whitelist(allow_guest=True)
def validate_coupon(code, subtotal):
    """Storefront preview: the discount a coupon would give for a subtotal."""
    coupon, discount = resolve(code, subtotal)
    return {
        "code": coupon.code,
        "discount": discount,
        "discount_type": coupon.discount_type,
        "description": coupon.description,
    }


# -- operator management ----------------------------------------------------

COUPON_FIELDS = [
    "code",
    "description",
    "active",
    "discount_type",
    "discount_value",
    "max_discount",
    "min_subtotal",
    "expires_on",
    "usage_limit",
    "used_count",
]


@frappe.whitelist()
def list_coupons():
    _require_operator()
    return frappe.get_all(
        "Marketplace Coupon",
        fields=COUPON_FIELDS,
        order_by="modified desc",
        ignore_permissions=True,
    )


@frappe.whitelist()
def upsert_coupon(
    code,
    discount_type="Percentage",
    discount_value=0,
    description=None,
    max_discount=0,
    min_subtotal=0,
    usage_limit=0,
    expires_on=None,
    active=1,
):
    _require_operator()
    code = _normalize(code)
    if not code:
        frappe.throw(_("A coupon code is required."))
    if flt(discount_value) <= 0:
        frappe.throw(_("Enter a discount value."))

    name = frappe.db.get_value("Marketplace Coupon", {"code": code}, "name")
    doc = frappe.get_doc("Marketplace Coupon", name) if name else frappe.new_doc("Marketplace Coupon")
    doc.code = code
    doc.description = description
    doc.discount_type = discount_type if discount_type in ("Percentage", "Fixed") else "Percentage"
    doc.discount_value = flt(discount_value)
    doc.max_discount = flt(max_discount)
    doc.min_subtotal = flt(min_subtotal)
    doc.usage_limit = int(usage_limit or 0)
    doc.expires_on = expires_on or None
    doc.active = 1 if int(active or 0) else 0
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {f: doc.get(f) for f in COUPON_FIELDS}


@frappe.whitelist()
def delete_coupon(code):
    _require_operator()
    name = frappe.db.get_value("Marketplace Coupon", {"code": _normalize(code)}, "name")
    if name:
        frappe.delete_doc("Marketplace Coupon", name, ignore_permissions=True)
        frappe.db.commit()
    return {"deleted": name}

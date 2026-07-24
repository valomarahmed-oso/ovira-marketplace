"""Discount coupons.

Two kinds:
- **Platform coupon** (no vendor): an operator-funded promotion — it reduces what
  the shopper pays (booked as a discount on the customer Sales Invoice), but
  vendor settlement is untouched; the operator absorbs it out of its margin.
- **Vendor coupon** (vendor set): funded by that vendor. It only discounts the
  vendor's own items, is applied as a Net-Total discount on that vendor's Sales
  Order, and therefore flows straight through to a smaller customer invoice AND a
  smaller settlement payout — no operator money involved.

The discount is always recomputed server-side; the client's number is never
trusted.
"""

import json

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate

from ovira_marketplace.api.admin import _require_operator


def _normalize(code):
    return (code or "").strip().upper()


def _loads(value):
    return json.loads(value) if isinstance(value, str) else (value or [])


def _relevant_subtotal(coupon, subtotal, items):
    """Subtotal the coupon is measured against: the vendor's slice of the cart
    for a vendor coupon, else the whole cart subtotal. Throws if a vendor coupon
    is used on a cart with none of that vendor's items."""
    if not coupon.get("vendor"):
        return flt(subtotal)
    from ovira_marketplace.api.shipping import per_vendor_subtotals

    per_vendor = per_vendor_subtotals(_loads(items))
    vendor_sub = flt(per_vendor.get(coupon.get("vendor"), 0))
    if vendor_sub <= 0:
        store = frappe.db.get_value("Marketplace Vendor", coupon.get("vendor"), "vendor_name")
        frappe.throw(_("This coupon only applies to items from {0}.").format(store or _("this store")))
    return vendor_sub


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


def resolve(code, subtotal, items=None):
    """Return (coupon_doc, discount) for a usable coupon, or throw. Shared by the
    checkout so the discount recorded on the order is always the trusted one. For
    a vendor coupon the discount is measured against that vendor's slice of the
    cart (`items` required)."""
    name = frappe.db.get_value("Marketplace Coupon", {"code": _normalize(code)}, "name")
    if not name:
        frappe.throw(_("Invalid coupon code."))
    coupon = frappe.get_doc("Marketplace Coupon", name)
    base = _relevant_subtotal(coupon, subtotal, items)
    _check_eligible(coupon, base)
    discount = compute_discount(coupon, base)
    if discount <= 0:
        frappe.throw(_("This coupon doesn't apply to your cart."))
    return coupon, discount


@frappe.whitelist(allow_guest=True)
def validate_coupon(code, subtotal, items=None):
    """Storefront preview: the discount a coupon would give for a subtotal (and,
    for a vendor coupon, for that vendor's items in the cart)."""
    coupon, discount = resolve(code, subtotal, items)
    return {
        "code": coupon.code,
        "discount": discount,
        "discount_type": coupon.discount_type,
        "description": coupon.description,
        "vendor": coupon.vendor,
        "vendor_name": frappe.db.get_value("Marketplace Vendor", coupon.vendor, "vendor_name")
        if coupon.vendor
        else None,
    }


# -- operator management ----------------------------------------------------

COUPON_FIELDS = [
    "code",
    "description",
    "vendor",
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


def _save_coupon(code, vendor, fields):
    """Create/update a coupon (shared by operator + vendor entry points). `vendor`
    is the authoritative owner (None for a platform coupon); a vendor can never
    write another vendor's coupon."""
    code = _normalize(code)
    if not code:
        frappe.throw(_("A coupon code is required."))
    if flt(fields.get("discount_value")) <= 0:
        frappe.throw(_("Enter a discount value."))

    name = frappe.db.get_value("Marketplace Coupon", {"code": code}, "name")
    if name:
        existing_vendor = frappe.db.get_value("Marketplace Coupon", name, "vendor")
        # A vendor may only touch their own coupon; the code namespace is shared,
        # so a clashing code owned by someone else is rejected, not overwritten.
        if vendor and existing_vendor != vendor:
            frappe.throw(_("This coupon code is already taken."))
        doc = frappe.get_doc("Marketplace Coupon", name)
    else:
        doc = frappe.new_doc("Marketplace Coupon")
    doc.code = code
    doc.vendor = vendor or None
    doc.description = fields.get("description")
    dt = fields.get("discount_type")
    doc.discount_type = dt if dt in ("Percentage", "Fixed") else "Percentage"
    doc.discount_value = flt(fields.get("discount_value"))
    doc.max_discount = flt(fields.get("max_discount"))
    doc.min_subtotal = flt(fields.get("min_subtotal"))
    doc.usage_limit = int(fields.get("usage_limit") or 0)
    doc.expires_on = fields.get("expires_on") or None
    doc.active = 1 if int(fields.get("active") or 0) else 0
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {f: doc.get(f) for f in COUPON_FIELDS}


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
    vendor=None,
):
    """Operator: create/update a platform coupon (vendor empty) or a coupon on
    behalf of a specific vendor (vendor set)."""
    _require_operator()
    return _save_coupon(
        code,
        vendor or None,
        {
            "discount_type": discount_type,
            "discount_value": discount_value,
            "description": description,
            "max_discount": max_discount,
            "min_subtotal": min_subtotal,
            "usage_limit": usage_limit,
            "expires_on": expires_on,
            "active": active,
        },
    )


@frappe.whitelist()
def delete_coupon(code):
    _require_operator()
    name = frappe.db.get_value("Marketplace Coupon", {"code": _normalize(code)}, "name")
    if name:
        frappe.delete_doc("Marketplace Coupon", name, ignore_permissions=True)
        frappe.db.commit()
    return {"deleted": name}


# -- vendor self-service (each vendor funds their own coupons) ---------------


def _my_vendor_or_throw():
    from ovira_marketplace.api.vendor import _my_vendor

    vendor = _my_vendor()
    if not vendor:
        frappe.throw(_("You don't have a vendor store."), frappe.PermissionError)
    return vendor


@frappe.whitelist()
def my_coupons():
    """The signed-in vendor's own coupons."""
    vendor = _my_vendor_or_throw()
    return frappe.get_all(
        "Marketplace Coupon",
        filters={"vendor": vendor},
        fields=COUPON_FIELDS,
        order_by="modified desc",
        ignore_permissions=True,
    )


@frappe.whitelist()
def upsert_my_coupon(
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
    """Vendor: create/update one of THEIR own (vendor-funded) coupons."""
    vendor = _my_vendor_or_throw()
    return _save_coupon(
        code,
        vendor,
        {
            "discount_type": discount_type,
            "discount_value": discount_value,
            "description": description,
            "max_discount": max_discount,
            "min_subtotal": min_subtotal,
            "usage_limit": usage_limit,
            "expires_on": expires_on,
            "active": active,
        },
    )


@frappe.whitelist()
def delete_my_coupon(code):
    """Vendor: delete one of their own coupons."""
    vendor = _my_vendor_or_throw()
    name = frappe.db.get_value(
        "Marketplace Coupon", {"code": _normalize(code), "vendor": vendor}, "name"
    )
    if name:
        frappe.delete_doc("Marketplace Coupon", name, ignore_permissions=True)
        frappe.db.commit()
    return {"deleted": name}

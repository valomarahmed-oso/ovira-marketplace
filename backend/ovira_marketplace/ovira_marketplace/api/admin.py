"""Operator console API — read/write the marketplace configuration from the
storefront's own branded admin, instead of the ERPNext Desk.

Operator-only (System Manager / Marketplace Operator). The storefront renders
these under its own identity at /shop/admin.
"""

import frappe
from frappe import _
from frappe.utils import cint, flt

from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)

ADMIN_FIELDS = [
    "mode",
    "operator_company",
    "default_currency",
    "default_commission_rate",
    "auto_approve_vendors",
    "auto_approve_products",
    "sync_website_item",
    "deal_product",
    "sales_tax_template",
]

OPERATOR_ROLES = ("System Manager", "Marketplace Operator")


def _require_operator():
    user = frappe.session.user
    if user == "Guest" or not any(r in frappe.get_roles(user) for r in OPERATOR_ROLES):
        frappe.throw(_("هذه الصفحة متاحة لمشغّلي المتجر فقط."), frappe.PermissionError)


def _serialize(settings):
    data = {f: settings.get(f) for f in ADMIN_FIELDS}
    data["is_operator"] = True
    return data


@frappe.whitelist()
def get_admin_settings():
    _require_operator()
    return _serialize(get_settings())


@frappe.whitelist()
def update_admin_settings(
    mode=None,
    default_currency=None,
    default_commission_rate=None,
    auto_approve_vendors=None,
    auto_approve_products=None,
    sync_website_item=None,
    deal_product=None,
    sales_tax_template=None,
):
    _require_operator()
    settings = frappe.get_doc("Marketplace Settings")

    if mode is not None:
        if mode not in ("Multi Vendor", "Single Company"):
            frappe.throw(_("Invalid mode."))
        settings.mode = mode
    if default_currency is not None:
        settings.default_currency = default_currency or None
    if default_commission_rate is not None:
        settings.default_commission_rate = flt(default_commission_rate)
    if auto_approve_vendors is not None:
        settings.auto_approve_vendors = cint(auto_approve_vendors)
    if auto_approve_products is not None:
        settings.auto_approve_products = cint(auto_approve_products)
    if sync_website_item is not None:
        settings.sync_website_item = cint(sync_website_item)
    if deal_product is not None:
        settings.deal_product = deal_product or None
    if sales_tax_template is not None:
        settings.sales_tax_template = sales_tax_template or None

    settings.flags.ignore_permissions = True
    settings.save(ignore_permissions=True)
    frappe.clear_cache(doctype="Marketplace Settings")
    frappe.db.commit()
    return _serialize(settings)


@frappe.whitelist()
def product_options(limit=200):
    """Approved products for the 'deal of the day' selector."""
    _require_operator()
    return frappe.get_all(
        "Marketplace Product",
        filters={"approval_status": "Approved", "published": 1},
        fields=["name", "title"],
        order_by="title asc",
        limit_page_length=cint(limit),
        ignore_permissions=True,
    )

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
    "shipping_account",
    "shipping_mode",
    "default_warehouse",
    "store_credit_account",
    "loyalty_enabled",
    "loyalty_earn_rate",
    "loyalty_redeem_value",
    "loyalty_min_redeem",
]

OPERATOR_ROLES = ("System Manager", "Marketplace Operator")


def _require_operator():
    user = frappe.session.user
    if user == "Guest" or not any(r in frappe.get_roles(user) for r in OPERATOR_ROLES):
        frappe.throw(_("هذه الصفحة متاحة لمشغّلي المتجر فقط."), frappe.PermissionError)


def _serialize(settings):
    data = {f: settings.get(f) for f in ADMIN_FIELDS}
    data["is_operator"] = True
    try:
        from ovira_marketplace.emails import outgoing_configured

        data["email_configured"] = outgoing_configured()
    except Exception:
        data["email_configured"] = False
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
    shipping_account=None,
    shipping_mode=None,
    default_warehouse=None,
    store_credit_account=None,
    loyalty_enabled=None,
    loyalty_earn_rate=None,
    loyalty_redeem_value=None,
    loyalty_min_redeem=None,
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
    if shipping_account is not None:
        settings.shipping_account = shipping_account or None
    if shipping_mode is not None:
        if shipping_mode not in ("Operator", "Per Vendor"):
            frappe.throw(_("Invalid shipping mode."))
        settings.shipping_mode = shipping_mode
    if default_warehouse is not None:
        settings.default_warehouse = default_warehouse or None
    if store_credit_account is not None:
        settings.store_credit_account = store_credit_account or None
    if loyalty_enabled is not None:
        settings.loyalty_enabled = cint(loyalty_enabled)
    if loyalty_earn_rate is not None:
        settings.loyalty_earn_rate = flt(loyalty_earn_rate)
    if loyalty_redeem_value is not None:
        settings.loyalty_redeem_value = flt(loyalty_redeem_value)
    if loyalty_min_redeem is not None:
        settings.loyalty_min_redeem = cint(loyalty_min_redeem)

    settings.flags.ignore_permissions = True
    settings.save(ignore_permissions=True)
    frappe.clear_cache(doctype="Marketplace Settings")
    frappe.db.commit()
    return _serialize(settings)


EMAIL_ACCOUNT_NAME = "Ovira Outgoing"


@frappe.whitelist()
def get_email_config():
    """Current outgoing email account for the operator screen. The password is
    write-only — we report only whether one is stored, never its value."""
    _require_operator()
    acc = frappe.db.get_value(
        "Email Account",
        {"default_outgoing": 1, "enable_outgoing": 1},
        ["name", "email_id", "smtp_server", "smtp_port", "use_tls", "use_ssl", "login_id"],
        as_dict=True,
    )
    if not acc:
        return {"configured": False}
    return {
        "configured": True,
        "email_id": acc.email_id,
        "smtp_server": acc.smtp_server,
        "smtp_port": acc.smtp_port,
        "use_tls": cint(acc.use_tls),
        "use_ssl": cint(acc.use_ssl),
        "login_id": acc.login_id,
        "has_password": bool(
            frappe.db.get_value("Email Account", acc.name, "password")
        ),
    }


@frappe.whitelist()
def update_email_config(
    email_id,
    smtp_server,
    smtp_port=587,
    use_tls=1,
    use_ssl=0,
    password=None,
    login_id=None,
):
    """Create or update the marketplace's default **outgoing** ERPNext Email
    Account from the storefront admin — so operators configure order/return
    emails without opening the ERPNext Desk. ERPNext validates the SMTP
    connection on save, so a bad host/credential surfaces as an error here."""
    _require_operator()
    name = frappe.db.get_value(
        "Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
    )
    if name:
        acc = frappe.get_doc("Email Account", name)
    else:
        acc = frappe.new_doc("Email Account")
        acc.email_account_name = EMAIL_ACCOUNT_NAME

    acc.email_id = email_id
    acc.smtp_server = smtp_server
    acc.smtp_port = cint(smtp_port)
    acc.use_tls = cint(use_tls)
    acc.use_ssl = cint(use_ssl)
    acc.enable_outgoing = 1
    acc.default_outgoing = 1
    if login_id:
        acc.login_id_is_different = 1
        acc.login_id = login_id
    if password:
        acc.password = password
    acc.flags.ignore_permissions = True
    acc.save(ignore_permissions=True)
    frappe.db.commit()
    return get_email_config()


WHATSAPP_FIELDS = [
    "enabled",
    "api_base",
    "phone_number_id",
    "default_country_code",
    "template_order_confirmation",
    "template_order_status",
    "template_return_update",
    "template_delivery_otp",
    "template_lang",
]


@frappe.whitelist()
def get_whatsapp_config():
    """WhatsApp settings for the operator console. The access token is
    write-only: we only report whether one is stored, never its value."""
    _require_operator()
    doc = frappe.get_single("Marketplace WhatsApp Settings")
    data = {f: doc.get(f) for f in WHATSAPP_FIELDS}
    token = doc.get_password("access_token", raise_exception=False)
    data["has_token"] = bool(token)
    from ovira_marketplace.whatsapp import whatsapp_configured

    data["configured"] = whatsapp_configured()
    return data


@frappe.whitelist()
def update_whatsapp_config(
    enabled=None,
    api_base=None,
    phone_number_id=None,
    access_token=None,
    default_country_code=None,
    template_order_confirmation=None,
    template_order_status=None,
    template_return_update=None,
    template_delivery_otp=None,
    template_lang=None,
):
    _require_operator()
    doc = frappe.get_single("Marketplace WhatsApp Settings")
    if enabled is not None:
        doc.enabled = cint(enabled)
    for field in (
        "api_base",
        "phone_number_id",
        "default_country_code",
        "template_order_confirmation",
        "template_order_status",
        "template_return_update",
        "template_delivery_otp",
        "template_lang",
    ):
        val = locals().get(field)
        if val is not None:
            doc.set(field, val or None)
    # Only overwrite the token when a fresh non-empty value is supplied, so
    # saving other fields never wipes the stored secret.
    if access_token:
        doc.access_token = access_token

    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.clear_cache(doctype="Marketplace WhatsApp Settings")
    frappe.db.commit()
    return get_whatsapp_config()


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


@frappe.whitelist()
def update_site_content(
    brand_name=None,
    brand_name_en=None,
    footer_tagline=None,
    footer_tagline_en=None,
    support_email=None,
    about_content=None,
    about_content_en=None,
    careers_content=None,
    careers_content_en=None,
    terms_content=None,
    terms_content_en=None,
    privacy_content=None,
    privacy_content_en=None,
):
    """Operator: edit the dynamic site content (brand, footer tagline, and the
    About/Careers/Terms/Privacy pages) from the storefront admin. Each field has
    an Arabic value and an optional English (_en) value; the storefront serves the
    active locale and falls back to Arabic when the English value is blank."""
    _require_operator()
    doc = frappe.get_single("Marketplace Site Content")
    values = {
        "brand_name": brand_name,
        "brand_name_en": brand_name_en,
        "footer_tagline": footer_tagline,
        "footer_tagline_en": footer_tagline_en,
        "support_email": support_email,
        "about_content": about_content,
        "about_content_en": about_content_en,
        "careers_content": careers_content,
        "careers_content_en": careers_content_en,
        "terms_content": terms_content,
        "terms_content_en": terms_content_en,
        "privacy_content": privacy_content,
        "privacy_content_en": privacy_content_en,
    }
    for field, value in values.items():
        if value is not None:
            doc.set(field, value)
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    from ovira_marketplace.api.cms import get_site_content

    return get_site_content()

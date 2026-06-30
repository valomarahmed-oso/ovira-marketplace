"""Public marketplace configuration for the storefront.

Exposes only non-sensitive, operator-controlled settings the storefront needs
to adapt its UI (e.g. hide vendor sign-up in Single Company mode).
"""

import frappe

from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)


@frappe.whitelist(allow_guest=True)
def get_public_config():
    settings = get_settings()
    return {
        "mode": settings.mode,
        "multi_vendor": settings.mode == "Multi Vendor",
        "currency": settings.default_currency,
        "auto_approve_vendors": bool(settings.auto_approve_vendors),
    }

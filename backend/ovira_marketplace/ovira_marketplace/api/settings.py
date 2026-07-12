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
        # True only when a real online gateway is switched on, so the storefront
        # offers card payment instead of a permanent "coming soon".
        "online_payment": _online_payment_enabled(),
        # "Operator" (one operator rate table) or "Per Vendor" (each vendor sets
        # their own) — lets the storefront label shipping accordingly.
        "shipping_mode": settings.get("shipping_mode") or "Operator",
    }


def _online_payment_enabled():
    """Whether an online (non-COD/manual) payment connector is enabled."""
    for c in frappe.get_all("Payment Connector", filters={"enabled": 1}, fields=["provider"]):
        if (c.provider or "").strip().lower() not in ("cash on delivery", "cod", "manual"):
            return True
    return False

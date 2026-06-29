import frappe
from frappe.model.document import Document


class MarketplaceSettings(Document):
    def validate(self):
        if self.default_commission_rate and self.default_commission_rate < 0:
            frappe.throw(frappe._("Default commission rate cannot be negative."))


def get_settings():
    """Cached accessor for the single Marketplace Settings doc."""
    return frappe.get_cached_doc("Marketplace Settings")


def is_multi_vendor():
    return get_settings().mode == "Multi Vendor"

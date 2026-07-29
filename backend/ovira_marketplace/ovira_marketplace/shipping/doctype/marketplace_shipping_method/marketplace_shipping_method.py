import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt


class MarketplaceShippingMethod(Document):
    def validate(self):
        self.surcharge = max(0.0, flt(self.surcharge))
        self.eta_min_days = max(0, cint(self.eta_min_days))
        self.eta_max_days = max(0, cint(self.eta_max_days))
        # A window that runs backwards would print "3–1 days" at checkout.
        if self.eta_max_days and self.eta_max_days < self.eta_min_days:
            self.eta_max_days = self.eta_min_days

        if self.is_default:
            frappe.db.set_value(
                "Marketplace Shipping Method",
                {"is_default": 1, "name": ("!=", self.name)},
                "is_default",
                0,
                update_modified=False,
            )

    def on_trash(self):
        # Losing the last method silently turns the picker off mid-checkout.
        others = frappe.db.count("Marketplace Shipping Method", {"enabled": 1, "name": ("!=", self.name)})
        if self.enabled and not others:
            frappe.throw(_("This is the only enabled shipping method — add another before deleting it."))

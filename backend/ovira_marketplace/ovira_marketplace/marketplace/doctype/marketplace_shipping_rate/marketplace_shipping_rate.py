import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt


class MarketplaceShippingRate(Document):
    def validate(self):
        self.governorate = (self.governorate or "").strip()
        if not self.governorate:
            frappe.throw(_("Enter a governorate."))
        if flt(self.fee) < 0:
            frappe.throw(_("The fee can't be negative."))
        if flt(self.free_threshold) < 0:
            frappe.throw(_("The free-shipping threshold can't be negative."))
        if cint(self.eta_days) < 0:
            self.eta_days = 0

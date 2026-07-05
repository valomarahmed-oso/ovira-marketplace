import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint


class MarketplaceLoyaltyEntry(Document):
    def validate(self):
        if cint(self.points) <= 0:
            frappe.throw(_("Points must be a positive number."))

import frappe
from frappe.model.document import Document


class MarketplaceBanner(Document):
    def validate(self):
        if self.valid_from and self.valid_upto and self.valid_from > self.valid_upto:
            frappe.throw(frappe._("\"Valid from\" must be before \"Valid upto\"."))

import frappe
from frappe.model.document import Document


class MarketplaceCoupon(Document):
    def validate(self):
        if self.code:
            self.code = self.code.strip().upper()
        if self.used_count is None:
            self.used_count = 0

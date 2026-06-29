import frappe
from frappe.model.document import Document


class ShippingProvider(Document):
    def get_password_safe(self, fieldname):
        if not self.get(fieldname):
            return None
        return self.get_password(fieldname)

import frappe
from frappe.model.document import Document


class PaymentConnector(Document):
    def get_password_safe(self, fieldname):
        """Return a decrypted password field, or None if unset."""
        if not self.get(fieldname):
            return None
        return self.get_password(fieldname)

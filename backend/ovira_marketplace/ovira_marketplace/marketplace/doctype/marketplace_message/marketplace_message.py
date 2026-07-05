import frappe
from frappe import _
from frappe.model.document import Document


class MarketplaceMessage(Document):
    def validate(self):
        self.body = (self.body or "").strip()
        if not self.body:
            frappe.throw(_("The message can't be empty."))
        # Guard the length so one message can't be used to store a payload.
        if len(self.body) > 2000:
            frappe.throw(_("Message is too long (max 2000 characters)."))

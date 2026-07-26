"""A customer support conversation with the store.

Distinct from `Marketplace Message`, which is order-and-vendor scoped: a ticket
reaches the operator, about anything — payment, delivery, account — including
matters with no single vendor to address.
"""

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class MarketplaceSupportTicket(Document):
    def before_insert(self):
        if not self.last_activity:
            self.last_activity = now_datetime()

    def on_trash(self):
        """Messages live in their own doctype, so they'd otherwise be orphaned."""
        for row in frappe.get_all(
            "Marketplace Support Message", filters={"ticket": self.name}, pluck="name"
        ):
            frappe.delete_doc(
                "Marketplace Support Message", row, ignore_permissions=True, force=True
            )

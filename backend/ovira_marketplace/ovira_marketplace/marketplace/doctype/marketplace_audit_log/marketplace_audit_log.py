"""One operator action that moved money, stock or an order's state.

Deliberately **append-only from the app's side**: nothing in the codebase updates
or deletes a row here, and no role has write or delete permission. An audit trail
an operator can edit answers no question worth asking.
"""

import frappe
from frappe.model.document import Document


class MarketplaceAuditLog(Document):
    def before_insert(self):
        if not self.actor:
            self.actor = frappe.session.user

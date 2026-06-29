import frappe
from frappe.model.document import Document

from ovira_marketplace.permissions import is_privileged, vendor_for_user


class MarketplaceVendorExpense(Document):
    def before_validate(self):
        # A vendor can only file expenses against their own store.
        if not is_privileged():
            mine = vendor_for_user()
            if mine:
                self.vendor = mine

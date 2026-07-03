import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, get_datetime


class MarketplaceFlashDeal(Document):
    def validate(self):
        if flt(self.deal_price) <= 0:
            frappe.throw(_("Enter a deal price."))
        if self.starts_on and self.ends_on and get_datetime(self.ends_on) <= get_datetime(self.starts_on):
            frappe.throw(_("The deal must end after it starts."))
        # A deal that isn't below the product's current price would be a non-deal.
        price = flt(frappe.db.get_value("Marketplace Product", self.product, "price"))
        if price and flt(self.deal_price) >= price:
            frappe.throw(_("Deal price must be below the product's current price."))
        if self.sold is None:
            self.sold = 0

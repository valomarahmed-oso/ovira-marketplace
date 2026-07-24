import frappe
from frappe.model.document import Document


class MarketplaceShippingCarrier(Document):
    def build_tracking_url(self, tracking_number):
        """Fill this carrier's tracking-URL template with a tracking number.
        Returns None when there is no template or no number."""
        template = (self.tracking_url_template or "").strip()
        number = (tracking_number or "").strip()
        if not template or not number:
            return None
        if "{tracking}" in template:
            return template.replace("{tracking}", number)
        return template.rstrip("/") + "/" + number

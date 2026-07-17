import frappe
from frappe.model.document import Document


class MarketplaceSiteContent(Document):
    pass


def get_site_content_doc():
    """The Single doc, created on first access."""
    return frappe.get_single("Marketplace Site Content")

from frappe.model.document import Document


class MarketplaceProductStat(Document):
    """A day's interest in one product. Written only by the counters in
    `api/product_stats.py`, never by hand."""

    pass

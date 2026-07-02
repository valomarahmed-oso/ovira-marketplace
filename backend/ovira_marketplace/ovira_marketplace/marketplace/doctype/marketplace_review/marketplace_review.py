import frappe
from frappe.model.document import Document
from frappe.utils import cint, flt


class MarketplaceReview(Document):
    def validate(self):
        self.rating = max(1, min(5, cint(self.rating)))
        if not self.status:
            self.status = "Published"

    def on_update(self):
        recompute_product_rating(self.product)

    def on_trash(self):
        recompute_product_rating(self.product)


def recompute_product_rating(product):
    """Roll published reviews up onto the product so cards/detail show a real
    average without an aggregate query per render."""
    if not product:
        return
    rows = frappe.get_all(
        "Marketplace Review",
        filters={"product": product, "status": "Published"},
        pluck="rating",
        ignore_permissions=True,
    )
    ratings = [flt(r) for r in rows if r]
    avg = round(sum(ratings) / len(ratings), 1) if ratings else 0
    frappe.db.set_value(
        "Marketplace Product",
        product,
        {"rating": avg, "review_count": len(ratings)},
        update_modified=False,
    )

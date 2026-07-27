from frappe.model.document import Document


class MarketplacePriceWatch(Document):
    """One shopper's baseline price for one wishlisted product.

    Deliberately not a price history: the only question this has to answer is
    "is it cheaper than when they last looked?", and keeping one number per
    (shopper, product) answers it without a table that grows forever.
    """

    pass

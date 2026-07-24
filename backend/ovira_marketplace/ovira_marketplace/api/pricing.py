"""Server-side price resolution shared by checkout + shipping/coupon previews.

Keeps the "never trust the client's price" rule in one place: bulk/quantity
tiers are applied here so the same unit price is used everywhere an order is
priced or previewed.
"""

import frappe
from frappe.utils import cint, flt


def tier_unit_rate(product_name, qty, base_price):
    """Lowest applicable bulk-tier unit price for a quantity, else the base price.

    Tiers are (min_qty, price) rows on the product; the highest min_qty that the
    quantity reaches wins. Only lowers the price (a tier above the base is
    ignored), and never applies to qty < 2."""
    base = flt(base_price)
    qty = cint(qty)
    if qty < 2:
        return base
    tiers = frappe.get_all(
        "Marketplace Price Tier",
        filters={"parent": product_name, "parenttype": "Marketplace Product"},
        fields=["min_qty", "price"],
        order_by="min_qty asc",
        ignore_permissions=True,
    )
    rate = base
    for tr in tiers:
        price = flt(tr.price)
        if price > 0 and qty >= cint(tr.min_qty) and price < rate:
            rate = price
    return rate


@frappe.whitelist(allow_guest=True)
def price_tiers(product):
    """Public: the bulk tiers for a product (slug or docname), cheapest last."""
    name = frappe.db.get_value(
        "Marketplace Product",
        {"slug": product, "approval_status": "Approved", "published": 1},
        "name",
    ) or frappe.db.get_value(
        "Marketplace Product",
        {"name": product, "approval_status": "Approved", "published": 1},
        "name",
    )
    if not name:
        return []
    return frappe.get_all(
        "Marketplace Price Tier",
        filters={"parent": name, "parenttype": "Marketplace Product"},
        fields=["min_qty", "price"],
        order_by="min_qty asc",
        ignore_permissions=True,
    )

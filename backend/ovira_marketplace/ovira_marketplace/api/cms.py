"""Homepage content API — fully operator-controlled from ERPNext.

Everything the storefront homepage renders (hero, promo banners, the deal of
the day, and the product rails) is resolved here from the Marketplace Banner /
Marketplace Homepage Section doctypes + Marketplace Settings, so an operator can
change it from the Desk with no redeploy.
"""

import frappe
from frappe.utils import cint, flt, now_datetime

from ovira_marketplace.api.catalog import PRODUCT_LIST_FIELDS, _attach_card_fields
from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)

BANNER_FIELDS = [
    "name",
    "title",
    "subtitle",
    "image",
    "link",
    "cta_label",
    "tone",
    "placement",
    "display_order",
    "valid_from",
    "valid_upto",
]


@frappe.whitelist(allow_guest=True)
def get_homepage():
    """One call that returns the whole dynamic homepage."""
    banners = _active_banners()
    sections = [_resolve_section(s) for s in _active_sections()]
    return {
        "hero": [b for b in banners if b.get("placement") == "Hero"],
        "promos": [b for b in banners if b.get("placement") == "Promo"],
        "deal": _deal_product(),
        "sections": [s for s in sections if s.get("products")],
    }


# -- banners ----------------------------------------------------------------

def _active_banners():
    rows = frappe.get_all(
        "Marketplace Banner",
        filters={"is_active": 1},
        fields=BANNER_FIELDS,
        order_by="display_order asc, creation asc",
        ignore_permissions=True,
    )
    now = now_datetime()
    live = []
    for b in rows:
        if b.valid_from and b.valid_from > now:
            continue
        if b.valid_upto and b.valid_upto < now:
            continue
        live.append(b)
    return live


# -- product rails ----------------------------------------------------------

def _active_sections():
    return frappe.get_all(
        "Marketplace Homepage Section",
        filters={"is_active": 1},
        fields=["name", "heading", "source", "category", "item_limit", "link"],
        order_by="display_order asc, creation asc",
        ignore_permissions=True,
    )


def _resolve_section(section):
    limit = cint(section.item_limit) or 8
    products = _section_products(section.source, section.category, limit)
    return {
        "heading": section.heading,
        "link": section.link or _default_link(section.source, section.category),
        "products": products,
    }


def _section_products(source, category, limit):
    base = {"approval_status": "Approved", "published": 1}

    if source == "Category" and category:
        rows = _list(dict(base, category=category), limit, "creation desc")
    elif source == "Discounted":
        # compare_at_price set; keep only genuine markdowns, biggest first.
        rows = _list(dict(base, compare_at_price=[">", 0]), limit * 3, "creation desc")
        rows = [r for r in rows if flt(r.compare_at_price) > flt(r.price)]
        rows.sort(key=lambda r: flt(r.compare_at_price) - flt(r.price), reverse=True)
        rows = rows[:limit]
    elif source == "Best Selling":
        rows = _best_selling(base, limit)
    else:  # Latest (default)
        rows = _list(base, limit, "creation desc")

    _attach_card_fields(rows)
    return rows


def _list(filters, limit, order_by):
    return frappe.get_all(
        "Marketplace Product",
        filters=filters,
        fields=PRODUCT_LIST_FIELDS,
        limit_page_length=limit,
        order_by=order_by,
        ignore_permissions=True,
    )


def _best_selling(base, limit):
    """Rank approved products by quantity sold (storefront orders)."""
    lines = frappe.get_all(
        "Marketplace Order Item",
        fields=["marketplace_product", "qty"],
        ignore_permissions=True,
    )
    sold = {}
    for line in lines:
        if line.marketplace_product:
            sold[line.marketplace_product] = sold.get(line.marketplace_product, 0) + (line.qty or 0)

    if not sold:
        return _list(base, limit, "creation desc")

    top = sorted(sold, key=sold.get, reverse=True)
    rows = _list(dict(base, name=["in", top]), len(top), "creation desc")
    order = {name: i for i, name in enumerate(top)}
    rows.sort(key=lambda r: order.get(r.name, 1e9))
    return rows[:limit]


def _default_link(source, category):
    if source == "Category" and category:
        slug = frappe.db.get_value("Marketplace Category", category, "slug")
        return f"/category/{slug}" if slug else "/products"
    return "/products"


# -- deal of the day --------------------------------------------------------

def _deal_product():
    settings = get_settings()
    name = settings.get("deal_product")

    if not name:
        # Auto-pick the in-stock product with the deepest absolute markdown.
        candidates = _list(
            {"approval_status": "Approved", "published": 1, "compare_at_price": [">", 0]},
            30,
            "creation desc",
        )
        candidates = [c for c in candidates if flt(c.compare_at_price) > flt(c.price)]
        candidates.sort(key=lambda r: flt(r.compare_at_price) - flt(r.price), reverse=True)
        name = candidates[0].name if candidates else None

    if not name:
        return None

    row = frappe.db.get_value(
        "Marketplace Product",
        {"name": name, "approval_status": "Approved", "published": 1},
        PRODUCT_LIST_FIELDS,
        as_dict=True,
    )
    if not row:
        return None
    rows = [row]
    _attach_card_fields(rows)
    return rows[0]

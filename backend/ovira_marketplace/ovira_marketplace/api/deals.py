"""Flash deals — time-limited promotional pricing.

A flash deal is **vendor-funded**: it replaces the line rate at checkout with the
deal price, server-side. Because per-vendor settlement derives from the Sales
Order net total (which follows that rate), the vendor is simply paid on the
discounted price — the same money path as a normal sale, just at a lower rate.
No operator absorption, no invoice-level discount. The client's price is never
trusted; the active deal is always re-resolved on the server.

Deals apply to single-price products only for now (a product with variants
carries its own per-variant prices).
"""

import frappe
from frappe import _
from frappe.utils import cint, flt, get_datetime, now_datetime

from ovira_marketplace.api.admin import _require_operator

DEAL_FIELDS = [
    "name",
    "product",
    "deal_price",
    "starts_on",
    "ends_on",
    "stock_limit",
    "sold",
    "active",
]


def _is_live(deal, now):
    """Is this deal currently sellable: active, within its window, not sold out."""
    if not deal.get("active"):
        return False
    ends = deal.get("ends_on")
    if not ends or get_datetime(ends) < now:
        return False
    starts = deal.get("starts_on")
    if starts and get_datetime(starts) > now:
        return False
    limit = cint(deal.get("stock_limit"))
    if limit and cint(deal.get("sold")) >= limit:
        return False
    return True


def active_deal_map(product_names):
    """Map {product: {name, deal_price, ends_on, remaining}} for products with a
    live deal right now. One query for the whole set; the soonest-ending live
    deal wins when a product somehow has more than one."""
    names = [n for n in set(product_names or []) if n]
    if not names:
        return {}
    now = now_datetime()
    rows = frappe.get_all(
        "Marketplace Flash Deal",
        filters={"product": ["in", names], "active": 1},
        fields=DEAL_FIELDS,
        ignore_permissions=True,
    )
    best: dict = {}
    for d in rows:
        if not _is_live(d, now):
            continue
        cur = best.get(d.product)
        if cur and get_datetime(cur["ends_on"]) <= get_datetime(d.ends_on):
            continue
        limit = cint(d.stock_limit)
        best[d.product] = {
            "name": d.name,
            "deal_price": flt(d.deal_price),
            "ends_on": str(d.ends_on),
            "remaining": (limit - cint(d.sold)) if limit else None,
        }
    return best


def active_deal(product_name):
    """The live deal for one product, or None."""
    return active_deal_map([product_name]).get(product_name)


def redeem_deal(name, qty):
    """Bump a deal's sold count after an order (best-effort; never blocks it)."""
    try:
        sold = cint(frappe.db.get_value("Marketplace Flash Deal", name, "sold"))
        frappe.db.set_value("Marketplace Flash Deal", name, "sold", sold + cint(qty))
    except Exception:
        frappe.log_error(title="Ovira: flash deal redeem failed")


@frappe.whitelist(allow_guest=True)
def list_deals(limit=24):
    """Public feed for the /deals page: products with a live flash deal, soonest
    to end first. Cards already carry the deal price + `deal_ends_on` (attached by
    the catalog card builder)."""
    from ovira_marketplace.api.catalog import (
        PRODUCT_LIST_FIELDS,
        _attach_card_fields,
        visibility_filters,
    )

    now = now_datetime()
    rows = frappe.get_all(
        "Marketplace Flash Deal",
        filters={"active": 1, "ends_on": [">=", now]},
        fields=DEAL_FIELDS,
        order_by="ends_on asc",
        ignore_permissions=True,
    )
    names = [d.product for d in rows if _is_live(d, now)]
    if not names:
        return []

    products = frappe.get_all(
        "Marketplace Product",
        filters=visibility_filters([["name", "in", names]]),
        fields=PRODUCT_LIST_FIELDS,
        ignore_permissions=True,
    )
    _attach_card_fields(products)  # attaches the live deal (price + deal_ends_on)
    live = [p for p in products if p.get("deal_ends_on")]
    live.sort(key=lambda p: p.get("deal_ends_on") or "")
    return live[: cint(limit) or 24]


# -- operator management ----------------------------------------------------

DEAL_OP_FIELDS = [
    "name",
    "product",
    "deal_price",
    "starts_on",
    "ends_on",
    "stock_limit",
    "sold",
    "active",
]


@frappe.whitelist()
def list_all_deals():
    _require_operator()
    rows = frappe.get_all(
        "Marketplace Flash Deal",
        fields=DEAL_OP_FIELDS,
        order_by="ends_on desc",
        ignore_permissions=True,
    )
    titles = {}
    prices = {}
    prods = {r.product for r in rows if r.product}
    if prods:
        for p in frappe.get_all(
            "Marketplace Product",
            filters={"name": ["in", list(prods)]},
            fields=["name", "title", "price", "slug"],
            ignore_permissions=True,
        ):
            titles[p.name] = p.title
            prices[p.name] = {"price": flt(p.price), "slug": p.slug}
    now = now_datetime()
    for r in rows:
        r["product_title"] = titles.get(r.product)
        r["product_price"] = prices.get(r.product, {}).get("price")
        r["product_slug"] = prices.get(r.product, {}).get("slug")
        r["is_live"] = _is_live(r, now)
    return rows


@frappe.whitelist()
def upsert_deal(
    product,
    deal_price,
    ends_on,
    starts_on=None,
    stock_limit=0,
    active=1,
    name=None,
):
    _require_operator()
    prod = frappe.db.get_value(
        "Marketplace Product", {"slug": product}, ["name", "price", "has_variants"], as_dict=True
    ) or frappe.db.get_value(
        "Marketplace Product", product, ["name", "price", "has_variants"], as_dict=True
    )
    if not prod:
        frappe.throw(_("Product not found."))
    if prod.has_variants:
        frappe.throw(_("Flash deals aren't supported on products with variants yet."))
    if flt(deal_price) <= 0:
        frappe.throw(_("Enter a deal price."))
    if flt(deal_price) >= flt(prod.price):
        frappe.throw(_("Deal price must be below the current price ({0}).").format(flt(prod.price)))
    if not ends_on:
        frappe.throw(_("Set an end time for the deal."))

    doc = (
        frappe.get_doc("Marketplace Flash Deal", name)
        if name and frappe.db.exists("Marketplace Flash Deal", name)
        else frappe.new_doc("Marketplace Flash Deal")
    )
    doc.product = prod.name
    doc.deal_price = flt(deal_price)
    doc.starts_on = starts_on or now_datetime()
    doc.ends_on = ends_on
    doc.stock_limit = cint(stock_limit)
    doc.active = 1 if cint(active) else 0
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {f: doc.get(f) for f in DEAL_OP_FIELDS}


@frappe.whitelist()
def delete_deal(name):
    _require_operator()
    if frappe.db.exists("Marketplace Flash Deal", name):
        frappe.delete_doc("Marketplace Flash Deal", name, ignore_permissions=True)
        frappe.db.commit()
    return {"deleted": name}

"""Sponsored placements — operator-monetized promoted products.

A placement pins a product to a labelled "Sponsored" strip above the catalog
listing (globally, or scoped to one category). It is **operator ad revenue**,
tracked independently of order settlement: each shopper click charges the
campaign `cpc`, accruing `spend` until it reaches `budget` (0 = unlimited), at
which point the placement pauses. The product still sells through the normal
Sales Order path at its normal price — sponsoring only buys visibility, it never
touches the vendor's payout or the buyer's price.

Everything is re-resolved server-side: the client only ever names a placement to
attribute a click; it can't move a product into a strip or set what it costs.
"""

import frappe
from frappe.rate_limiter import rate_limit
from frappe.utils import cint, flt, get_datetime, now_datetime

from ovira_marketplace.api.admin import _require_operator

SPON_FIELDS = [
    "name",
    "product",
    "active",
    "priority",
    "target_category",
    "starts_on",
    "ends_on",
    "budget",
    "cpc",
    "clicks",
    "impressions",
    "spend",
]


def _is_live(row, now):
    """Is this placement currently servable: active, inside its window, and still
    within budget."""
    if not row.get("active"):
        return False
    ends = row.get("ends_on")
    if not ends or get_datetime(ends) < now:
        return False
    starts = row.get("starts_on")
    if starts and get_datetime(starts) > now:
        return False
    budget = flt(row.get("budget"))
    if budget and flt(row.get("spend")) >= budget:
        return False
    return True


def _resolve_category(category):
    """Accept a category slug (storefront URLs) or a docname; return the docname."""
    if not category:
        return None
    return frappe.db.get_value("Marketplace Category", {"slug": category}, "name") or category


@frappe.whitelist(allow_guest=True)
def sponsored_products(category=None, limit=8):
    """Public sponsored strip for a listing. Returns approved+published product
    cards, highest-priority first, each carrying `sponsored: True` and the
    `placement` id used to attribute a later click.

    Scope: a placement with a `target_category` shows only on that category's
    page; a blank one shows across the whole catalog (and on any category)."""
    from ovira_marketplace.api.catalog import (
        PRODUCT_LIST_FIELDS,
        _attach_card_fields,
        visibility_filters,
    )

    limit = min(cint(limit) or 8, 12)
    now = now_datetime()
    cat_name = _resolve_category(category)

    rows = frappe.get_all(
        "Marketplace Sponsored Placement",
        filters={"active": 1},
        fields=SPON_FIELDS,
        order_by="priority desc, creation asc",
        ignore_permissions=True,
    )

    placement_by_product: dict[str, str] = {}
    ordered: list[str] = []
    for r in rows:
        if not _is_live(r, now):
            continue
        tgt = r.get("target_category")
        if tgt and tgt != cat_name:
            continue
        if r.product in placement_by_product:  # one live placement per product
            continue
        placement_by_product[r.product] = r.name
        ordered.append(r.product)
        if len(ordered) >= limit:
            break

    if not ordered:
        return []

    products = frappe.get_all(
        "Marketplace Product",
        filters=visibility_filters([["name", "in", ordered]]),
        fields=PRODUCT_LIST_FIELDS,
        ignore_permissions=True,
    )
    by_name = {p.name: p for p in products}
    # Preserve priority order and drop any that failed the publish filter.
    products = [by_name[n] for n in ordered if n in by_name]
    if not products:
        return []

    _attach_card_fields(products)
    for p in products:
        p["sponsored"] = True
        p["placement"] = placement_by_product.get(p.name)

    _bump_impressions([p["placement"] for p in products])
    return products


def _bump_impressions(placements):
    """Count one impression per placement actually rendered (best-effort — a
    metrics hiccup must never break the listing)."""
    names = [n for n in placements if n]
    if not names:
        return
    try:
        frappe.db.sql(
            "UPDATE `tabMarketplace Sponsored Placement`"
            " SET impressions = impressions + 1 WHERE name IN %(names)s",
            {"names": tuple(names)},
        )
        frappe.db.commit()
    except Exception:
        frappe.log_error(title="Ovira: sponsored impressions bump failed")


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=120, seconds=60, methods="POST")
def record_sponsored_click(placement):
    """Attribute a shopper click to a placement: +1 click and +cpc spend. Idle
    once the placement is gone/inactive. Best-effort billing beacon."""
    try:
        row = frappe.db.get_value(
            "Marketplace Sponsored Placement",
            placement,
            ["clicks", "spend", "cpc", "active"],
            as_dict=True,
        )
        if not row or not row.active:
            return {"ok": False}
        frappe.db.set_value(
            "Marketplace Sponsored Placement",
            placement,
            {"clicks": cint(row.clicks) + 1, "spend": flt(row.spend) + flt(row.cpc)},
            update_modified=False,
        )
        frappe.db.commit()
    except Exception:
        frappe.log_error(title="Ovira: sponsored click record failed")
    return {"ok": True}


# -- operator management ----------------------------------------------------


@frappe.whitelist()
def list_all_sponsored():
    _require_operator()
    rows = frappe.get_all(
        "Marketplace Sponsored Placement",
        fields=SPON_FIELDS,
        order_by="priority desc, ends_on desc",
        ignore_permissions=True,
    )
    prods = {r.product for r in rows if r.product}
    meta: dict = {}
    if prods:
        for p in frappe.get_all(
            "Marketplace Product",
            filters={"name": ["in", list(prods)]},
            fields=["name", "title", "price", "slug"],
            ignore_permissions=True,
        ):
            meta[p.name] = p
    cats = {r.target_category for r in rows if r.target_category}
    cat_names: dict = {}
    if cats:
        for c in frappe.get_all(
            "Marketplace Category",
            filters={"name": ["in", list(cats)]},
            fields=["name", "category_name"],
            ignore_permissions=True,
        ):
            cat_names[c.name] = c.category_name
    now = now_datetime()
    for r in rows:
        m = meta.get(r.product)
        r["product_title"] = m.title if m else None
        r["product_slug"] = m.slug if m else None
        r["target_category_name"] = cat_names.get(r.target_category)
        r["is_live"] = _is_live(r, now)
        clicks = cint(r.clicks)
        impr = cint(r.impressions)
        r["ctr"] = round(clicks * 100.0 / impr, 1) if impr else 0.0
    return rows


@frappe.whitelist()
def upsert_sponsored(
    product,
    ends_on,
    starts_on=None,
    target_category=None,
    priority=0,
    budget=0,
    cpc=0,
    active=1,
    name=None,
):
    _require_operator()
    prod = frappe.db.get_value(
        "Marketplace Product", {"slug": product}, "name"
    ) or frappe.db.get_value("Marketplace Product", product, "name")
    if not prod:
        frappe.throw(frappe._("Product not found."))
    if not ends_on:
        frappe.throw(frappe._("Set an end time for the placement."))

    cat = None
    if target_category:
        cat = frappe.db.get_value(
            "Marketplace Category", {"slug": target_category}, "name"
        ) or (target_category if frappe.db.exists("Marketplace Category", target_category) else None)
        if not cat:
            frappe.throw(frappe._("Target category not found."))

    doc = (
        frappe.get_doc("Marketplace Sponsored Placement", name)
        if name and frappe.db.exists("Marketplace Sponsored Placement", name)
        else frappe.new_doc("Marketplace Sponsored Placement")
    )
    doc.product = prod
    doc.ends_on = ends_on
    doc.starts_on = starts_on or now_datetime()
    doc.target_category = cat
    doc.priority = cint(priority)
    doc.budget = flt(budget)
    doc.cpc = flt(cpc)
    doc.active = 1 if cint(active) else 0
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {f: doc.get(f) for f in SPON_FIELDS}


@frappe.whitelist()
def delete_sponsored(name):
    _require_operator()
    if frappe.db.exists("Marketplace Sponsored Placement", name):
        frappe.delete_doc("Marketplace Sponsored Placement", name, ignore_permissions=True)
        frappe.db.commit()
    return {"deleted": name}

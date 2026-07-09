import frappe
from frappe import _
from frappe.utils import cint, flt

PRODUCT_LIST_FIELDS = [
    "name",
    "title",
    "slug",
    "price",
    "compare_at_price",
    "currency",
    "vendor",
    "category",
    "brand",
    "stock_qty",
    "rating",
    "review_count",
    "has_variants",
]

SORT_MAP = {
    "price_asc": "price asc",
    "price_desc": "price desc",
    "latest": "creation desc",
    "rating": "rating desc, review_count desc",
}

# Search ordering, aliased to the product table so it stays unambiguous once the
# category/vendor tables are joined in (both of those also carry a `creation`).
SEARCH_SORT = {
    "price_asc": "p.price ASC",
    "price_desc": "p.price DESC",
    "latest": "p.creation DESC",
    "rating": "p.rating DESC, p.review_count DESC",
}

# Joined so search can match a product by its category or vendor display name,
# not only the docname stored on the product.
SEARCH_JOINS = (
    " LEFT JOIN `tabMarketplace Category` c ON c.name = p.category"
    " LEFT JOIN `tabMarketplace Vendor` v ON v.name = p.vendor"
)


def _search_tokens(search):
    """Whitespace tokens of a query, capped so a pathological query can't blow up
    the generated SQL. Empty when there's nothing to search."""
    return [t for t in (search or "").strip().split() if t][:6]


def _like_escape(term):
    """Escape LIKE wildcards so a literal % or _ typed by a shopper is matched
    literally, not treated as a wildcard."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _like_contains(term):
    return f"%{_like_escape(term)}%"


def _like_prefix(term):
    return f"{_like_escape(term)}%"


def _hard_where_sql(params, category, vendor, brand, min_price, max_price, in_stock):
    """The non-text WHERE clauses (approval + published + facet filters) as raw SQL,
    mirroring `_catalog_filters` for the search query builder. Values go through
    `params` so nothing is interpolated into the SQL string."""
    clauses = ["p.approval_status = 'Approved'", "p.published = 1"]
    if category:
        docname = frappe.db.get_value("Marketplace Category", {"slug": category}, "name")
        params["f_category"] = docname or category
        clauses.append("p.category = %(f_category)s")
    if vendor:
        params["f_vendor"] = vendor
        clauses.append("p.vendor = %(f_vendor)s")
    if brand:
        brands = [b.strip() for b in str(brand).split(",") if b.strip()]
        if brands:
            params["f_brands"] = tuple(brands)
            clauses.append("p.brand IN %(f_brands)s")
    if min_price not in (None, ""):
        params["f_min"] = flt(min_price)
        clauses.append("p.price >= %(f_min)s")
    if max_price not in (None, ""):
        params["f_max"] = flt(max_price)
        clauses.append("p.price <= %(f_max)s")
    if cint(in_stock):
        clauses.append("p.stock_qty > 0")
    return " AND ".join(clauses)


def _gate_sql(params, tokens):
    """Every token must appear in at least one searched field (AND of ORs), so a
    two-word query narrows results instead of widening them."""
    clauses = []
    for i, tok in enumerate(tokens):
        key = f"c{i}"
        params[key] = _like_contains(tok)
        clauses.append(
            f"(p.title LIKE %({key})s OR p.short_description LIKE %({key})s"
            f" OR p.description LIKE %({key})s OR p.brand LIKE %({key})s"
            f" OR c.category_name LIKE %({key})s OR v.vendor_name LIKE %({key})s)"
        )
    return " AND ".join(clauses)


def _score_sql(params, search, tokens):
    """Relevance score: whole-query title hits rank highest, then per-token title
    hits, then brand/category/vendor, then descriptions. Assumes `_gate_sql` has
    already registered the per-token `c{i}` contains params."""
    params["q_exact"] = search
    params["q_prefix"] = _like_prefix(search)
    params["q_like"] = _like_contains(search)
    parts = [
        "CASE WHEN p.title = %(q_exact)s THEN 1000 ELSE 0 END",
        "CASE WHEN p.title LIKE %(q_prefix)s THEN 300 ELSE 0 END",
        "CASE WHEN p.title LIKE %(q_like)s THEN 120 ELSE 0 END",
    ]
    for i in range(len(tokens)):
        key = f"c{i}"
        pfx = f"c{i}p"
        params[pfx] = _like_prefix(tokens[i])
        parts += [
            f"CASE WHEN p.title LIKE %({pfx})s THEN 40 ELSE 0 END",
            f"CASE WHEN p.title LIKE %({key})s THEN 25 ELSE 0 END",
            f"CASE WHEN p.brand LIKE %({key})s THEN 12 ELSE 0 END",
            f"CASE WHEN c.category_name LIKE %({key})s THEN 10 ELSE 0 END",
            f"CASE WHEN v.vendor_name LIKE %({key})s THEN 8 ELSE 0 END",
            f"CASE WHEN p.short_description LIKE %({key})s THEN 5 ELSE 0 END",
            f"CASE WHEN p.description LIKE %({key})s THEN 1 ELSE 0 END",
        ]
    return " + ".join(parts)


def _search_products(
    search, tokens, sort, limit, start,
    category=None, vendor=None, brand=None, min_price=None, max_price=None, in_stock=None,
):
    """Relevance-ranked catalog search across title, descriptions, brand, category
    and vendor name. Returns rows shaped like `PRODUCT_LIST_FIELDS`."""
    params: dict = {}
    hard = _hard_where_sql(params, category, vendor, brand, min_price, max_price, in_stock)
    gate = _gate_sql(params, tokens)  # registers c{i}
    score = _score_sql(params, search, tokens)  # registers q_* and c{i}p

    cols = ", ".join(f"p.`{f}`" for f in PRODUCT_LIST_FIELDS)
    order = SEARCH_SORT.get(sort) or "_score DESC, p.rating DESC, p.creation DESC"
    params["limit"] = cint(limit) or 24
    params["start"] = cint(start) or 0

    query = (
        f"SELECT {cols}, ({score}) AS _score"
        f" FROM `tabMarketplace Product` p{SEARCH_JOINS}"
        f" WHERE {hard} AND {gate}"
        f" ORDER BY {order}"
        f" LIMIT %(limit)s OFFSET %(start)s"
    )
    rows = frappe.db.sql(query, params, as_dict=True)
    for r in rows:
        r.pop("_score", None)
    return rows


@frappe.whitelist(allow_guest=True)
def list_products(
    category=None,
    vendor=None,
    search=None,
    brand=None,
    min_price=None,
    max_price=None,
    in_stock=None,
    sort=None,
    limit=24,
    start=0,
    min_rating=None,
):
    """Public, faceted catalog listing — approved, published products only.

    All filtering runs in ERPNext so it spans the whole catalog (not just the
    current page). `brand` may be a single value or a comma-separated list.

    A `search` term switches to a relevance-ranked query across title,
    descriptions, brand, category and vendor name; without one, the plain
    (indexed) listing path is used unchanged.
    """
    tokens = _search_tokens(search)
    if tokens:
        products = _search_products(
            (search or "").strip(), tokens, sort, limit, start,
            category, vendor, brand, min_price, max_price, in_stock,
        )
    else:
        filters = _catalog_filters(
            category, vendor, brand, min_price, max_price, in_stock, min_rating
        )
        products = frappe.get_all(
            "Marketplace Product",
            filters=filters,
            fields=PRODUCT_LIST_FIELDS,
            limit_page_length=cint(limit),
            limit_start=cint(start),
            order_by=SORT_MAP.get(sort, "creation desc"),
            ignore_permissions=True,
        )
    _attach_card_fields(products)
    return products


@frappe.whitelist(allow_guest=True)
def catalog_facets(category=None, search=None):
    """Available filter facets (brands + price range) for a category/search,
    so the storefront sidebar reflects the whole catalog, not one page. When a
    search term is present the facets span the same relevance-matched set the
    listing returns (not a title-only match)."""
    tokens = _search_tokens(search)
    if tokens:
        params: dict = {}
        hard = _hard_where_sql(params, category, None, None, None, None, None)
        gate = _gate_sql(params, tokens)
        base = f"FROM `tabMarketplace Product` p{SEARCH_JOINS} WHERE {hard} AND {gate}"
        brand_codes = [r[0] for r in frappe.db.sql(f"SELECT DISTINCT p.brand {base}", params)]
        prices = [r[0] for r in frappe.db.sql(f"SELECT p.price {base}", params)]
    else:
        filters = _catalog_filters(category)
        brand_codes = frappe.get_all(
            "Marketplace Product", filters=filters, pluck="brand", ignore_permissions=True
        )
        prices = frappe.get_all(
            "Marketplace Product", filters=filters, pluck="price", ignore_permissions=True
        )

    brands = sorted({b for b in brand_codes if b})
    prices = [flt(p) for p in prices if p is not None]

    return {
        "brands": brands,
        "price_min": int(min(prices)) if prices else 0,
        "price_max": int(round(max(prices))) if prices else 0,
    }


def _catalog_filters(
    category=None, vendor=None, brand=None, min_price=None, max_price=None, in_stock=None,
    min_rating=None,
):
    filters = [["approval_status", "=", "Approved"], ["published", "=", 1]]
    if min_rating not in (None, ""):
        filters.append(["rating", ">=", flt(min_rating)])
    if category:
        # Accept either a category slug (storefront URLs) or a docname.
        docname = frappe.db.get_value("Marketplace Category", {"slug": category}, "name")
        filters.append(["category", "=", docname or category])
    if vendor:
        filters.append(["vendor", "=", vendor])
    if brand:
        brands = [b.strip() for b in str(brand).split(",") if b.strip()]
        if brands:
            filters.append(["brand", "in", brands])
    if min_price not in (None, ""):
        filters.append(["price", ">=", flt(min_price)])
    if max_price not in (None, ""):
        filters.append(["price", "<=", flt(max_price)])
    if cint(in_stock):
        filters.append(["stock_qty", ">", 0])
    return filters


def _attach_card_fields(products):
    """Add a primary image + vendor display name to each listing row."""
    if not products:
        return
    names = [p.name for p in products]
    media = frappe.get_all(
        "Marketplace Product Media",
        filters={"parent": ["in", names]},
        fields=["parent", "image"],
        order_by="is_primary desc, idx asc",
        ignore_permissions=True,
    )
    image_by_product: dict[str, str] = {}
    for row in media:
        image_by_product.setdefault(row.parent, row.image)

    vendors = {p.vendor for p in products if p.vendor}
    vendor_meta = (
        {
            v.name: v
            for v in frappe.get_all(
                "Marketplace Vendor",
                filters={"name": ["in", list(vendors)]},
                fields=["name", "vendor_name", "slug", "trust_tier", "trust_score"],
                ignore_permissions=True,
            )
        }
        if vendors
        else {}
    )

    for p in products:
        p["image"] = image_by_product.get(p.name)
        v = vendor_meta.get(p.vendor)
        p["vendor_name"] = v.vendor_name if v else None
        p["vendor_slug"] = v.slug if v else None
        p["vendor_trust_tier"] = v.trust_tier if v else None
        p["vendor_trust_score"] = v.trust_score if v else None
        p["reviews"] = cint(p.get("review_count"))

    _attach_deals(products)


def _attach_deals(products):
    """Overlay a live flash-deal price on card rows: the deal price becomes the
    shown price, the normal price moves to `compare_at_price` (struck through),
    and `deal_ends_on`/`deal_remaining` drive the badge + countdown. Variant
    products are skipped — they price per variant, not per deal."""
    targets = [p for p in products if not cint(p.get("has_variants"))]
    if not targets:
        return
    from ovira_marketplace.api.deals import active_deal_map

    deals = active_deal_map([p.name for p in targets])
    if not deals:
        return
    for p in targets:
        deal = deals.get(p.name)
        if not deal or flt(deal["deal_price"]) >= flt(p.get("price")):
            continue
        p["compare_at_price"] = flt(p.get("price"))
        p["price"] = flt(deal["deal_price"])
        p["deal_ends_on"] = deal["ends_on"]
        p["deal_remaining"] = deal["remaining"]


@frappe.whitelist(allow_guest=True)
def get_product(slug):
    """Public product detail by slug, with media and specs."""
    name = frappe.db.get_value(
        "Marketplace Product", {"slug": slug, "approval_status": "Approved", "published": 1}, "name"
    )
    if not name:
        frappe.throw(_("Product not found."), frappe.DoesNotExistError)
    doc = frappe.get_doc("Marketplace Product", name).as_dict()
    v = frappe.db.get_value(
        "Marketplace Vendor",
        doc.get("vendor"),
        ["vendor_name", "slug", "trust_tier", "trust_score"],
        as_dict=True,
    )
    doc["vendor_name"] = v.vendor_name if v else None
    doc["vendor_slug"] = v.slug if v else None
    doc["vendor_trust_tier"] = v.trust_tier if v else None
    doc["vendor_trust_score"] = v.trust_score if v else None
    primary = next((m for m in doc.get("media", []) if m.get("is_primary")), None) or (
        doc.get("media")[0] if doc.get("media") else None
    )
    doc["image"] = primary.get("image") if primary else None
    doc["reviews"] = cint(doc.get("review_count"))

    # Expose a clean, public variant shape (or none) — never the internal item code.
    if doc.get("has_variants") and doc.get("variants"):
        doc["variants"] = [
            {
                "option_value": v.get("option_value"),
                "sku": v.get("sku") or v.get("name"),
                "price": flt(v.get("price")) or flt(doc.get("price")),
                "stock_qty": flt(v.get("stock_qty")),
                "image": v.get("image"),
            }
            for v in doc["variants"]
            if v.get("option_value")
        ]
    else:
        doc["has_variants"] = 0
        doc["variants"] = []

    # A live flash deal overlays the price (single-price products only) and
    # exposes a `deal` block so the detail page can show a countdown.
    if not doc["has_variants"]:
        from ovira_marketplace.api.deals import active_deal

        deal = active_deal(name)
        if deal and flt(deal["deal_price"]) < flt(doc.get("price")):
            doc["compare_at_price"] = flt(doc.get("price"))
            doc["price"] = flt(deal["deal_price"])
            doc["deal"] = {
                "deal_price": flt(deal["deal_price"]),
                "ends_on": deal["ends_on"],
                "remaining": deal["remaining"],
            }
    return doc


@frappe.whitelist(allow_guest=True)
def related_products(slug, limit=8):
    """Products related to one product: same category first, then same vendor,
    then newest — deduped, excluding the product itself."""
    base = frappe.db.get_value(
        "Marketplace Product",
        {"slug": slug, "approval_status": "Approved", "published": 1},
        ["name", "category", "vendor"],
        as_dict=True,
    )
    if not base:
        return []

    limit = cint(limit) or 8
    picked: list = []
    seen = {base.name}

    def _take(extra_filters):
        if len(picked) >= limit:
            return
        rows = frappe.get_all(
            "Marketplace Product",
            filters=[["approval_status", "=", "Approved"], ["published", "=", 1]] + extra_filters,
            fields=PRODUCT_LIST_FIELDS,
            order_by="creation desc",
            limit_page_length=limit * 2,
            ignore_permissions=True,
        )
        for r in rows:
            if r.name in seen:
                continue
            seen.add(r.name)
            picked.append(r)
            if len(picked) >= limit:
                break

    if base.category:
        _take([["category", "=", base.category]])
    if base.vendor:
        _take([["vendor", "=", base.vendor]])
    _take([])  # top up with newest across the catalog

    _attach_card_fields(picked)
    return picked


@frappe.whitelist(allow_guest=True)
def search_suggestions(q=None, limit=8):
    """Lightweight autocomplete for the header search box: the top relevance-ranked
    products (slim card fields) plus any categories whose name/slug matches."""
    tokens = _search_tokens(q)
    if not tokens:
        return {"products": [], "categories": []}

    limit = min(cint(limit) or 8, 12)
    products = _search_products((q or "").strip(), tokens, None, limit, 0)
    _attach_card_fields(products)
    slim = [
        {
            "title": p.title,
            "slug": p.slug,
            "price": p.price,
            "currency": p.currency,
            "image": p.get("image"),
        }
        for p in products
    ]

    like = _like_contains(tokens[0])
    cats = frappe.db.sql(
        "SELECT category_name, slug FROM `tabMarketplace Category`"
        " WHERE category_name LIKE %(like)s OR slug LIKE %(like)s"
        " ORDER BY display_order ASC, category_name ASC LIMIT 5",
        {"like": like},
        as_dict=True,
    )
    return {"products": slim, "categories": [dict(c) for c in cats]}


@frappe.whitelist(allow_guest=True)
def list_categories(parent=None):
    """Public category tree level — children of `parent` (or roots)."""
    filters = {"parent_marketplace_category": parent or ""}
    return frappe.get_all(
        "Marketplace Category",
        filters=filters,
        fields=["name", "category_name", "slug", "icon", "image", "is_group", "display_order"],
        order_by="display_order asc, category_name asc",
        ignore_permissions=True,
    )

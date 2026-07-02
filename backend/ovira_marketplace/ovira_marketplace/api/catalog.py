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
]

SORT_MAP = {
    "price_asc": "price asc",
    "price_desc": "price desc",
    "latest": "creation desc",
}


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
):
    """Public, faceted catalog listing — approved, published products only.

    All filtering runs in ERPNext so it spans the whole catalog (not just the
    current page). `brand` may be a single value or a comma-separated list.
    """
    filters = _catalog_filters(category, vendor, brand, min_price, max_price, in_stock)
    or_filters = {"title": ["like", f"%{search}%"]} if search else None

    products = frappe.get_all(
        "Marketplace Product",
        filters=filters,
        or_filters=or_filters,
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
    so the storefront sidebar reflects the whole catalog, not one page."""
    filters = _catalog_filters(category)
    or_filters = {"title": ["like", f"%{search}%"]} if search else None

    brand_codes = frappe.get_all(
        "Marketplace Product",
        filters=filters,
        or_filters=or_filters,
        pluck="brand",
        ignore_permissions=True,
    )
    brands = sorted({b for b in brand_codes if b})

    prices = frappe.get_all(
        "Marketplace Product",
        filters=filters,
        or_filters=or_filters,
        pluck="price",
        ignore_permissions=True,
    )
    prices = [flt(p) for p in prices if p is not None]

    return {
        "brands": brands,
        "price_min": int(min(prices)) if prices else 0,
        "price_max": int(round(max(prices))) if prices else 0,
    }


def _catalog_filters(
    category=None, vendor=None, brand=None, min_price=None, max_price=None, in_stock=None
):
    filters = [["approval_status", "=", "Approved"], ["published", "=", 1]]
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
    vendor_names = dict(
        frappe.get_all(
            "Marketplace Vendor",
            filters={"name": ["in", list(vendors)]},
            fields=["name", "vendor_name"],
            as_list=True,
            ignore_permissions=True,
        )
    ) if vendors else {}

    for p in products:
        p["image"] = image_by_product.get(p.name)
        p["vendor_name"] = vendor_names.get(p.vendor)
        p["reviews"] = cint(p.get("review_count"))


@frappe.whitelist(allow_guest=True)
def get_product(slug):
    """Public product detail by slug, with media and specs."""
    name = frappe.db.get_value(
        "Marketplace Product", {"slug": slug, "approval_status": "Approved", "published": 1}, "name"
    )
    if not name:
        frappe.throw(_("Product not found."), frappe.DoesNotExistError)
    doc = frappe.get_doc("Marketplace Product", name).as_dict()
    doc["vendor_name"] = frappe.db.get_value("Marketplace Vendor", doc.get("vendor"), "vendor_name")
    primary = next((m for m in doc.get("media", []) if m.get("is_primary")), None) or (
        doc.get("media")[0] if doc.get("media") else None
    )
    doc["image"] = primary.get("image") if primary else None
    doc["reviews"] = cint(doc.get("review_count"))
    return doc


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

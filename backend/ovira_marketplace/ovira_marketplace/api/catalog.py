import frappe
from frappe import _

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
]


@frappe.whitelist(allow_guest=True)
def list_products(category=None, vendor=None, search=None, limit=20, start=0):
    """Public catalog listing — approved, published products only."""
    filters = {"approval_status": "Approved", "published": 1}
    if category:
        # Accept either a category slug (storefront URLs) or a docname.
        docname = frappe.db.get_value("Marketplace Category", {"slug": category}, "name")
        filters["category"] = docname or category
    if vendor:
        filters["vendor"] = vendor

    or_filters = {"title": ["like", f"%{search}%"]} if search else None

    products = frappe.get_all(
        "Marketplace Product",
        filters=filters,
        or_filters=or_filters,
        fields=PRODUCT_LIST_FIELDS,
        limit_page_length=frappe.utils.cint(limit),
        limit_start=frappe.utils.cint(start),
        order_by="modified desc",
        ignore_permissions=True,
    )
    _attach_card_fields(products)
    return products


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

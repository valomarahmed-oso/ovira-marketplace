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

    return frappe.get_all(
        "Marketplace Product",
        filters=filters,
        or_filters=or_filters,
        fields=PRODUCT_LIST_FIELDS,
        limit_page_length=frappe.utils.cint(limit),
        limit_start=frappe.utils.cint(start),
        order_by="modified desc",
        ignore_permissions=True,
    )


@frappe.whitelist(allow_guest=True)
def get_product(slug):
    """Public product detail by slug, with media and specs."""
    name = frappe.db.get_value(
        "Marketplace Product", {"slug": slug, "approval_status": "Approved", "published": 1}, "name"
    )
    if not name:
        frappe.throw(_("Product not found."), frappe.DoesNotExistError)
    return frappe.get_doc("Marketplace Product", name).as_dict()


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

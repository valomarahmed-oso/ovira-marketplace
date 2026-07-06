import frappe
from frappe import _
from frappe.utils import flt

from ovira_marketplace.permissions import vendor_for_user

VENDOR_PRODUCT_FIELDS = [
    "name",
    "title",
    "slug",
    "price",
    "compare_at_price",
    "currency",
    "stock_qty",
    "approval_status",
    "published",
    "category",
    "condition",
]


@frappe.whitelist()
def my_products():
    """Products owned by the current vendor, enriched for the dashboard list."""
    vendor = vendor_for_user()
    if not vendor:
        return []
    rows = frappe.get_all(
        "Marketplace Product",
        filters={"vendor": vendor},
        fields=VENDOR_PRODUCT_FIELDS,
        order_by="modified desc",
    )
    _attach_primary_image(rows)
    _attach_category_name(rows)
    return rows


@frappe.whitelist()
def upsert_product(
    title,
    price,
    name=None,
    category=None,
    compare_at_price=None,
    condition=None,
    stock_qty=None,
    image=None,
    brand=None,
    currency=None,
    short_description=None,
    description=None,
):
    """Create or update one of the vendor's own products.

    The controller (``MarketplaceProduct.validate``) forces the product back to
    Pending for vendors and binds it to the vendor's store, so a vendor can never
    publish or hijack another's product.
    """
    vendor = vendor_for_user()
    if not vendor:
        frappe.throw(_("Only registered vendors can manage products."), frappe.PermissionError)

    if name:
        doc = frappe.get_doc("Marketplace Product", name)
        if doc.vendor != vendor:
            frappe.throw(_("This product belongs to another vendor."), frappe.PermissionError)
    else:
        doc = frappe.new_doc("Marketplace Product")

    doc.vendor = vendor
    doc.title = title
    doc.price = flt(price)
    if category:
        doc.category = category
    if compare_at_price not in (None, ""):
        doc.compare_at_price = flt(compare_at_price)
    if condition:
        doc.condition = condition
    if brand:
        doc.brand = brand
    if currency:
        doc.currency = currency
    if short_description is not None:
        doc.short_description = short_description
    if description is not None:
        doc.description = description

    # A single image from the vendor form becomes the primary media row.
    if image:
        _set_primary_image(doc, image)

    old_stock = flt(doc.get("stock_qty")) if name else 0.0
    doc.save(ignore_permissions=True)

    # ``stock_qty`` is a read-only field (ERPNext-synced only once the Item
    # carries real inventory — see MarketplaceProduct.refresh_stock). Until then
    # the vendor manages it directly here: this is how stock is set, edited and
    # restocked, and it survives approval.
    if stock_qty not in (None, ""):
        new_stock = flt(stock_qty)
        doc.db_set("stock_qty", new_stock)
        # Restocked from empty → alert anyone waiting (best-effort).
        if old_stock <= 0 < new_stock:
            try:
                from ovira_marketplace.api.stock_alerts import notify_back_in_stock

                notify_back_in_stock(doc.name)
            except Exception:
                frappe.log_error("back-in-stock notify failed")

    frappe.db.commit()
    return {"name": doc.name, "approval_status": doc.approval_status}


@frappe.whitelist()
def get_my_product(name):
    """One of the vendor's own products with its editable fields (any status),
    for the edit form."""
    vendor = vendor_for_user()
    if not vendor:
        frappe.throw(_("Only registered vendors can manage products."), frappe.PermissionError)
    doc = frappe.get_doc("Marketplace Product", name)
    if doc.vendor != vendor:
        frappe.throw(_("This product belongs to another vendor."), frappe.PermissionError)

    image = None
    for m in doc.get("media") or []:
        if m.is_primary:
            image = m.image
            break
    if not image and doc.get("media"):
        image = doc.media[0].image

    return {
        "name": doc.name,
        "title": doc.title,
        "price": doc.price,
        "compare_at_price": doc.compare_at_price,
        "category": doc.category,
        "condition": doc.condition,
        "currency": doc.currency,
        "stock_qty": doc.stock_qty,
        "short_description": doc.short_description,
        "description": doc.description,
        "image": image,
        "approval_status": doc.approval_status,
        "published": doc.published,
    }


@frappe.whitelist()
def delete_product(name):
    """Delete one of the vendor's own products."""
    vendor = vendor_for_user()
    if not vendor:
        frappe.throw(_("Only registered vendors can manage products."), frappe.PermissionError)
    owner = frappe.db.get_value("Marketplace Product", name, "vendor")
    if owner is None:
        return {"deleted": name}
    if owner != vendor:
        frappe.throw(_("This product belongs to another vendor."), frappe.PermissionError)
    frappe.delete_doc("Marketplace Product", name, ignore_permissions=True)
    frappe.db.commit()
    return {"deleted": name}


# -- helpers ----------------------------------------------------------------


def _set_primary_image(doc, image):
    """Point the primary media row at ``image`` (or add one if none exists)."""
    for row in doc.get("media", []):
        if row.is_primary:
            row.image = image
            return
    doc.append("media", {"image": image, "is_primary": 1})


def _attach_primary_image(rows):
    if not rows:
        return
    ids = [r["name"] for r in rows]
    images = {}
    for m in frappe.get_all(
        "Marketplace Product Media",
        filters={"parenttype": "Marketplace Product", "parent": ["in", ids]},
        fields=["parent", "image"],
        order_by="is_primary desc, idx asc",
        ignore_permissions=True,
    ):
        images.setdefault(m["parent"], m["image"])
    for r in rows:
        r["image"] = images.get(r["name"])


def _attach_category_name(rows):
    cat_ids = list({r["category"] for r in rows if r.get("category")})
    names = {}
    if cat_ids:
        for c in frappe.get_all(
            "Marketplace Category",
            filters={"name": ["in", cat_ids]},
            fields=["name", "category_name"],
            ignore_permissions=True,
        ):
            names[c["name"]] = c["category_name"]
    for r in rows:
        r["category_name"] = names.get(r.get("category"))

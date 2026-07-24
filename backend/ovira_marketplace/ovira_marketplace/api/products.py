import json

import frappe
from frappe import _
from frappe.utils import cint, flt

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
    images=None,
    brand=None,
    currency=None,
    short_description=None,
    description=None,
    has_variants=None,
    variant_option_name=None,
    variants=None,
    track_inventory=None,
    video_url=None,
    price_tiers=None,
    stock_locations=None,
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
    if track_inventory is not None:
        # On → ERPNext holds real stock for this item (opening stock is received,
        # deliveries draw it down). Off → the lightweight manual stock model.
        doc.track_inventory = cint(track_inventory)
    if short_description is not None:
        doc.short_description = short_description
    if description is not None:
        doc.description = description
    if video_url is not None:
        doc.video_url = (video_url or "").strip() or None
    if price_tiers is not None:
        _apply_price_tiers(doc, price_tiers)
    if stock_locations is not None:
        _apply_stock_locations(doc, stock_locations)

    # Gallery: an ordered list of image URLs (first = primary) rebuilds the media
    # rows; a single `image` stays supported for the older one-image form.
    if images is not None:
        _apply_gallery(doc, images)
    elif image:
        _set_primary_image(doc, image)

    # Variants (e.g. sizes/colours): rebuild the child table when supplied.
    if has_variants is not None:
        _apply_variants(doc, has_variants, variant_option_name, variants)

    old_stock = flt(doc.get("stock_qty")) if name else 0.0
    doc.save(ignore_permissions=True)

    # ``stock_qty`` is a read-only field (ERPNext-synced only once the Item
    # carries real inventory — see MarketplaceProduct.refresh_stock). Until then
    # the vendor manages it directly here: this is how stock is set, edited and
    # restocked, and it survives approval. For variant products the base stock
    # mirrors the sum of the variants so cards/listings show availability.
    if doc.has_variants and doc.get("variants"):
        total = sum(flt(v.stock_qty) for v in doc.variants)
        doc.db_set("stock_qty", total)
    elif doc.get("stock_locations"):
        # Multi-warehouse: headline stock is the sum across branches.
        total = sum(flt(r.stock_qty) for r in doc.stock_locations)
        doc.db_set("stock_qty", total)
        if old_stock <= 0 < total:
            try:
                from ovira_marketplace.api.stock_alerts import notify_back_in_stock

                notify_back_in_stock(doc.name)
            except Exception:
                frappe.log_error("back-in-stock notify failed")
    elif stock_qty not in (None, ""):
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

    media = doc.get("media") or []
    images = [m.image for m in media if m.image]
    primary = next((m.image for m in media if m.is_primary and m.image), None)
    if primary and images and images[0] != primary:
        images = [primary] + [u for u in images if u != primary]
    image = primary or (images[0] if images else None)

    return {
        "name": doc.name,
        "title": doc.title,
        "price": doc.price,
        "compare_at_price": doc.compare_at_price,
        "category": doc.category,
        "condition": doc.condition,
        "currency": doc.currency,
        "brand": doc.brand,
        "stock_qty": doc.stock_qty,
        "track_inventory": cint(doc.track_inventory),
        "short_description": doc.short_description,
        "description": doc.description,
        "image": image,
        "images": images,
        "video_url": doc.get("video_url"),
        "price_tiers": [
            {"min_qty": cint(tr.min_qty), "price": flt(tr.price)}
            for tr in (doc.get("price_tiers") or [])
        ],
        "stock_locations": [
            {
                "company": r.company,
                "warehouse": r.warehouse,
                "governorate": r.governorate,
                "stock_qty": flt(r.stock_qty),
                "priority": cint(r.priority),
            }
            for r in (doc.get("stock_locations") or [])
        ],
        "has_variants": cint(doc.has_variants),
        "variant_option_name": doc.variant_option_name,
        "variants": [
            {
                "option_value": v.option_value,
                "price": flt(v.price),
                "stock_qty": flt(v.stock_qty),
                "image": v.image,
            }
            for v in (doc.get("variants") or [])
        ],
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


def _apply_gallery(doc, images):
    """Rebuild the product's media rows from an ordered list of image URLs; the
    first becomes the primary."""
    try:
        urls = json.loads(images) if isinstance(images, str) else images
    except (ValueError, TypeError):
        urls = []
    urls = [u for u in (urls or []) if u]
    doc.set("media", [])
    for i, url in enumerate(urls):
        doc.append("media", {"image": url, "is_primary": 1 if i == 0 else 0})


def _apply_price_tiers(doc, tiers):
    """Rebuild the bulk price-tier rows from [{min_qty, price}, ...]. Ignores
    blank/invalid rows and anything at qty < 2."""
    try:
        rows = json.loads(tiers) if isinstance(tiers, str) else tiers
    except (ValueError, TypeError):
        rows = []
    doc.set("price_tiers", [])
    for r in rows or []:
        min_qty = cint(r.get("min_qty"))
        price = flt(r.get("price"))
        if min_qty >= 2 and price > 0:
            doc.append("price_tiers", {"min_qty": min_qty, "price": price})


def _apply_stock_locations(doc, locations):
    """Rebuild the multi-warehouse branch-stock rows from
    [{company, warehouse, governorate, stock_qty, priority}, ...]. Rows missing a
    company or warehouse are dropped."""
    try:
        rows = json.loads(locations) if isinstance(locations, str) else locations
    except (ValueError, TypeError):
        rows = []
    doc.set("stock_locations", [])
    for r in rows or []:
        company = (r.get("company") or "").strip()
        warehouse = (r.get("warehouse") or "").strip()
        if not company or not warehouse:
            continue
        doc.append(
            "stock_locations",
            {
                "company": company,
                "warehouse": warehouse,
                "governorate": (r.get("governorate") or "").strip() or None,
                "stock_qty": flt(r.get("stock_qty")),
                "priority": cint(r.get("priority")),
            },
        )


@frappe.whitelist()
def list_companies():
    """ERPNext companies for the branch-stock picker (vendor/operator)."""
    if not vendor_for_user():
        frappe.throw(_("Only registered vendors can manage products."), frappe.PermissionError)
    return frappe.get_all("Company", fields=["name"], order_by="name asc", ignore_permissions=True)


@frappe.whitelist()
def list_warehouses(company=None):
    """Non-group warehouses (optionally for one company) for the branch picker."""
    if not vendor_for_user():
        frappe.throw(_("Only registered vendors can manage products."), frappe.PermissionError)
    filters = {"is_group": 0}
    if company:
        filters["company"] = company
    return frappe.get_all(
        "Warehouse", filters=filters, fields=["name", "company"], order_by="name asc", ignore_permissions=True
    )


def _apply_variants(doc, has_variants, option_name, variants):
    """Turn variant selling on/off and rebuild the variant rows. Each row is
    {option_value, price, stock_qty}; a stable SKU is generated when missing.
    The base price becomes the cheapest variant so cards show a real 'from'."""
    if not cint(has_variants):
        doc.has_variants = 0
        doc.set("variants", [])
        return
    try:
        rows = json.loads(variants) if isinstance(variants, str) else variants
    except (ValueError, TypeError):
        rows = []

    base = doc.slug or frappe.scrub(doc.title or "variant")
    doc.has_variants = 1
    doc.variant_option_name = (option_name or "").strip() or "الخيار"
    doc.set("variants", [])
    prices = []
    for r in rows or []:
        value = (str(r.get("option_value") or "")).strip()
        if not value:
            continue
        price = flt(r.get("price")) or flt(doc.price)
        prices.append(price)
        doc.append(
            "variants",
            {
                "option_value": value,
                "sku": (r.get("sku") or f"{base}-{frappe.scrub(value)}")[:140],
                "price": price,
                "stock_qty": flt(r.get("stock_qty")),
                "image": (str(r.get("image") or "")).strip() or None,
            },
        )
    if prices:
        doc.price = min(prices)


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

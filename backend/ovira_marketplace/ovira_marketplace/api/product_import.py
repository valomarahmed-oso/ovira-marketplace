"""Vendor bulk product import from a CSV.

Create-only: a seller onboarding a catalogue can add many products at once
instead of one-by-one. A dry run validates every row and reports problems so
nothing is written until the vendor has seen (and fixed) the errors. Imported
products go through the same controller as the single-product form, so they are
bound to the vendor's store and forced to Pending for operator approval.
"""

import csv
import io

import frappe
from frappe import _
from frappe.utils import cint, flt

from ovira_marketplace.api.products import upsert_product
from ovira_marketplace.permissions import vendor_for_user

# The columns a vendor fills in. Only `title` is required; the rest are optional.
IMPORT_COLUMNS = [
    "title",
    "price",
    "stock_qty",
    "category",
    "brand",
    "condition",
    "short_description",
    "description",
    "image",
]
CONDITIONS = {"new": "New", "used": "Used", "refurbished": "Refurbished"}
MAX_IMPORT_ROWS = 500


def _require_vendor():
    vendor = vendor_for_user()
    if not vendor:
        frappe.throw(_("Only registered vendors can import products."), frappe.PermissionError)
    return vendor


@frappe.whitelist()
def import_template():
    """The header row vendors fill in. Vendor-gated so it stays a vendor tool."""
    _require_vendor()
    return {"columns": IMPORT_COLUMNS}


def _category_index():
    """Map lower(category id) and lower(display name) → category id, so the CSV
    can reference a category by either its name or its human label."""
    idx = {}
    for c in frappe.get_all("Marketplace Category", fields=["name", "category_name"]):
        if c.name:
            idx[c.name.strip().lower()] = c.name
        if c.category_name:
            idx[c.category_name.strip().lower()] = c.name
    return idx


@frappe.whitelist()
def import_products_csv(csv_text, dry_run=1):
    """Parse a CSV of products and (unless ``dry_run``) create them for the
    current vendor. Returns a per-row report so the UI can preview first.

    Rows are independent: a bad row is reported and skipped, valid rows still
    import. ``dry_run`` (default) writes nothing.
    """
    _require_vendor()

    dry = cint(dry_run)
    text = (csv_text or "").strip()
    if not text:
        frappe.throw(_("The file is empty."))

    reader = csv.DictReader(io.StringIO(text))
    headers = [(h or "").strip().lower() for h in (reader.fieldnames or [])]
    if "title" not in headers:
        frappe.throw(_("The file must have a 'title' column — download the template."))

    categories = _category_index()
    results = []
    created = 0
    errors = 0

    def fail(row_no, title, message):
        nonlocal errors
        errors += 1
        results.append({"row": row_no, "title": title, "status": "error", "message": message})

    for i, raw in enumerate(reader, start=1):
        if i > MAX_IMPORT_ROWS:
            fail(i, "", _("Row limit of {0} reached.").format(MAX_IMPORT_ROWS))
            break

        row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
        title = row.get("title", "")
        if not title:
            fail(i, "", "العنوان مطلوب")
            continue

        price_raw = row.get("price", "")
        try:
            price = flt(price_raw) if price_raw else 0.0
        except (ValueError, TypeError):
            fail(i, title, "السعر غير صالح")
            continue

        category = None
        cat_raw = row.get("category", "")
        if cat_raw:
            category = categories.get(cat_raw.lower())
            if not category:
                fail(i, title, f"القسم غير موجود: {cat_raw}")
                continue

        cond_raw = row.get("condition", "")
        condition = CONDITIONS.get(cond_raw.lower()) if cond_raw else "New"
        if cond_raw and not condition:
            fail(i, title, "الحالة يجب أن تكون New أو Used أو Refurbished")
            continue

        if dry:
            results.append({"row": i, "title": title, "status": "ok", "message": "جاهز للإضافة"})
            continue

        try:
            upsert_product(
                title=title,
                price=price,
                category=category,
                brand=row.get("brand") or None,
                condition=condition,
                stock_qty=row.get("stock_qty") or None,
                short_description=row.get("short_description") or None,
                description=row.get("description") or None,
                image=row.get("image") or None,
            )
            created += 1
            results.append({"row": i, "title": title, "status": "created", "message": ""})
        except Exception:
            frappe.log_error(title="Ovira bulk import row failed")
            fail(i, title, "تعذّر إنشاء المنتج")

    return {"dry_run": bool(dry), "created": created, "errors": errors, "results": results}

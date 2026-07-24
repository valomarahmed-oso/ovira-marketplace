"""Operator category management — define the marketplace's taxonomy from the
storefront admin instead of the ERPNext Desk.

Marketplace Category is a nested set; assigning a parent promotes that parent to
a group node. Everything here is operator-gated.
"""

import re

import frappe
from frappe import _
from frappe.utils import cint

from ovira_marketplace.api.admin import _require_operator


def _slugify(name):
    """A clean ASCII slug for a category. Arabic-only names (no derivable ASCII)
    fall back to a short stable id so the URL stays tidy instead of a percent-
    encoded Arabic string."""
    s = frappe.scrub(name or "").replace("_", "-")
    s = re.sub(r"[^a-z0-9-]", "", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or ("cat-" + frappe.generate_hash(length=6))

CATEGORY_FIELDS = [
    "name",
    "category_name",
    "slug",
    "parent_marketplace_category",
    "is_group",
    "icon",
    "image",
    "display_order",
    "description",
]


@frappe.whitelist()
def list_all_categories():
    """Every category with a live count of its approved, published products."""
    _require_operator()
    cats = frappe.get_all(
        "Marketplace Category",
        fields=CATEGORY_FIELDS,
        order_by="display_order asc, category_name asc",
        ignore_permissions=True,
        limit_page_length=0,
    )
    counts = {}
    for r in frappe.get_all(
        "Marketplace Product",
        filters={"approval_status": "Approved", "published": 1},
        fields=["category"],
        ignore_permissions=True,
        limit_page_length=0,
    ):
        if r.category:
            counts[r.category] = counts.get(r.category, 0) + 1
    for c in cats:
        c["product_count"] = counts.get(c["name"], 0)
    return cats


@frappe.whitelist()
def upsert_category(
    category_name,
    name=None,
    parent=None,
    icon=None,
    image=None,
    display_order=None,
    description=None,
):
    """Create a category or rename/update an existing one. Operator only."""
    _require_operator()
    category_name = (category_name or "").strip()
    if not category_name:
        frappe.throw(_("اكتب اسم القسم."))

    doc = (
        frappe.get_doc("Marketplace Category", name)
        if name
        else frappe.new_doc("Marketplace Category")
    )
    doc.category_name = category_name
    if not doc.slug:
        doc.slug = _slugify(category_name)
    doc.parent_marketplace_category = parent or None
    if icon is not None:
        doc.icon = icon
    if image is not None:
        doc.image = image
    if display_order is not None:
        doc.display_order = cint(display_order)
    if description is not None:
        doc.description = description
    doc.save(ignore_permissions=True)

    # A category used as a parent must be a group node in the nested set.
    if parent:
        frappe.db.set_value("Marketplace Category", parent, "is_group", 1)

    frappe.db.commit()
    return {"name": doc.name, "slug": doc.slug}


@frappe.whitelist()
def delete_category(name):
    """Delete a category — blocked when products or subcategories still use it."""
    _require_operator()
    if frappe.db.count("Marketplace Product", {"category": name}):
        frappe.throw(_("لا يمكن حذف قسم مستخدم في منتجات."))
    if frappe.db.count("Marketplace Category", {"parent_marketplace_category": name}):
        frappe.throw(_("احذف الأقسام الفرعية أولًا."))
    frappe.delete_doc("Marketplace Category", name, ignore_permissions=True)
    frappe.db.commit()
    return {"deleted": name}

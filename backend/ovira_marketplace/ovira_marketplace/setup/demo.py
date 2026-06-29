"""Idempotent demo catalog for Ovira Marketplace.

Run on the bench with:
    bench --site <site> execute ovira_marketplace.setup.demo.seed_demo

Creates one category, one *active* vendor (which provisions a Supplier +
Customer), and a few *approved* products (which provision ERPNext Items) — just
enough to light up the storefront and smoke-test the ERPNext integration.
Safe to run repeatedly: existing records are reused, never duplicated.
"""

import frappe

VENDOR_SLUG = "ovira-demo-store"

CATEGORY = {"name": "إلكترونيات", "slug": "electronics", "icon": "smartphone"}

PRODUCTS = [
    {
        "title": "سماعة بلوتوث لاسلكية بخاصية عزل الضوضاء",
        "slug": "wireless-anc-headphones",
        "price": 1899,
        "compare_at_price": 2499,
        "short_description": "سماعة رأس لاسلكية ببطارية تدوم ٤٠ ساعة وعزل ضوضاء نشط.",
    },
    {
        "title": "ساعة ذكية بشاشة AMOLED",
        "slug": "amoled-smartwatch",
        "price": 2450,
        "compare_at_price": 2999,
        "short_description": "ساعة ذكية بشاشة AMOLED ومتابعة صحية ومقاومة للماء.",
    },
    {
        "title": "شاحن سريع 65 واط بتقنية GaN",
        "slug": "gan-charger-65w",
        "price": 690,
        "compare_at_price": 950,
        "short_description": "شاحن مدمج 65 واط بثلاثة منافذ يشحن اللابتوب والموبايل.",
    },
]


def seed_demo():
    """Create the demo catalog and return a summary of what exists now."""
    category = _ensure_category()
    vendor = _ensure_vendor()
    product_names = [_ensure_product(vendor, category, p) for p in PRODUCTS]
    frappe.db.commit()

    v = frappe.get_doc("Marketplace Vendor", vendor)
    summary = {
        "category": category,
        "item_group": frappe.db.get_value("Marketplace Category", category, "item_group"),
        "vendor": vendor,
        "vendor_status": v.status,
        "supplier": v.supplier,
        "customer": v.customer,
        "products": [
            {
                "name": name,
                "slug": frappe.db.get_value("Marketplace Product", name, "slug"),
                "item": frappe.db.get_value("Marketplace Product", name, "item"),
                "approval": frappe.db.get_value("Marketplace Product", name, "approval_status"),
            }
            for name in product_names
        ],
    }
    print("SEED_SUMMARY:", frappe.as_json(summary))
    return summary


def _ensure_category():
    existing = frappe.db.get_value("Marketplace Category", {"slug": CATEGORY["slug"]}, "name")
    if existing:
        return existing
    doc = frappe.new_doc("Marketplace Category")
    doc.category_name = CATEGORY["name"]
    doc.slug = CATEGORY["slug"]
    doc.icon = CATEGORY["icon"]
    doc.is_group = 0
    doc.insert(ignore_permissions=True)
    return doc.name


def _ensure_vendor():
    existing = frappe.db.get_value("Marketplace Vendor", {"slug": VENDOR_SLUG}, "name")
    if existing:
        doc = frappe.get_doc("Marketplace Vendor", existing)
        if doc.status != "Active":
            doc.status = "Active"  # on_update provisions Supplier + Customer
            doc.save(ignore_permissions=True)
        return existing
    doc = frappe.new_doc("Marketplace Vendor")
    doc.vendor_name = "متجر أوفيرا التجريبي"
    doc.slug = VENDOR_SLUG
    doc.email = "store@demo.ovira.cloud"
    doc.phone = "01000000000"
    doc.description = "متجر تجريبي لاختبار تكامل أوفيرا ماركت مع ERPNext."
    doc.status = "Active"  # triggers ERPNext provisioning on insert/on_update
    doc.insert(ignore_permissions=True)
    return doc.name


def _ensure_product(vendor, category, spec):
    existing = frappe.db.get_value("Marketplace Product", {"slug": spec["slug"]}, "name")
    if existing:
        return existing
    doc = frappe.new_doc("Marketplace Product")
    doc.title = spec["title"]
    doc.slug = spec["slug"]
    doc.vendor = vendor
    doc.category = category
    doc.price = spec["price"]
    doc.compare_at_price = spec["compare_at_price"]
    doc.currency = "EGP"
    doc.short_description = spec["short_description"]
    doc.published = 1
    doc.approval_status = "Approved"  # on_update syncs the ERPNext Item
    doc.insert(ignore_permissions=True)
    return doc.name

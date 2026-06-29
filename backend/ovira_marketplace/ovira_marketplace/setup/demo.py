"""Idempotent demo catalog for Ovira Marketplace.

Run on the bench with:
    bench --site <site> execute ovira_marketplace.setup.demo.seed_demo

Creates a few categories, two *active* vendors (each provisions a Supplier +
Customer) and a spread of *approved* products with images (each provisions an
ERPNext Item). Enough to make the storefront look like a real marketplace and
to exercise the ERPNext integration. Safe to run repeatedly.
"""

import frappe

CATEGORIES = [
    {"name": "إلكترونيات", "slug": "electronics", "icon": "smartphone"},
    {"name": "موضة", "slug": "fashion", "icon": "shirt"},
    {"name": "المنزل والمطبخ", "slug": "home", "icon": "lamp"},
    {"name": "الجمال والعناية", "slug": "beauty", "icon": "sparkles"},
    {"name": "رياضة ولياقة", "slug": "sports", "icon": "dumbbell"},
    {"name": "ألعاب", "slug": "toys", "icon": "gamepad-2"},
]

VENDORS = [
    {"name": "متجر أوفيرا للإلكترونيات", "slug": "ovira-demo-store", "email": "store@demo.ovira.cloud"},
    {"name": "بيت الموضة والمنزل", "slug": "fashion-home-house", "email": "house@demo.ovira.cloud"},
]


def _img(seed):
    return f"https://picsum.photos/seed/ovira-{seed}/800/800"


# product slug -> brand, so the storefront brand facet has something to show.
BRANDS = {
    "wireless-anc-headphones": "Aurex",
    "amoled-smartwatch": "Pulse",
    "gan-charger-65w": "Voltix",
    "rgb-mechanical-keyboard": "Keyon",
    "anti-theft-backpack": "Nomad",
    "polarized-sunglasses": "Solaris",
    "leather-classic-watch": "Tempo",
    "home-espresso-machine": "Brewly",
    "dimmable-led-desk-lamp": "Lumio",
    "cordless-vacuum": "Vacmax",
    "vitamin-c-skincare-set": "Lumea",
    "ionic-hair-dryer": "Aurex",
    "mens-running-shoes": "Strade",
    "adjustable-dumbbell": "IronFit",
    "speed-rubik-cube": "Cubex",
    "rc-offroad-car": "RoadX",
}


# (category slug, vendor index, title, slug, price, compare_at, image seed)
PRODUCTS = [
    ("electronics", 0, "سماعة بلوتوث لاسلكية بعزل الضوضاء", "wireless-anc-headphones", 1899, 2499, "headphones"),
    ("electronics", 0, "ساعة ذكية بشاشة AMOLED", "amoled-smartwatch", 2450, 2999, "smartwatch"),
    ("electronics", 0, "شاحن سريع 65 واط بتقنية GaN", "gan-charger-65w", 690, 950, "charger"),
    ("electronics", 0, "لوحة مفاتيح ميكانيكية RGB", "rgb-mechanical-keyboard", 1650, 2100, "keyboard"),
    ("fashion", 1, "حقيبة ظهر مقاومة للماء بمنفذ USB", "anti-theft-backpack", 690, 950, "backpack"),
    ("fashion", 1, "نظارة شمسية بولارايزد", "polarized-sunglasses", 540, 720, "sunglasses"),
    ("fashion", 1, "ساعة يد كلاسيكية جلد", "leather-classic-watch", 1290, 1700, "leatherwatch"),
    ("home", 1, "ماكينة قهوة إسبريسو منزلية", "home-espresso-machine", 4750, 5600, "espresso"),
    ("home", 1, "مصباح مكتب LED قابل للتعتيم", "dimmable-led-desk-lamp", 540, 720, "desklamp"),
    ("home", 1, "مكنسة لاسلكية شفط قوي", "cordless-vacuum", 3200, 3990, "vacuum"),
    ("beauty", 1, "مجموعة العناية بالبشرة فيتامين سي", "vitamin-c-skincare-set", 845, 1100, "skincare"),
    ("beauty", 1, "مجفف شعر أيوني احترافي", "ionic-hair-dryer", 990, 1350, "hairdryer"),
    ("sports", 0, "حذاء جري خفيف للرجال", "mens-running-shoes", 1290, 1650, "shoes"),
    ("sports", 0, "دمبل قابل للتعديل 24 كجم", "adjustable-dumbbell", 2100, 2600, "dumbbell"),
    ("toys", 1, "مكعّب روبيك احترافي سريع", "speed-rubik-cube", 240, 320, "cube"),
    ("toys", 1, "سيارة تحكم عن بعد 4x4", "rc-offroad-car", 1150, 1500, "rccar"),
]


def seed_demo():
    categories = {c["slug"]: _ensure_category(c) for c in CATEGORIES}
    vendors = [_ensure_vendor(v) for v in VENDORS]

    created = []
    for cat_slug, vendor_idx, title, slug, price, compare_at, seed in PRODUCTS:
        name = _ensure_product(
            vendor=vendors[vendor_idx],
            category=categories[cat_slug],
            title=title,
            slug=slug,
            price=price,
            compare_at=compare_at,
            image=_img(seed),
        )
        created.append(name)
    frappe.db.commit()

    summary = {
        "categories": len(categories),
        "vendors": vendors,
        "products": len(created),
    }
    print("SEED_SUMMARY:", frappe.as_json(summary))
    return summary


def _ensure_category(spec):
    existing = frappe.db.get_value("Marketplace Category", {"slug": spec["slug"]}, "name")
    if existing:
        return existing
    doc = frappe.new_doc("Marketplace Category")
    doc.category_name = spec["name"]
    doc.slug = spec["slug"]
    doc.icon = spec["icon"]
    doc.is_group = 0
    doc.insert(ignore_permissions=True)
    return doc.name


def _ensure_vendor(spec):
    existing = frappe.db.get_value("Marketplace Vendor", {"slug": spec["slug"]}, "name")
    if existing:
        doc = frappe.get_doc("Marketplace Vendor", existing)
        if doc.status != "Active":
            doc.status = "Active"
            doc.save(ignore_permissions=True)
        return existing
    doc = frappe.new_doc("Marketplace Vendor")
    doc.vendor_name = spec["name"]
    doc.slug = spec["slug"]
    doc.email = spec["email"]
    doc.status = "Active"  # provisions Supplier + Customer on insert
    doc.insert(ignore_permissions=True)
    return doc.name


def _ensure_brand(name):
    if not name:
        return None
    if not frappe.db.exists("Brand", name):
        doc = frappe.new_doc("Brand")
        doc.brand = name
        doc.insert(ignore_permissions=True)
    return name


def _ensure_product(vendor, category, title, slug, price, compare_at, image):
    brand = _ensure_brand(BRANDS.get(slug))
    existing = frappe.db.get_value("Marketplace Product", {"slug": slug}, "name")
    if existing:
        _ensure_media(existing, image, title)
        if brand and not frappe.db.get_value("Marketplace Product", existing, "brand"):
            frappe.db.set_value("Marketplace Product", existing, "brand", brand)
        return existing
    doc = frappe.new_doc("Marketplace Product")
    doc.title = title
    doc.slug = slug
    doc.vendor = vendor
    doc.category = category
    doc.brand = brand
    doc.price = price
    doc.compare_at_price = compare_at
    doc.currency = "EGP"
    doc.short_description = title
    doc.published = 1
    doc.append("media", {"image": image, "is_primary": 1, "alt_text": title})
    doc.approval_status = "Approved"  # syncs the ERPNext Item on_update
    doc.insert(ignore_permissions=True)
    return doc.name


def _ensure_media(product_name, image, title):
    """Backfill a primary image for a product that has none."""
    if frappe.db.exists("Marketplace Product Media", {"parent": product_name}):
        return
    doc = frappe.get_doc("Marketplace Product", product_name)
    doc.append("media", {"image": image, "is_primary": 1, "alt_text": title})
    doc.save(ignore_permissions=True)

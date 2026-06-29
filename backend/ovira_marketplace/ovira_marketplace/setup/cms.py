"""Default homepage content for Ovira Marketplace.

Seeds a hero banner, a few promo cards and two product rails so the storefront
homepage is populated *and* fully editable from the Desk out of the box. Safe to
run repeatedly — it only seeds when the respective doctype is empty, so it never
clobbers an operator's own content.

    bench --site <site> execute ovira_marketplace.setup.cms.seed_cms
"""

import frappe

HERO = {
    "title": "تسوّق أذكى، من بائعين تثق فيهم.",
    "subtitle": "آلاف المنتجات، أسعار تنافسية، وشحن سريع لكل مصر — كل ده في مكان واحد.",
    "placement": "Hero",
    "link": "/products",
    "cta_label": "تسوّق دلوقتي",
    "tone": "Blue",
    "display_order": 0,
}

PROMOS = [
    {"title": "إلكترونيات بأسعار لا تُقاوم", "subtitle": "خصومات تصل إلى ٤٠٪", "link": "/category/electronics", "tone": "Blue", "display_order": 0},
    {"title": "تجهيزات المنزل والمطبخ", "subtitle": "كل اللي بيتك محتاجه", "link": "/category/home", "tone": "Coral", "display_order": 1},
    {"title": "أزياء الموسم الجديد", "subtitle": "وصل حديثًا", "link": "/category/fashion", "tone": "Light Blue", "display_order": 2},
]

SECTIONS = [
    {"heading": "وصل حديثًا", "source": "Latest", "item_limit": 8, "display_order": 0},
    {"heading": "الأكثر مبيعًا", "source": "Best Selling", "item_limit": 8, "display_order": 1},
    {"heading": "أقوى العروض", "source": "Discounted", "item_limit": 8, "display_order": 2},
]


def seed_cms():
    created = {"banners": 0, "sections": 0}

    if not frappe.db.count("Marketplace Banner"):
        for spec in [HERO, *[dict(p, placement="Promo") for p in PROMOS]]:
            doc = frappe.new_doc("Marketplace Banner")
            doc.update(spec)
            doc.is_active = 1
            doc.insert(ignore_permissions=True)
            created["banners"] += 1

    if not frappe.db.count("Marketplace Homepage Section"):
        for spec in SECTIONS:
            doc = frappe.new_doc("Marketplace Homepage Section")
            doc.update(spec)
            doc.is_active = 1
            doc.insert(ignore_permissions=True)
            created["sections"] += 1

    frappe.db.commit()
    print("CMS_SEED:", frappe.as_json(created))
    return created

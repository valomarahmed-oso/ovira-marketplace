"""Branded Desk presence for the marketplace.

Two layers, mirroring how HRMS/LMS ship:
  * ``add_to_apps_screen`` (hooks.py) puts a branded Ovira tile on the /apps
    switcher, gated by :func:`has_app_permission`.
  * :func:`ensure_workspace` builds a public "Ovira Marketplace" workspace in the
    Desk sidebar with organised shortcuts + link cards, visible only to operators
    and System Managers.

Both are idempotent — ``ensure_workspace`` can run on every migrate or be invoked
directly via ``bench execute`` without a schema sync.
"""

import json

import frappe

WORKSPACE_NAME = "Ovira Marketplace"
WORKSPACE_ROLES = ("System Manager", "Marketplace Operator")

# Card label -> ordered list of (DocType, Arabic label) surfaced as links.
CARDS = [
    ("الإعدادات", [("Marketplace Settings", "إعدادات المتجر")]),
    (
        "البائعون",
        [
            ("Marketplace Vendor", "البائعون"),
            ("Marketplace Vendor Expense", "مصروفات البائعين"),
        ],
    ),
    (
        "الكتالوج",
        [
            ("Marketplace Product", "المنتجات"),
            ("Marketplace Category", "الفئات"),
        ],
    ),
    (
        "المحتوى",
        [
            ("Marketplace Banner", "البانرات"),
            ("Marketplace Homepage Section", "أقسام الصفحة الرئيسية"),
        ],
    ),
    ("الطلبات", [("Marketplace Order", "الطلبات")]),
    (
        "الشحن",
        [
            ("Marketplace Shipment", "الشحنات"),
            ("Shipping Provider", "شركات الشحن"),
        ],
    ),
    ("المدفوعات", [("Payment Connector", "بوابات الدفع")]),
]

# Quick-access tiles at the top of the workspace.
SHORTCUTS = [
    ("Marketplace Settings", "إعدادات المتجر", "Grey"),
    ("Marketplace Vendor", "إدارة البائعين", "Blue"),
    ("Marketplace Product", "المنتجات", "Green"),
    ("Marketplace Order", "الطلبات", "Orange"),
]


def has_app_permission(user=None):
    """Gate the /apps switcher tile to operators + System Managers."""
    user = user or frappe.session.user
    if user == "Administrator":
        return True
    return bool(set(frappe.get_roles(user)) & set(WORKSPACE_ROLES))


def _build_content():
    blocks = [
        {"id": "hdr_shortcuts", "type": "header", "data": {"text": "<span class=\"h4\"><b>اختصارات سريعة</b></span>", "col": 12}},
    ]
    for i, (link_to, label, _color) in enumerate(SHORTCUTS):
        blocks.append({"id": f"sc_{i}", "type": "shortcut", "data": {"shortcut_name": label, "col": 3}})
    blocks.append({"id": "hdr_manage", "type": "header", "data": {"text": "<span class=\"h4\"><b>إدارة المتجر</b></span>", "col": 12}})
    for i, (card_label, _links) in enumerate(CARDS):
        blocks.append({"id": f"card_{i}", "type": "card", "data": {"card_name": card_label, "col": 4}})
    return json.dumps(blocks, ensure_ascii=False)


def ensure_workspace():
    """Create or refresh the branded marketplace workspace. Idempotent."""
    if not frappe.db.exists("DocType", "Marketplace Settings"):
        return  # app DocTypes not synced yet

    if frappe.db.exists("Workspace", WORKSPACE_NAME):
        doc = frappe.get_doc("Workspace", WORKSPACE_NAME)
    else:
        doc = frappe.new_doc("Workspace")
        doc.name = WORKSPACE_NAME

    doc.title = WORKSPACE_NAME
    doc.label = WORKSPACE_NAME
    doc.module = "Marketplace"
    doc.public = 1
    doc.is_hidden = 0
    doc.icon = "shopping-cart"
    doc.indicator_color = "blue"
    doc.sequence_id = 20
    doc.content = _build_content()

    # Rebuild child tables so layout edits here are reflected on re-run.
    doc.set("roles", [{"role": r} for r in WORKSPACE_ROLES])

    doc.set("shortcuts", [])
    for link_to, label, color in SHORTCUTS:
        doc.append(
            "shortcuts",
            {"type": "DocType", "link_to": link_to, "label": label, "color": color},
        )

    doc.set("links", [])
    for card_label, links in CARDS:
        doc.append(
            "links",
            {
                "type": "Card Break",
                "label": card_label,
                "link_count": len(links),
                "onboard": 0,
            },
        )
        for link_to, label in links:
            doc.append(
                "links",
                {
                    "type": "Link",
                    "link_type": "DocType",
                    "link_to": link_to,
                    "label": label,
                    "onboard": 0,
                    "is_query_report": 0,
                },
            )

    doc.save(ignore_permissions=True)
    frappe.clear_cache()
    return doc.name

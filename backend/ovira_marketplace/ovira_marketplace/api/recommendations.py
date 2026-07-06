"""Recommendations — derived from real purchase behaviour.

Three views, all computed from Marketplace Order Item co-occurrence over orders
that actually went through (anything past Pending Payment, excluding Cancelled):

  * frequently_bought_together(slug)  — other products bought in the same orders
    as this one, most co-purchased first.
  * recommended_for_you()             — personalised: co-purchases of the things
    the signed-in shopper already bought, minus what they own; tops up with
    popular so the strip is never thin.
  * popular_products()                — best sellers by units, with a newest-
    products fallback for a fresh catalogue.

Everything is resolved back to approved + published product cards server-side,
so an unpublished or pending product can never surface as a recommendation.
"""

import frappe
from frappe.utils import cint

# Orders in these states never happened commercially — keep them out of signals.
_EXCLUDED_STATUSES = ("Cancelled", "Pending Payment")


def _cards(names, exclude=None):
    """Resolve product names → approved+published card rows, preserving the
    given order and dropping anything unpublished or excluded."""
    from ovira_marketplace.api.catalog import PRODUCT_LIST_FIELDS, _attach_card_fields

    exclude = set(exclude or [])
    wanted = [n for n in names if n and n not in exclude]
    if not wanted:
        return []
    rows = frappe.get_all(
        "Marketplace Product",
        filters=[
            ["name", "in", wanted],
            ["approval_status", "=", "Approved"],
            ["published", "=", 1],
        ],
        fields=PRODUCT_LIST_FIELDS,
        ignore_permissions=True,
    )
    by_name = {r.name: r for r in rows}
    ordered = [by_name[n] for n in wanted if n in by_name]
    _attach_card_fields(ordered)
    return ordered


def _co_purchased(products, limit, exclude=None):
    """Products most frequently bought in the same orders as any of `products`,
    ranked by number of distinct co-orders. Returns [(product, freq), ...]."""
    products = [p for p in set(products or []) if p]
    if not products:
        return []
    rows = frappe.db.sql(
        """
        SELECT oi2.marketplace_product AS product,
               COUNT(DISTINCT oi2.parent) AS freq
        FROM `tabMarketplace Order Item` oi1
        JOIN `tabMarketplace Order Item` oi2
          ON oi2.parent = oi1.parent
         AND oi2.marketplace_product != oi1.marketplace_product
        JOIN `tabMarketplace Order` o
          ON o.name = oi1.parent
        WHERE oi1.marketplace_product IN %(products)s
          AND o.status NOT IN %(excluded)s
          AND oi2.marketplace_product IS NOT NULL
        GROUP BY oi2.marketplace_product
        ORDER BY freq DESC
        LIMIT %(limit)s
        """,
        {
            "products": tuple(products),
            "excluded": _EXCLUDED_STATUSES,
            "limit": cint(limit) or 8,
        },
        as_dict=True,
    )
    skip = set(products) | set(exclude or [])
    return [(r.product, cint(r.freq)) for r in rows if r.product not in skip]


def _resolve_product(slug):
    return frappe.db.get_value(
        "Marketplace Product",
        {"slug": slug, "approval_status": "Approved", "published": 1},
        "name",
    )


@frappe.whitelist(allow_guest=True)
def frequently_bought_together(slug, limit=4):
    """Products commonly bought alongside the given product."""
    name = _resolve_product(slug)
    if not name:
        return []
    limit = min(cint(limit) or 4, 12)
    pairs = _co_purchased([name], limit * 2, exclude=[name])
    return _cards([p for p, _ in pairs], exclude=[name])[:limit]


@frappe.whitelist(allow_guest=True)
def popular_products(limit=12):
    """Best sellers by units sold; newest published products when nothing has
    sold yet, so the strip always has something to show."""
    from ovira_marketplace.api.catalog import PRODUCT_LIST_FIELDS, _attach_card_fields

    limit = min(cint(limit) or 12, 24)
    rows = frappe.db.sql(
        """
        SELECT oi.marketplace_product AS product, SUM(oi.qty) AS units
        FROM `tabMarketplace Order Item` oi
        JOIN `tabMarketplace Order` o ON o.name = oi.parent
        WHERE o.status NOT IN %(excluded)s
          AND oi.marketplace_product IS NOT NULL
        GROUP BY oi.marketplace_product
        ORDER BY units DESC
        LIMIT %(limit)s
        """,
        {"excluded": _EXCLUDED_STATUSES, "limit": limit},
        as_dict=True,
    )
    cards = _cards([r.product for r in rows])
    if len(cards) >= limit:
        return cards[:limit]

    # Top up (or fully populate a no-sales catalogue) with the newest products.
    have = {c.name for c in cards}
    fresh = frappe.get_all(
        "Marketplace Product",
        filters=[["approval_status", "=", "Approved"], ["published", "=", 1]],
        fields=PRODUCT_LIST_FIELDS,
        order_by="creation desc",
        limit_page_length=limit * 2,
        ignore_permissions=True,
    )
    fresh = [p for p in fresh if p.name not in have]
    _attach_card_fields(fresh)
    return (cards + fresh)[:limit]


def _my_purchased_products(email):
    """Distinct products the signed-in shopper has bought (matched like the buyer
    order endpoints: order email or a Customer they're a portal user of)."""
    from ovira_marketplace.api.orders import _my_customers

    or_clause = "o.email = %(email)s"
    params = {"email": email, "excluded": _EXCLUDED_STATUSES}
    customers = _my_customers(email)
    if customers:
        or_clause += " OR o.customer IN %(customers)s"
        params["customers"] = tuple(customers)
    return [
        r.product
        for r in frappe.db.sql(
            f"""
            SELECT DISTINCT oi.marketplace_product AS product
            FROM `tabMarketplace Order Item` oi
            JOIN `tabMarketplace Order` o ON o.name = oi.parent
            WHERE ({or_clause})
              AND o.status NOT IN %(excluded)s
              AND oi.marketplace_product IS NOT NULL
            """,
            params,
            as_dict=True,
        )
    ]


@frappe.whitelist(allow_guest=True)
def recommended_for_you(limit=12):
    """Personalised picks: co-purchases of what the shopper already bought, minus
    what they own, topped up with popular. Falls back entirely to popular for
    guests or shoppers with no purchase history."""
    limit = min(cint(limit) or 12, 24)
    user = frappe.session.user
    email = None
    if user and user != "Guest":
        email = frappe.db.get_value("User", user, "email") or user

    owned = _my_purchased_products(email) if email else []
    if not owned:
        return popular_products(limit)

    pairs = _co_purchased(owned, limit * 2, exclude=owned)
    cards = _cards([p for p, _ in pairs], exclude=owned)
    if len(cards) >= limit:
        return cards[:limit]

    # Thin history → top up with popular the shopper doesn't already own/have.
    have = {c.name for c in cards} | set(owned)
    extra = [p for p in popular_products(limit * 2) if p.name not in have]
    return (cards + extra)[:limit]

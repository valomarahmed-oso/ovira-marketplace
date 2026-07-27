"""Why a product isn't selling — the two numbers a sales figure can't give you.

A vendor looking at "1 sale this month" cannot tell which problem they have:
nobody saw it, everybody saw it and walked away, or plenty added it to a basket
and abandoned at checkout. Those are three different fixes — visibility, price
or photos, and checkout friction — and guessing between them is how vendors
lower prices that were never the problem.

So the store counts two more things per product per day: **views** and **cart
adds**. With orders that makes a funnel, and the funnel names the problem.

Counting is deliberately cheap: one UPSERT per event on a daily row, no document
load, no version history. A browse must never wait on analytics.
"""

import frappe
from frappe.utils import add_to_date, cint, flt, nowdate

STAT_DT = "Marketplace Product Stat"


def _bump(product, field, by=1):
    """Add to today's counter for a product, creating the row on first sight.

    Written as a single SQL statement so two people viewing the same product at
    the same moment can't lose a count to a read-modify-write race.
    """
    if not product:
        return
    try:
        day = nowdate()
        name = "{0}::{1}".format(product, day)
        frappe.db.sql(
            """insert into `tab{table}` (name, creation, modified, owner, modified_by,
                                          product, day, views, cart_adds)
               values (%(name)s, now(), now(), 'Administrator', 'Administrator',
                       %(product)s, %(day)s, %(views)s, %(carts)s)
               on duplicate key update `{field}` = `{field}` + %(by)s, modified = now()""".format(
                table=STAT_DT, field=field),
            {"name": name, "product": product, "day": day, "by": by,
             "views": by if field == "views" else 0,
             "carts": by if field == "cart_adds" else 0},
        )
    except Exception:
        # Analytics must never break the page it's measuring.
        frappe.log_error(frappe.get_traceback(), "Ovira: product stat")


def record_view(product):
    _bump(product, "views")


def record_cart_adds(products):
    for product in set(p for p in (products or []) if p):
        _bump(product, "cart_adds")


# ── the vendor's view ───────────────────────────────────────────────────────
@frappe.whitelist()
def my_product_funnel(days=30, limit=50):
    """Views → basket → sold, per product, for the signed-in vendor.

    Sorted by the biggest gap between interest and sales, because the product
    worth the vendor's attention is the one plenty of people looked at and didn't
    buy — not the one nobody has seen.
    """
    from ovira_marketplace.api.vendor import _my_vendor

    vendor = _my_vendor()
    if not vendor:
        frappe.throw(frappe._("This page is for vendors."), frappe.PermissionError)

    since = add_to_date(nowdate(), days=-cint(days or 30))
    products = frappe.get_all(
        "Marketplace Product", filters={"vendor": vendor},
        fields=["name", "title", "price", "stock_qty", "published"],
        limit_page_length=cint(limit) or 50, ignore_permissions=True,
    )
    if not products:
        return {"days": cint(days or 30), "rows": []}
    ids = [p["name"] for p in products]

    stats = {}
    for r in frappe.get_all(
        STAT_DT, filters=[["product", "in", ids], ["day", ">=", since]],
        fields=["product", "views", "cart_adds"], limit_page_length=0, ignore_permissions=True,
    ):
        agg = stats.setdefault(r["product"], {"views": 0, "cart_adds": 0})
        agg["views"] += cint(r["views"])
        agg["cart_adds"] += cint(r["cart_adds"])

    sold = {}
    order_ids = frappe.get_all(
        "Marketplace Order",
        filters=[["creation", ">=", since], ["status", "in", ["Paid", "Processing", "Shipped", "Completed"]]],
        pluck="name", limit_page_length=0, ignore_permissions=True,
    )
    if order_ids:
        for r in frappe.get_all(
            "Marketplace Order Item",
            filters=[["parent", "in", order_ids], ["marketplace_product", "in", ids]],
            fields=["marketplace_product", "qty"], limit_page_length=0, ignore_permissions=True,
        ):
            sold[r["marketplace_product"]] = sold.get(r["marketplace_product"], 0) + cint(r["qty"])

    rows = []
    for p in products:
        s = stats.get(p["name"], {"views": 0, "cart_adds": 0})
        views, carts, orders = s["views"], s["cart_adds"], sold.get(p["name"], 0)
        rows.append({
            "product": p["name"], "title": p["title"], "price": flt(p["price"]),
            "stock_qty": cint(p["stock_qty"]), "published": cint(p["published"]),
            "views": views, "cart_adds": carts, "sold": orders,
            "view_to_cart": round(carts / views * 100, 1) if views else 0,
            "cart_to_sale": round(orders / carts * 100, 1) if carts else 0,
            "diagnosis": _diagnose(views, carts, orders, cint(p["published"])),
        })
    rows.sort(key=lambda r: (r["views"] - r["sold"] * 10), reverse=True)
    return {"days": cint(days or 30), "rows": rows}


def _diagnose(views, carts, sold, published):
    """Name the problem in the vendor's language.

    Thresholds are deliberately loose: this is meant to point at where to look,
    not to pretend a handful of visits is a statistically sound sample.
    """
    if not published:
        return "unpublished"
    if views < 20:
        return "unseen"          # nobody is finding it — visibility, not the product
    if carts == 0:
        return "not_tempting"    # they look and walk away — price, photos, description
    if sold == 0:
        return "abandoned"       # baskets but no sales — shipping cost, checkout, stock
    return "healthy"

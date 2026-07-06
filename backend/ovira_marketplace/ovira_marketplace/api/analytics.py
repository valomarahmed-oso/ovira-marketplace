"""Operator analytics — a read-only, marketplace-wide command center.

Aggregates the whole operation for the signed-in operator: windowed KPIs (GMV,
orders, commission = operator revenue, AOV), a daily GMV trend, top products and
top vendors, an order-status breakdown, plus three point-in-time snapshots that
aren't windowed — accrued sponsored ad revenue, and the outstanding wallet and
loyalty-point liabilities the operator owes shoppers.

Everything is read-only and operator-gated; nothing here writes.
"""

import csv
import io

import frappe
from frappe.utils import add_days, cint, flt, getdate, nowdate

from ovira_marketplace.api.admin import _require_operator
from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)

ANALYTICS_WINDOWS = (7, 30, 90, 365)


def _window_start(days):
    """Start date for the window, or None for all-time (days <= 0)."""
    return None if days <= 0 else getdate(add_days(nowdate(), -(days - 1)))


def _snapshots():
    """Point-in-time liabilities/revenue that ignore the window."""
    ad_revenue = flt(
        frappe.db.sql("SELECT COALESCE(SUM(spend), 0) FROM `tabMarketplace Sponsored Placement`")[0][0]
    )
    wallet = frappe.db.sql(
        "SELECT entry_type, COALESCE(SUM(amount), 0) FROM `tabMarketplace Wallet Entry` GROUP BY entry_type"
    )
    wallet_map = {r[0]: flt(r[1]) for r in wallet}
    wallet_liability = wallet_map.get("Credit", 0.0) - wallet_map.get("Debit", 0.0)

    loyalty = frappe.db.sql(
        "SELECT entry_type, COALESCE(SUM(points), 0) FROM `tabMarketplace Loyalty Entry` GROUP BY entry_type"
    )
    loyalty_map = {r[0]: cint(r[1]) for r in loyalty}
    loyalty_outstanding = loyalty_map.get("Earn", 0) - loyalty_map.get("Redeem", 0)

    return {
        "ad_revenue": round(ad_revenue, 2),
        "wallet_liability": round(wallet_liability, 2),
        "loyalty_outstanding": loyalty_outstanding,
    }


def _empty(days):
    start = getdate(add_days(nowdate(), -(days - 1)))
    return {
        "currency": get_settings().default_currency,
        "period_days": days,
        "totals": {"gmv": 0.0, "orders": 0, "completed": 0, "commission": 0.0, "aov": 0.0},
        "trend": [{"date": str(add_days(start, i)), "gmv": 0.0} for i in range(days)],
        "top_products": [],
        "top_vendors": [],
        "status_breakdown": [],
        **_snapshots(),
    }


@frappe.whitelist()
def operator_overview(days=30):
    """Marketplace-wide performance for the selected window, plus current
    liabilities. Operator only."""
    _require_operator()
    days = cint(days) or 30
    if days not in ANALYTICS_WINDOWS:
        days = 30
    start = getdate(add_days(nowdate(), -(days - 1)))

    orders = frappe.db.sql(
        """
        SELECT name, status, COALESCE(total, 0) AS total, creation
        FROM `tabMarketplace Order`
        WHERE creation >= %(start)s
        """,
        {"start": start},
        as_dict=True,
    )
    if not orders:
        return _empty(days)

    gmv = 0.0
    order_count = completed = 0
    status_counts: dict = {}
    trend_map: dict = {}
    for o in orders:
        status_counts[o.status] = status_counts.get(o.status, 0) + 1
        if o.status == "Cancelled":
            continue
        gmv += flt(o.total)
        order_count += 1
        if o.status == "Completed":
            completed += 1
        d = str(getdate(o.creation))
        trend_map[d] = trend_map.get(d, 0.0) + flt(o.total)

    items = frappe.db.sql(
        """
        SELECT oi.marketplace_product AS product, oi.title, oi.vendor,
               oi.qty, oi.amount, oi.commission_amount
        FROM `tabMarketplace Order Item` oi
        JOIN `tabMarketplace Order` o ON o.name = oi.parent
        WHERE o.creation >= %(start)s AND o.status != 'Cancelled'
        """,
        {"start": start},
        as_dict=True,
    )

    commission = 0.0
    prod_agg: dict = {}
    vendor_agg: dict = {}
    for r in items:
        commission += flt(r.commission_amount)
        if r.product:
            pa = prod_agg.setdefault(
                r.product, {"product": r.product, "title": r.title, "qty": 0.0, "revenue": 0.0}
            )
            pa["qty"] += flt(r.qty)
            pa["revenue"] += flt(r.amount)
        if r.vendor:
            va = vendor_agg.setdefault(
                r.vendor, {"vendor": r.vendor, "gmv": 0.0, "commission": 0.0}
            )
            va["gmv"] += flt(r.amount)
            va["commission"] += flt(r.commission_amount)

    top_products = sorted(prod_agg.values(), key=lambda p: p["revenue"], reverse=True)[:5]
    for p in top_products:
        p["qty"] = int(p["qty"])
        p["revenue"] = round(p["revenue"], 2)

    top_vendors = sorted(vendor_agg.values(), key=lambda v: v["gmv"], reverse=True)[:5]
    _name_vendors(top_vendors)
    for v in top_vendors:
        v["gmv"] = round(v["gmv"], 2)
        v["commission"] = round(v["commission"], 2)

    trend = [
        {"date": str(add_days(start, i)), "gmv": round(trend_map.get(str(add_days(start, i)), 0.0), 2)}
        for i in range(days)
    ]
    status_breakdown = [
        {"status": k, "count": v} for k, v in sorted(status_counts.items(), key=lambda x: -x[1])
    ]

    return {
        "currency": get_settings().default_currency,
        "period_days": days,
        "totals": {
            "gmv": round(gmv, 2),
            "orders": order_count,
            "completed": completed,
            "commission": round(commission, 2),
            "aov": round(gmv / order_count, 2) if order_count else 0.0,
        },
        "trend": trend,
        "top_products": top_products,
        "top_vendors": top_vendors,
        "status_breakdown": status_breakdown,
        **_snapshots(),
    }


def _vendor_names(codes):
    """Map of vendor code -> display name (falling back to the code)."""
    codes = {c for c in codes if c}
    if not codes:
        return {}
    return {
        v.name: (v.vendor_name or v.name)
        for v in frappe.get_all(
            "Marketplace Vendor",
            filters={"name": ["in", list(codes)]},
            fields=["name", "vendor_name"],
            ignore_permissions=True,
        )
    }


def _name_vendors(rows):
    names = _vendor_names(r.get("vendor") for r in rows)
    for r in rows:
        r["vendor_name"] = names.get(r["vendor"]) or r["vendor"]


# ---------------------------------------------------------------------------
# CSV exports — operator-only reconciliation downloads
# ---------------------------------------------------------------------------

ORDER_EXPORT_HEADER = [
    "Order",
    "Date",
    "Status",
    "Payment",
    "Customer",
    "Phone",
    "Source",
    "Subtotal",
    "Shipping",
    "Total",
    "Commission",
    "Currency",
]

PRODUCT_EXPORT_HEADER = ["Product", "Vendor", "Units Sold", "Revenue", "Commission"]


def _csv_text(header, rows):
    """CSV body with a UTF-8 BOM so Excel renders Arabic correctly."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return "﻿" + buf.getvalue()


def _export_days(days):
    days = cint(days)
    return days if (days in ANALYTICS_WINDOWS or days <= 0) else 30


def _commission_by_order(order_ids):
    """Sum of per-item commission for each order (operator revenue)."""
    if not order_ids:
        return {}
    agg = {}
    for r in frappe.get_all(
        "Marketplace Order Item",
        filters={"parent": ["in", order_ids]},
        fields=["parent", "commission_amount"],
        ignore_permissions=True,
        limit_page_length=0,
    ):
        agg[r["parent"]] = agg.get(r["parent"], 0.0) + flt(r["commission_amount"])
    return {k: round(v, 2) for k, v in agg.items()}


@frappe.whitelist()
def export_orders_csv(days=30, status=None):
    """One CSV row per order over the window (days=0 => all time). Operator only."""
    _require_operator()
    start = _window_start(_export_days(days))

    filters = {}
    if start:
        filters["creation"] = [">=", start]
    if status and status not in ("All", ""):
        filters["status"] = status

    orders = frappe.get_all(
        "Marketplace Order",
        filters=filters,
        fields=[
            "name", "creation", "status", "payment_status", "customer_name",
            "phone", "source", "subtotal", "shipping_amount", "total", "currency",
        ],
        order_by="creation desc",
        ignore_permissions=True,
        limit_page_length=0,
    )
    commission = _commission_by_order([o["name"] for o in orders])

    rows = [
        [
            o["name"],
            str(getdate(o["creation"])),
            o.get("status") or "",
            o.get("payment_status") or "",
            o.get("customer_name") or "",
            o.get("phone") or "",
            o.get("source") or "direct",
            flt(o.get("subtotal")),
            flt(o.get("shipping_amount")),
            flt(o.get("total")),
            commission.get(o["name"], 0.0),
            o.get("currency") or "",
        ]
        for o in orders
    ]
    return _csv_text(ORDER_EXPORT_HEADER, rows)


@frappe.whitelist()
def export_products_csv(days=30):
    """One CSV row per product sold over the window (days=0 => all time). Operator only."""
    _require_operator()
    start = _window_start(_export_days(days))

    conds = "o.status != 'Cancelled'"
    params = {}
    if start:
        conds += " AND o.creation >= %(start)s"
        params["start"] = start

    items = frappe.db.sql(
        f"""
        SELECT oi.marketplace_product AS product, oi.title, oi.vendor,
               oi.qty, oi.amount, oi.commission_amount
        FROM `tabMarketplace Order Item` oi
        JOIN `tabMarketplace Order` o ON o.name = oi.parent
        WHERE {conds}
        """,
        params,
        as_dict=True,
    )

    agg = {}
    for r in items:
        key = r.product or r.title
        a = agg.setdefault(
            key, {"title": r.title, "vendor": r.vendor, "qty": 0.0, "revenue": 0.0, "commission": 0.0}
        )
        a["qty"] += flt(r.qty)
        a["revenue"] += flt(r.amount)
        a["commission"] += flt(r.commission_amount)

    names = _vendor_names(a["vendor"] for a in agg.values())
    rows = [
        [
            a["title"] or "",
            names.get(a["vendor"]) or a["vendor"] or "",
            int(a["qty"]),
            round(a["revenue"], 2),
            round(a["commission"], 2),
        ]
        for a in sorted(agg.values(), key=lambda x: x["revenue"], reverse=True)
    ]
    return _csv_text(PRODUCT_EXPORT_HEADER, rows)

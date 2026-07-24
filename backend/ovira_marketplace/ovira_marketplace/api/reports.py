"""Operator reports — comprehensive, printable business reports over a date
range. All aggregation is server-side; the storefront renders + prints/exports.
Revenue counts paid orders only."""

import frappe
from frappe.utils import add_days, cint, flt, getdate, nowdate

from ovira_marketplace.api.admin import _require_operator


def _range(from_date, to_date):
    to_d = getdate(to_date) if to_date else getdate(nowdate())
    from_d = getdate(from_date) if from_date else add_days(to_d, -29)
    return str(from_d), str(to_d)


@frappe.whitelist()
def full_report(from_date=None, to_date=None):
    """Everything for the operator's report over a date range: sales summary,
    status breakdown, top products, per-vendor sales, low stock, coupons."""
    _require_operator()
    frm, to = _range(from_date, to_date)
    p = {"frm": frm, "to": to}

    summary = frappe.db.sql(
        """
        select
          count(*) as orders,
          sum(case when payment_status='Paid' then 1 else 0 end) as paid_orders,
          sum(case when payment_status='Paid' then total else 0 end) as revenue,
          sum(case when payment_status='Paid' then discount_amount else 0 end) as discounts,
          sum(case when payment_status='Paid' then shipping_amount else 0 end) as shipping
        from `tabMarketplace Order`
        where date(creation) between %(frm)s and %(to)s
        """,
        p,
        as_dict=True,
    )[0]
    revenue = flt(summary.revenue)
    paid = cint(summary.paid_orders)
    summary = {
        "orders": cint(summary.orders),
        "paid_orders": paid,
        "revenue": round(revenue, 2),
        "aov": round(revenue / paid, 2) if paid else 0,
        "discounts": round(flt(summary.discounts), 2),
        "shipping": round(flt(summary.shipping), 2),
    }

    by_status = frappe.db.sql(
        """
        select status, count(*) as cnt
        from `tabMarketplace Order`
        where date(creation) between %(frm)s and %(to)s
        group by status order by cnt desc
        """,
        p,
        as_dict=True,
    )

    top_products = frappe.db.sql(
        """
        select oi.title as title, sum(oi.qty) as qty, sum(oi.amount) as revenue
        from `tabMarketplace Order Item` oi
        join `tabMarketplace Order` o on o.name = oi.parent
        where o.payment_status='Paid' and date(o.creation) between %(frm)s and %(to)s
        group by oi.title order by revenue desc limit 20
        """,
        p,
        as_dict=True,
    )

    vendor_sales = frappe.db.sql(
        """
        select v.vendor_name as vendor, count(distinct o.name) as orders,
          sum(oi.amount) as gross, sum(oi.commission_amount) as commission
        from `tabMarketplace Order Item` oi
        join `tabMarketplace Order` o on o.name = oi.parent
        left join `tabMarketplace Vendor` v on v.name = oi.vendor
        where o.payment_status='Paid' and date(o.creation) between %(frm)s and %(to)s
        group by oi.vendor order by gross desc limit 50
        """,
        p,
        as_dict=True,
    )
    for r in vendor_sales:
        r["gross"] = round(flt(r["gross"]), 2)
        r["commission"] = round(flt(r["commission"]), 2)
        r["net"] = round(flt(r["gross"]) - flt(r["commission"]), 2)

    low_stock = frappe.db.sql(
        """
        select title, stock_qty, low_stock_threshold
        from `tabMarketplace Product`
        where approval_status='Approved' and published=1 and track_inventory=1
          and stock_qty <= greatest(coalesce(low_stock_threshold, 0), 0)
        order by stock_qty asc limit 50
        """,
        as_dict=True,
    )
    inv = frappe.db.sql(
        """
        select count(*) as total,
          sum(case when track_inventory=1 and stock_qty<=0 then 1 else 0 end) as out_of_stock
        from `tabMarketplace Product` where approval_status='Approved' and published=1
        """,
        as_dict=True,
    )[0]

    coupons = frappe.db.sql(
        """
        select code, discount_type, discount_value, used_count, vendor
        from `tabMarketplace Coupon` where used_count > 0
        order by used_count desc limit 50
        """,
        as_dict=True,
    )

    return {
        "from_date": frm,
        "to_date": to,
        "generated_on": frappe.utils.now_datetime().strftime("%Y-%m-%d %H:%M"),
        "currency": frappe.db.get_single_value("Marketplace Settings", "default_currency") or "EGP",
        "summary": summary,
        "by_status": by_status,
        "top_products": top_products,
        "vendor_sales": vendor_sales,
        "inventory": {
            "total": cint(inv.total),
            "out_of_stock": cint(inv.out_of_stock),
            "low_stock": low_stock,
        },
        "coupons": coupons,
    }

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


def email_operator_report():
    """Weekly scheduler: email the last-7-days performance digest to every
    operator. Best-effort; only runs when outgoing mail is configured."""
    from ovira_marketplace.emails import outgoing_configured, send_operator_report

    if not outgoing_configured():
        return
    frm = str(add_days(getdate(nowdate()), -7))
    report = _report_data(frm, str(getdate(nowdate())))

    recipients = set()
    for u in frappe.get_all(
        "Has Role",
        filters={"role": ["in", ["Marketplace Operator", "System Manager"]], "parenttype": "User"},
        pluck="parent",
    ):
        email = frappe.db.get_value("User", u, "email")
        if email and "@" in email and email not in ("Guest", "Administrator"):
            recipients.add(email)
    for email in recipients:
        try:
            send_operator_report(email, report)
        except Exception:
            frappe.log_error(title="Ovira: operator report email failed")


@frappe.whitelist()
def full_report(from_date=None, to_date=None):
    """Everything for the operator's report over a date range: sales summary,
    status breakdown, top products, per-vendor sales, low stock, coupons."""
    _require_operator()
    frm, to = _range(from_date, to_date)
    return _report_data(frm, to)


def _report_data(frm, to):
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


def _currency():
    return frappe.db.get_single_value("Marketplace Settings", "default_currency") or "EGP"


# -- vendor report (a vendor's own store) -----------------------------------


@frappe.whitelist()
def vendor_report(from_date=None, to_date=None):
    """A vendor's own performance over a date range: gross sales, commission,
    net payout, orders, top products, order-status split, and their low stock."""
    from ovira_marketplace.api.vendor import _my_vendor

    vendor = _my_vendor()
    if not vendor:
        frappe.throw(frappe._("You don't have a vendor store."), frappe.PermissionError)
    frm, to = _range(from_date, to_date)
    p = {"frm": frm, "to": to, "v": vendor}

    summ = frappe.db.sql(
        """
        select count(distinct o.name) as orders, sum(oi.qty) as units,
          sum(oi.amount) as gross, sum(oi.commission_amount) as commission,
          sum(oi.vendor_shipping) as shipping
        from `tabMarketplace Order Item` oi
        join `tabMarketplace Order` o on o.name = oi.parent
        where oi.vendor = %(v)s and o.payment_status='Paid'
          and date(o.creation) between %(frm)s and %(to)s
        """,
        p,
        as_dict=True,
    )[0]
    gross = flt(summ.gross)
    commission = flt(summ.commission)
    net = round(gross - commission + flt(summ.shipping), 2)
    summary = {
        "orders": cint(summ.orders),
        "units": cint(summ.units),
        "gross": round(gross, 2),
        "commission": round(commission, 2),
        "net": net,
        "aov": round(gross / cint(summ.orders), 2) if cint(summ.orders) else 0,
    }

    by_status = frappe.db.sql(
        """
        select o.status as status, count(distinct o.name) as cnt
        from `tabMarketplace Order Item` oi
        join `tabMarketplace Order` o on o.name = oi.parent
        where oi.vendor = %(v)s and date(o.creation) between %(frm)s and %(to)s
        group by o.status order by cnt desc
        """,
        p,
        as_dict=True,
    )

    top_products = frappe.db.sql(
        """
        select oi.title as title, sum(oi.qty) as qty, sum(oi.amount) as revenue
        from `tabMarketplace Order Item` oi
        join `tabMarketplace Order` o on o.name = oi.parent
        where oi.vendor = %(v)s and o.payment_status='Paid'
          and date(o.creation) between %(frm)s and %(to)s
        group by oi.title order by revenue desc limit 20
        """,
        p,
        as_dict=True,
    )

    low_stock = frappe.db.sql(
        """
        select title, stock_qty, low_stock_threshold
        from `tabMarketplace Product`
        where vendor = %(v)s and approval_status='Approved' and published=1
          and track_inventory=1 and stock_qty <= greatest(coalesce(low_stock_threshold,0),0)
        order by stock_qty asc limit 50
        """,
        {"v": vendor},
        as_dict=True,
    )

    return {
        "from_date": frm,
        "to_date": to,
        "generated_on": frappe.utils.now_datetime().strftime("%Y-%m-%d %H:%M"),
        "currency": _currency(),
        "summary": summary,
        "by_status": by_status,
        "top_products": top_products,
        "low_stock": low_stock,
    }


# -- buyer report (a shopper's own purchases) -------------------------------


@frappe.whitelist()
def buyer_report(from_date=None, to_date=None):
    """The signed-in buyer's own purchase summary over a date range."""
    from ovira_marketplace.api.orders import _order_or_filters, _session_email

    email = _session_email()
    if not email:
        frappe.throw(frappe._("Please sign in."), frappe.PermissionError)
    frm, to = _range(from_date, to_date)

    orders = frappe.get_all(
        "Marketplace Order",
        or_filters=_order_or_filters(email),
        filters=[["creation", ">=", frm + " 00:00:00"], ["creation", "<=", to + " 23:59:59"]],
        fields=["name", "status", "payment_status", "total", "creation"],
        ignore_permissions=True,
        limit_page_length=0,
    )
    paid = [o for o in orders if o.payment_status == "Paid"]
    spent = round(sum(flt(o.total) for o in paid), 2)
    by_status = {}
    for o in orders:
        by_status[o.status] = by_status.get(o.status, 0) + 1

    order_ids = [o.name for o in orders]
    top_products = []
    if order_ids:
        top_products = frappe.db.sql(
            """
            select title, sum(qty) as qty, sum(amount) as spent
            from `tabMarketplace Order Item`
            where parent in %(ids)s
            group by title order by spent desc limit 20
            """,
            {"ids": order_ids},
            as_dict=True,
        )

    return {
        "from_date": frm,
        "to_date": to,
        "generated_on": frappe.utils.now_datetime().strftime("%Y-%m-%d %H:%M"),
        "currency": _currency(),
        "summary": {
            "orders": len(orders),
            "paid_orders": len(paid),
            "spent": spent,
            "aov": round(spent / len(paid), 2) if paid else 0,
        },
        "by_status": [{"status": k, "cnt": v} for k, v in sorted(by_status.items(), key=lambda x: -x[1])],
        "top_products": top_products,
    }

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, getdate, nowdate

from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)

ANALYTICS_WINDOWS = (7, 30, 90, 365)


def _my_vendor():
    """The current user's vendor store name, or None."""
    return frappe.db.get_value("Marketplace Vendor", {"user": frappe.session.user}, "name")


STOREFRONT_FIELDS = [
    "name",
    "vendor_name",
    "slug",
    "logo",
    "banner",
    "description",
    "return_policy",
    "shipping_policy",
    "rating",
    "ratings_count",
    "store_rating",
    "store_reviews_count",
    "trust_score",
    "trust_tier",
    "orders_count",
    "creation",
]


@frappe.whitelist(allow_guest=True)
def vendor_storefront(slug):
    """Public seller profile by slug (Active stores only) — safe fields plus a
    live count of the store's approved, published products."""
    v = frappe.db.get_value(
        "Marketplace Vendor", {"slug": slug, "status": "Active"}, STOREFRONT_FIELDS, as_dict=True
    )
    if not v:
        frappe.throw(_("Store not found."), frappe.DoesNotExistError)
    v["product_count"] = frappe.db.count(
        "Marketplace Product",
        {"vendor": v.name, "approval_status": "Approved", "published": 1},
    )
    return v


STORE_CARD_FIELDS = [
    "name",
    "vendor_name",
    "slug",
    "logo",
    "rating",
    "ratings_count",
    "trust_score",
    "trust_tier",
    "orders_count",
]


@frappe.whitelist(allow_guest=True)
def list_stores(search=None, limit=60):
    """Public directory of Active seller storefronts that have at least one
    approved, published product. Best-established first."""
    or_filters = [["vendor_name", "like", f"%{search}%"]] if search else None
    vendors = frappe.get_all(
        "Marketplace Vendor",
        filters={"status": "Active"},
        or_filters=or_filters,
        fields=STORE_CARD_FIELDS,
        order_by="orders_count desc, rating desc, creation desc",
        limit_page_length=cint(limit) or 60,
        ignore_permissions=True,
    )
    if not vendors:
        return []

    names = [v["name"] for v in vendors]
    counts = {}
    for r in frappe.get_all(
        "Marketplace Product",
        filters={"vendor": ["in", names], "approval_status": "Approved", "published": 1},
        fields=["vendor"],
        ignore_permissions=True,
        limit_page_length=0,
    ):
        counts[r["vendor"]] = counts.get(r["vendor"], 0) + 1

    out = []
    for v in vendors:
        v["product_count"] = counts.get(v["name"], 0)
        if v["product_count"] > 0:
            out.append(v)
    return out


@frappe.whitelist()
def register(vendor_name, email=None, phone=None, description=None):
    """Storefront endpoint: the logged-in user opens a vendor store.

    Creates a Marketplace Vendor, Pending by default (or Active if the
    marketplace auto-approves). Activation provisions the ERPNext records.
    """
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Please sign in to register as a vendor."), frappe.PermissionError)

    settings = get_settings()
    if settings.mode != "Multi Vendor":
        frappe.throw(
            _("Vendor registration is disabled in single-company mode."),
            frappe.PermissionError,
        )

    existing = frappe.db.get_value("Marketplace Vendor", {"user": user}, "name")
    if existing:
        frappe.throw(_("You already have a vendor store: {0}").format(existing))
    vendor = frappe.new_doc("Marketplace Vendor")
    vendor.vendor_name = vendor_name
    vendor.user = user
    vendor.email = email or frappe.db.get_value("User", user, "email")
    vendor.phone = phone
    vendor.description = description
    vendor.status = "Active" if settings.auto_approve_vendors else "Pending"
    vendor.insert(ignore_permissions=True)

    return {"name": vendor.name, "slug": vendor.slug, "status": vendor.status}


@frappe.whitelist()
def my_store():
    """Return the current user's vendor store, or None."""
    name = _my_vendor()
    return frappe.get_doc("Marketplace Vendor", name).as_dict() if name else None


VENDOR_EDITABLE_FIELDS = (
    "vendor_name",
    "description",
    "phone",
    "return_policy",
    "shipping_policy",
    "shipping_type",
    "shipping_fee",
    "shipping_free_over",
    "logo",
    "banner",
)


@frappe.whitelist()
def update_my_store(**kwargs):
    """Let a vendor edit their own store profile (name, policies, media)."""
    name = _my_vendor()
    if not name:
        frappe.throw(_("You don't have a vendor store."), frappe.PermissionError)
    doc = frappe.get_doc("Marketplace Vendor", name)
    for field in VENDOR_EDITABLE_FIELDS:
        if field in kwargs and kwargs[field] is not None:
            doc.set(field, kwargs[field])
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return doc.as_dict()


@frappe.whitelist()
def my_orders(limit=100):
    """Orders that contain at least one line for the current vendor.

    Each row carries the vendor's own slice (item count + subtotal), not the
    whole marketplace order total, so a vendor only ever sees their share.
    """
    vendor = _my_vendor()
    if not vendor:
        return []
    lines = frappe.get_all(
        "Marketplace Order Item",
        filters={"vendor": vendor},
        fields=["parent", "qty", "amount"],
        ignore_permissions=True,
    )
    if not lines:
        return []

    order_ids = list({ln["parent"] for ln in lines})
    orders = {
        o["name"]: o
        for o in frappe.get_all(
            "Marketplace Order",
            filters={"name": ["in", order_ids]},
            fields=["name", "customer_name", "status", "currency", "creation"],
            ignore_permissions=True,
        )
    }

    agg = {}
    for ln in lines:
        row = agg.setdefault(ln["parent"], {"item_count": 0, "vendor_total": 0.0})
        row["item_count"] += 1
        row["vendor_total"] += ln.get("amount") or 0

    result = []
    for oid, a in agg.items():
        order = orders.get(oid)
        if not order:
            continue
        result.append(
            {
                "name": oid,
                "customer_name": order.get("customer_name"),
                "status": order.get("status"),
                "currency": order.get("currency"),
                "creation": order.get("creation"),
                "item_count": a["item_count"],
                "vendor_total": a["vendor_total"],
            }
        )
    result.sort(key=lambda r: r["creation"] or "", reverse=True)
    return result[: cint(limit) or 100]


@frappe.whitelist()
def export_my_orders_csv():
    """The vendor's order slices as CSV text — download, open in a spreadsheet,
    reconcile. Reuses ``my_orders`` so a vendor only ever sees their own share."""
    import csv
    import io

    vendor = _my_vendor()
    if not vendor:
        frappe.throw(_("Only registered vendors can export orders."), frappe.PermissionError)
    rows = my_orders(limit=100000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["order", "date", "customer", "status", "items", "vendor_total", "currency"])
    for r in rows:
        writer.writerow([
            r["name"],
            (r.get("creation") or "")[:10] if isinstance(r.get("creation"), str) else str(r.get("creation") or "")[:10],
            r.get("customer_name") or "",
            r.get("status") or "",
            r.get("item_count") or 0,
            r.get("vendor_total") or 0,
            r.get("currency") or "",
        ])
    return {"csv": buf.getvalue(), "count": len(rows)}


def _empty_analytics(days):
    return {
        "currency": get_settings().default_currency,
        "products": 0,
        "totals": {
            "gross_sales": 0.0,
            "commission": 0.0,
            "net_earnings": 0.0,
            "units_sold": 0,
            "orders": 0,
            "avg_order_value": 0.0,
        },
        "period_days": days,
        "period": {"revenue": 0.0, "units": 0, "orders": 0},
        "trend": [{"date": str(getdate(add_days(nowdate(), -(days - 1) + i))), "revenue": 0.0} for i in range(days)],
        "top_products": [],
        "status_breakdown": [],
    }


@frappe.whitelist()
def vendor_analytics(days=30):
    """Read-only performance summary for the logged-in vendor: lifetime totals,
    a paid-revenue trend over the last `days`, top products and an order-status
    breakdown. Only the vendor's own lines (already split into Sales Orders) are
    counted, so figures line up with the financial statement."""
    vendor = _my_vendor()
    days = cint(days) or 30
    if days not in ANALYTICS_WINDOWS:
        days = 30
    if not vendor:
        return _empty_analytics(days)

    rows = frappe.db.sql(
        """
        SELECT oi.parent, oi.marketplace_product AS product, oi.title,
               oi.qty, oi.amount, oi.commission_amount,
               o.status, o.payment_status, o.creation
        FROM `tabMarketplace Order Item` oi
        INNER JOIN `tabMarketplace Order` o ON o.name = oi.parent
        WHERE oi.vendor = %(vendor)s
          AND oi.sales_order IS NOT NULL AND oi.sales_order != ''
        """,
        {"vendor": vendor},
        as_dict=True,
    )

    gross = commission = units = 0.0
    order_status = {}  # one status per order (for the breakdown)
    prod_agg = {}
    for r in rows:
        gross += flt(r.amount)
        commission += flt(r.commission_amount)
        units += flt(r.qty)
        order_status[r.parent] = r.status
        pa = prod_agg.setdefault(
            r.product, {"product": r.product, "title": r.title, "qty": 0.0, "revenue": 0.0}
        )
        pa["qty"] += flt(r.qty)
        pa["revenue"] += flt(r.amount)

    orders = len(order_status)
    net = gross - commission

    # Realized (paid) revenue by day over the selected window.
    start = getdate(add_days(nowdate(), -(days - 1)))
    trend_map = {}
    period_rev = period_units = 0.0
    period_orders = set()
    for r in rows:
        if r.payment_status != "Paid":
            continue
        d = getdate(r.creation)
        if d < start:
            continue
        trend_map[str(d)] = trend_map.get(str(d), 0.0) + flt(r.amount)
        period_rev += flt(r.amount)
        period_units += flt(r.qty)
        period_orders.add(r.parent)

    trend = [
        {
            "date": str(getdate(add_days(nowdate(), -(days - 1) + i))),
            "revenue": round(trend_map.get(str(getdate(add_days(nowdate(), -(days - 1) + i))), 0.0), 2),
        }
        for i in range(days)
    ]

    top_products = sorted(prod_agg.values(), key=lambda p: p["revenue"], reverse=True)[:5]
    for p in top_products:
        p["qty"] = int(p["qty"])
        p["revenue"] = round(p["revenue"], 2)

    counts = {}
    for st in order_status.values():
        counts[st] = counts.get(st, 0) + 1
    status_breakdown = [
        {"status": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])
    ]

    return {
        "currency": get_settings().default_currency,
        "products": frappe.db.count("Marketplace Product", {"vendor": vendor}),
        "totals": {
            "gross_sales": round(gross, 2),
            "commission": round(commission, 2),
            "net_earnings": round(net, 2),
            "units_sold": int(units),
            "orders": orders,
            "avg_order_value": round(gross / orders, 2) if orders else 0.0,
        },
        "period_days": days,
        "period": {
            "revenue": round(period_rev, 2),
            "units": int(period_units),
            "orders": len(period_orders),
        },
        "trend": trend,
        "top_products": top_products,
        "status_breakdown": status_breakdown,
    }

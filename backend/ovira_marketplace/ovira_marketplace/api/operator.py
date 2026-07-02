"""Operator console API — manage the whole marketplace from the branded
storefront admin (``/admin/*``), so operators never open the ERPNext Desk.

Operator-only (System Manager / Marketplace Operator). Grows one module at a
time (vendors, products, orders, CMS, categories, payouts, reports). The
operator gate is shared with :mod:`ovira_marketplace.api.admin`.
"""

import frappe
from frappe import _
from frappe.utils import cint, flt

from ovira_marketplace.api.admin import _require_operator

# ---------------------------------------------------------------------------
# Vendors
# ---------------------------------------------------------------------------

VENDOR_STATUSES = ("Pending", "Active", "Suspended", "Draft")
VENDOR_LIST_FIELDS = [
    "name",
    "vendor_name",
    "slug",
    "status",
    "email",
    "phone",
    "user",
    "supplier",
    "customer",
    "commission_rate",
    "creation",
]


@frappe.whitelist()
def list_vendors(status=None, search=None, limit=200):
    """Vendor directory for the operator, filterable by status + free text."""
    _require_operator()
    filters = {}
    if status and status not in ("All", ""):
        filters["status"] = status
    or_filters = None
    if search:
        like = f"%{search}%"
        or_filters = [["vendor_name", "like", like], ["email", "like", like]]
    return frappe.get_all(
        "Marketplace Vendor",
        filters=filters,
        or_filters=or_filters,
        fields=VENDOR_LIST_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 200,
        ignore_permissions=True,
    )


@frappe.whitelist()
def vendor_status_counts():
    """Counts per status, for the filter tabs."""
    _require_operator()
    counts = {"All": frappe.db.count("Marketplace Vendor")}
    for status in VENDOR_STATUSES:
        counts[status] = frappe.db.count("Marketplace Vendor", {"status": status})
    return counts


@frappe.whitelist()
def set_vendor_status(name, status):
    """Approve / reject / suspend / reactivate a vendor.

    Setting the status to ``Active`` triggers ``on_update`` on the vendor, which
    idempotently provisions the linked Supplier/Customer + grants the vendor role.
    """
    _require_operator()
    if status not in VENDOR_STATUSES:
        frappe.throw(_("حالة غير صالحة."))
    vendor = frappe.get_doc("Marketplace Vendor", name)
    vendor.status = status
    vendor.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": vendor.name, "status": vendor.status}


@frappe.whitelist()
def set_vendor_commission(name, commission_rate=None):
    """Vendor-specific commission override. Empty/0 falls back to the default."""
    _require_operator()
    rate = flt(commission_rate) if commission_rate not in (None, "") else 0
    if rate < 0 or rate > 100:
        frappe.throw(_("نسبة عمولة غير صالحة."))
    vendor = frappe.get_doc("Marketplace Vendor", name)
    vendor.commission_rate = rate
    vendor.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": vendor.name, "commission_rate": vendor.commission_rate}


@frappe.whitelist()
def get_vendor(name):
    """Full vendor record for the operator detail view."""
    _require_operator()
    return frappe.get_doc("Marketplace Vendor", name).as_dict()


# ---------------------------------------------------------------------------
# Products (moderation)
# ---------------------------------------------------------------------------

PRODUCT_STATUSES = ("Pending", "Approved", "Rejected", "Draft")
PRODUCT_LIST_FIELDS = [
    "name",
    "title",
    "slug",
    "vendor",
    "approval_status",
    "published",
    "price",
    "currency",
    "stock_qty",
    "creation",
]


@frappe.whitelist()
def list_products(status=None, search=None, limit=200):
    """Product moderation queue, filterable by approval status + free text."""
    _require_operator()
    filters = {}
    if status and status not in ("All", ""):
        filters["approval_status"] = status
    or_filters = None
    if search:
        like = f"%{search}%"
        or_filters = [["title", "like", like], ["slug", "like", like]]
    rows = frappe.get_all(
        "Marketplace Product",
        filters=filters,
        or_filters=or_filters,
        fields=PRODUCT_LIST_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 200,
        ignore_permissions=True,
    )
    _attach_vendor_and_image(rows)
    return rows


@frappe.whitelist()
def product_status_counts():
    """Counts per approval status, for the filter tabs."""
    _require_operator()
    counts = {"All": frappe.db.count("Marketplace Product")}
    for status in PRODUCT_STATUSES:
        counts[status] = frappe.db.count("Marketplace Product", {"approval_status": status})
    return counts


@frappe.whitelist()
def set_product_status(name, status, rejection_reason=None):
    """Approve / reject a product. Approving triggers ``on_update`` →
    ``sync_to_erpnext`` (idempotently creates the Item + optional Website Item)."""
    _require_operator()
    if status not in PRODUCT_STATUSES:
        frappe.throw(_("حالة غير صالحة."))
    product = frappe.get_doc("Marketplace Product", name)
    product.approval_status = status
    if status == "Rejected" and rejection_reason:
        product.rejection_reason = rejection_reason
    product.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": product.name, "approval_status": product.approval_status}


def _attach_vendor_and_image(rows):
    """Enrich product rows with the vendor's display name + primary image."""
    if not rows:
        return
    vendor_ids = list({r["vendor"] for r in rows if r.get("vendor")})
    vendor_names = {}
    if vendor_ids:
        for v in frappe.get_all(
            "Marketplace Vendor",
            filters={"name": ["in", vendor_ids]},
            fields=["name", "vendor_name"],
            ignore_permissions=True,
        ):
            vendor_names[v["name"]] = v["vendor_name"]

    product_ids = [r["name"] for r in rows]
    images = {}
    media = frappe.get_all(
        "Marketplace Product Media",
        filters={"parenttype": "Marketplace Product", "parent": ["in", product_ids]},
        fields=["parent", "image"],
        order_by="is_primary desc, idx asc",
        ignore_permissions=True,
    )
    for m in media:
        images.setdefault(m["parent"], m["image"])

    for r in rows:
        r["vendor_name"] = vendor_names.get(r.get("vendor"))
        r["image"] = images.get(r["name"])


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

ORDER_STATUSES = ("Pending Payment", "Paid", "Processing", "Shipped", "Completed", "Cancelled")
ORDER_LIST_FIELDS = [
    "name",
    "customer_name",
    "phone",
    "status",
    "payment_status",
    "total",
    "currency",
    "creation",
]


@frappe.whitelist()
def list_orders(status=None, search=None, limit=200):
    """All marketplace orders for the operator, filterable by status + text."""
    _require_operator()
    filters = {}
    if status and status not in ("All", ""):
        filters["status"] = status
    or_filters = None
    if search:
        like = f"%{search}%"
        or_filters = [["customer_name", "like", like], ["name", "like", like]]
    rows = frappe.get_all(
        "Marketplace Order",
        filters=filters,
        or_filters=or_filters,
        fields=ORDER_LIST_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 200,
        ignore_permissions=True,
    )
    ids = [r["name"] for r in rows]
    item_counts = {}
    if ids:
        for row in frappe.get_all(
            "Marketplace Order Item",
            filters={"parent": ["in", ids]},
            fields=["parent"],
            ignore_permissions=True,
        ):
            item_counts[row["parent"]] = item_counts.get(row["parent"], 0) + 1
    for r in rows:
        r["item_count"] = item_counts.get(r["name"], 0)
    return rows


@frappe.whitelist()
def order_status_counts():
    """Counts per order status, for the filter tabs."""
    _require_operator()
    counts = {"All": frappe.db.count("Marketplace Order")}
    for status in ORDER_STATUSES:
        counts[status] = frappe.db.count("Marketplace Order", {"status": status})
    return counts


@frappe.whitelist()
def get_order(name):
    """Full order (items enriched with vendor name) for the detail view."""
    _require_operator()
    order = frappe.get_doc("Marketplace Order", name).as_dict()
    items = order.get("items") or []
    vendor_ids = list({it.get("vendor") for it in items if it.get("vendor")})
    vendor_names = {}
    if vendor_ids:
        for v in frappe.get_all(
            "Marketplace Vendor",
            filters={"name": ["in", vendor_ids]},
            fields=["name", "vendor_name"],
            ignore_permissions=True,
        ):
            vendor_names[v["name"]] = v["vendor_name"]
    for it in items:
        it["vendor_name"] = vendor_names.get(it.get("vendor"))
    return order


@frappe.whitelist()
def set_order_status(name, status):
    """Advance an order through its fulfilment lifecycle."""
    _require_operator()
    if status not in ORDER_STATUSES:
        frappe.throw(_("حالة غير صالحة."))
    order = frappe.get_doc("Marketplace Order", name)
    order.status = status
    order.save(ignore_permissions=True)

    # COD: a completed delivery means the courier collected the cash. Record the
    # payment so invoices + vendor settlement are booked (idempotent, best-effort
    # — a booking failure surfaces via accounting_status, not by blocking here).
    if status == "Completed" and order.payment_status != "Paid" and _is_cod(order):
        try:
            from ovira_marketplace.api.payment import record_payment

            record_payment(order.name)
        except Exception:
            frappe.log_error(title="Ovira: COD auto-capture failed")

    frappe.db.commit()
    return {"name": order.name, "status": order.status}


def _is_cod(order):
    return (order.payment_method or "").strip().lower() in ("cod", "cash on delivery")


@frappe.whitelist()
def mark_order_paid(name):
    """Record that an order's payment was collected (COD cash received, bank
    transfer confirmed, …). Books the full accounting chain — idempotent."""
    _require_operator()
    from ovira_marketplace.api.payment import record_payment

    record_payment(name)
    row = frappe.db.get_value(
        "Marketplace Order",
        name,
        ["payment_status", "accounting_status", "status"],
        as_dict=True,
    )
    return {"name": name, **row}


# ---------------------------------------------------------------------------
# Payouts — operator pays vendors their settled balance on demand
# ---------------------------------------------------------------------------


@frappe.whitelist()
def vendor_payouts():
    """Every vendor with a linked supplier and the balance the operator owes."""
    _require_operator()
    from ovira_marketplace.vendor.settlement import vendor_balances

    return vendor_balances()


@frappe.whitelist()
def pay_vendor(vendor):
    """Pay one vendor their full outstanding balance via a Payment Entry."""
    _require_operator()
    from ovira_marketplace.vendor.settlement import pay_supplier

    settings = frappe.get_cached_doc("Marketplace Settings")
    supplier = frappe.db.get_value("Marketplace Vendor", vendor, "supplier")
    if not supplier:
        frappe.throw(_("لا يوجد مورّد مرتبط بهذا البائع بعد."))

    payment_entry = pay_supplier(supplier, settings.operator_company)
    frappe.db.commit()
    if not payment_entry:
        return {"paid": False, "message": _("لا يوجد رصيد مستحق لهذا البائع.")}
    return {"paid": True, "payment_entry": payment_entry}


@frappe.whitelist()
def run_all_payouts():
    """Pay every active vendor their outstanding balance in one run."""
    _require_operator()
    from ovira_marketplace.vendor.settlement import run_due_payouts

    paid = run_due_payouts()
    return {"count": len(paid), "payment_entries": paid}


# ---------------------------------------------------------------------------
# Accounting recovery — retry orders whose post-payment booking failed
# ---------------------------------------------------------------------------


@frappe.whitelist()
def failed_accounting_orders(limit=200):
    """Paid orders whose invoice/settlement booking failed and needs a retry."""
    _require_operator()
    return frappe.get_all(
        "Marketplace Order",
        filters={"accounting_status": "Failed"},
        fields=["name", "customer_name", "total", "currency", "creation", "accounting_error"],
        order_by="creation desc",
        limit_page_length=cint(limit) or 200,
        ignore_permissions=True,
    )


@frappe.whitelist()
def retry_order_accounting(order):
    """Re-run the post-payment booking for one order (idempotent)."""
    _require_operator()
    from ovira_marketplace.api.payment import book_order_accounting

    ok = book_order_accounting(order)
    frappe.db.commit()
    status = frappe.db.get_value("Marketplace Order", order, "accounting_status")
    return {"order": order, "ok": ok, "accounting_status": status}


# ---------------------------------------------------------------------------
# Payment gateways & shipping providers — configured from the branded admin
# ---------------------------------------------------------------------------

PAYMENT_PROVIDERS = ("Cash on Delivery", "Paymob", "Fawry", "Stripe")
PAYMENT_SECRET_FIELDS = ("api_key", "secret_key", "hmac_secret")
PAYMENT_PLAIN_FIELDS = ("mode", "public_key", "integration_id", "iframe_id")

SHIPPING_PROVIDERS = ("Manual", "Bosta", "Aramex", "Mylerz")
SHIPPING_SECRET_FIELDS = ("api_key", "api_secret")
SHIPPING_PLAIN_FIELDS = ("mode", "account_number", "base_url")
SHIPPING_NUMERIC_FIELDS = ("flat_rate", "free_over")


def _connector_row(doctype, provider, plain, secrets, numeric=()):
    """One provider's config state. Secrets are never echoed — only whether set."""
    name = frappe.db.get_value(doctype, {"provider": provider}, "name")
    doc = frappe.get_doc(doctype, name) if name else None
    row = {
        "provider": provider,
        "configured": bool(doc),
        "enabled": bool(doc.enabled) if doc else False,
    }
    for f in plain + tuple(numeric):
        row[f] = doc.get(f) if doc else None
    for f in secrets:
        row[f"has_{f}"] = bool(doc and doc.get_password(f, raise_exception=False))
    return row


def _update_connector(doctype, provider, enabled, kwargs, plain, secrets, numeric=()):
    """Create/update a provider config. Secret fields are only overwritten when a
    non-empty value arrives, so the UI can submit placeholders untouched."""
    name = frappe.db.get_value(doctype, {"provider": provider}, "name")
    doc = frappe.get_doc(doctype, name) if name else frappe.new_doc(doctype)
    doc.provider = provider
    if enabled is not None:
        doc.enabled = cint(enabled)
    for f in plain:
        if kwargs.get(f) is not None:
            doc.set(f, kwargs[f] or None)
    for f in numeric:
        if kwargs.get(f) is not None:
            doc.set(f, flt(kwargs[f]))
    for f in secrets:
        if kwargs.get(f):
            doc.set(f, kwargs[f])
    doc.flags.ignore_permissions = True
    if name:
        doc.save(ignore_permissions=True)
    else:
        doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc


@frappe.whitelist()
def list_payment_connectors():
    """Every payment gateway with its config state (secrets masked)."""
    _require_operator()
    return [
        _connector_row("Payment Connector", p, PAYMENT_PLAIN_FIELDS, PAYMENT_SECRET_FIELDS)
        for p in PAYMENT_PROVIDERS
    ]


@frappe.whitelist()
def update_payment_connector(provider, enabled=None, **kwargs):
    """Enable/disable a gateway and store its credentials."""
    _require_operator()
    if provider not in PAYMENT_PROVIDERS:
        frappe.throw(_("مزوّد دفع غير معروف."))
    doc = _update_connector(
        "Payment Connector", provider, enabled, kwargs, PAYMENT_PLAIN_FIELDS, PAYMENT_SECRET_FIELDS
    )
    return _connector_row("Payment Connector", doc.provider, PAYMENT_PLAIN_FIELDS, PAYMENT_SECRET_FIELDS)


@frappe.whitelist()
def list_shipping_providers():
    """Every shipping provider with its config state (secrets masked)."""
    _require_operator()
    return [
        _connector_row(
            "Shipping Provider", p, SHIPPING_PLAIN_FIELDS, SHIPPING_SECRET_FIELDS, SHIPPING_NUMERIC_FIELDS
        )
        for p in SHIPPING_PROVIDERS
    ]


@frappe.whitelist()
def update_shipping_provider(provider, enabled=None, **kwargs):
    """Enable/disable a shipping provider and store rates + credentials."""
    _require_operator()
    if provider not in SHIPPING_PROVIDERS:
        frappe.throw(_("شركة شحن غير معروفة."))
    doc = _update_connector(
        "Shipping Provider",
        provider,
        enabled,
        kwargs,
        SHIPPING_PLAIN_FIELDS,
        SHIPPING_SECRET_FIELDS,
        SHIPPING_NUMERIC_FIELDS,
    )
    return _connector_row(
        "Shipping Provider", doc.provider, SHIPPING_PLAIN_FIELDS, SHIPPING_SECRET_FIELDS, SHIPPING_NUMERIC_FIELDS
    )

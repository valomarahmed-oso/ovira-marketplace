"""ERPNext stock movement for inventory-tracked marketplace products.

Only products with ``track_inventory`` on take part: their declared stock is
received into a warehouse as opening stock, and a Delivery Note draws it down
when the order **ships** (Amazon-style — stock leaves the warehouse at dispatch).
Products without tracking keep the lightweight manual stock model (the
marketplace ``stock_qty`` decremented at order time — see ``api/checkout``).

Everything here is best-effort: a stock hiccup must never block a product save
or an order's status change.
"""

import frappe
from frappe.utils import flt


def resolve_warehouse(settings=None, company=None):
    """Warehouse tracked stock lives in: the configured default, else any
    non-group warehouse of the operator company. None if none exists."""
    settings = settings or frappe.get_cached_doc("Marketplace Settings")
    company = company or settings.operator_company
    return settings.get("default_warehouse") or frappe.db.get_value(
        "Warehouse", {"company": company, "is_group": 0}, "name"
    )


def item_bin_qty(item_code, warehouse=None):
    """Total actual ERPNext stock for an item (optionally in one warehouse)."""
    filters = {"item_code": item_code}
    if warehouse:
        filters["warehouse"] = warehouse
    return sum(flt(q) for q in frappe.get_all("Bin", filters=filters, pluck="actual_qty"))


def ensure_opening_stock(product):
    """Receive a tracked product's declared stock into the warehouse **once**, as
    a Material Receipt, when ERPNext holds none for it yet. After that ERPNext is
    the source of truth (deliveries draw it down; ``refresh_stock`` mirrors it
    back to the marketplace number)."""
    if not product.get("track_inventory") or not product.get("item"):
        return
    if not frappe.db.get_value("Item", product.item, "is_stock_item"):
        return
    qty = flt(product.get("stock_qty"))
    if qty <= 0:
        return
    settings = frappe.get_cached_doc("Marketplace Settings")
    warehouse = resolve_warehouse(settings)
    if not warehouse or item_bin_qty(product.item) > 0:
        return  # no warehouse, or already stocked — don't double-load
    try:
        se = frappe.new_doc("Stock Entry")
        se.stock_entry_type = "Material Receipt"
        se.company = settings.operator_company
        se.append(
            "items",
            {
                "item_code": product.item,
                "qty": qty,
                "t_warehouse": warehouse,
                "basic_rate": flt(product.get("price")),
            },
        )
        se.flags.ignore_permissions = True
        se.insert()
        se.submit()
    except Exception:
        frappe.log_error(title="Ovira: opening stock receipt failed")


def deliver_order(order):
    """Create + submit a Delivery Note per vendor Sales Order for the order's
    **stock** items, drawing them from the warehouse. Called when the order
    ships. Idempotent per Sales Order; best-effort per sub-order."""
    settings = frappe.get_cached_doc("Marketplace Settings")
    warehouse = resolve_warehouse(settings)
    if not warehouse:
        return
    for so_name in {r.sales_order for r in order.items if r.sales_order}:
        try:
            _deliver_sales_order(so_name, warehouse)
        except Exception:
            frappe.log_error(title="Ovira: delivery note failed")


def _deliver_sales_order(so_name, warehouse):
    if frappe.db.exists("Delivery Note Item", {"against_sales_order": so_name, "docstatus": 1}):
        return  # already delivered
    from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note

    dn = make_delivery_note(so_name)
    # Keep only stock items — a Delivery Note line for a non-stock item moves no
    # stock, so there's nothing to deliver for it here.
    kept = []
    for it in dn.items:
        if frappe.db.get_value("Item", it.item_code, "is_stock_item"):
            it.warehouse = warehouse
            kept.append(it)
    if not kept:
        return
    dn.set("items", kept)
    dn.flags.ignore_permissions = True
    dn.insert()
    dn.submit()

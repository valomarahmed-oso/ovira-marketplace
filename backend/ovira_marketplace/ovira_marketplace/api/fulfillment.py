"""Multi-warehouse / multi-company fulfilment routing.

A product can carry per-branch stock (Marketplace Product Warehouse rows). When
it does, the storefront shows the SUM as availability, and each order line is
routed at checkout to a single branch that can fulfil it — preferring the branch
serving the buyer's governorate, then priority, then most stock. The chosen
branch's company + warehouse are recorded on the order line so the Sales Order is
booked under the right company and ships from the right warehouse.
"""

import frappe
from frappe.utils import cint, flt

CHILD = "Marketplace Product Warehouse"


def _locations(product_name):
    return frappe.get_all(
        CHILD,
        filters={"parent": product_name, "parenttype": "Marketplace Product"},
        fields=["name", "company", "warehouse", "governorate", "stock_qty", "priority"],
        ignore_permissions=True,
    )


def has_stock_locations(product_name):
    return bool(
        frappe.db.exists(CHILD, {"parent": product_name, "parenttype": "Marketplace Product"})
    )


def total_location_stock(product_name):
    return sum(flt(r.stock_qty) for r in _locations(product_name))


def route_line(product_name, qty, governorate=None):
    """Pick the branch row to fulfil `qty`, or None if no single branch has
    enough. Preference: governorate match → lowest priority → most stock."""
    qty = cint(qty) or 1
    gov = (governorate or "").strip()
    candidates = [r for r in _locations(product_name) if flt(r.stock_qty) >= qty]
    if not candidates:
        return None
    candidates.sort(
        key=lambda r: (
            0 if (gov and (r.governorate or "").strip() == gov) else 1,
            cint(r.priority),
            -flt(r.stock_qty),
        )
    )
    return candidates[0]


def adjust_location_stock(product_name, warehouse, delta):
    """Shift a branch row's stock by delta (floored at 0), then re-sum the
    product's headline stock_qty from all its branches."""
    if not warehouse or not delta:
        return
    name = frappe.db.get_value(
        CHILD,
        {"parent": product_name, "parenttype": "Marketplace Product", "warehouse": warehouse},
        "name",
    )
    if not name:
        return
    cur = flt(frappe.db.get_value(CHILD, name, "stock_qty"))
    frappe.db.set_value(CHILD, name, "stock_qty", max(0.0, cur + delta), update_modified=False)
    frappe.db.set_value(
        "Marketplace Product",
        product_name,
        "stock_qty",
        total_location_stock(product_name),
        update_modified=False,
    )

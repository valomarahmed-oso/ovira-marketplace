"""Keeping ERPNext stock equal to what the storefront promises.

**Direction of truth.** For a product with ``track_inventory`` on, the number the
vendor types on the product screen — and the per-branch rows under it — is the
master. ERPNext is brought into line with it. The one exception is a receipt the
operator books deliberately (`restock_product` → Purchase Receipt / Material
Receipt): that starts in ERPNext, and the marketplace number is pulled back from
it afterwards. Products without tracking use the lightweight manual model and
never touch a warehouse at all.

**Why this file was rewritten.** The old version seeded a product's declared
stock into ONE warehouse exactly once, guarded by "does ERPNext already hold any
of this item?". After that guard closed, nothing ever topped ERPNext up again:
an item that first appeared with 1 unit stayed at 1 in the ledger while the
storefront sold 98. The per-branch table was worse — it never reached ERPNext at
all, so an order routed to a branch produced a Sales Order against a warehouse
holding zero, and no Delivery Note could ever be made from it.

**The invariant.** For every (item, warehouse):

    ERPNext actual_qty − reserved_qty  ==  what the storefront offers

`reserved_qty` is on the right-hand side because a submitted Sales Order already
holds those units: the storefront decrements at order time, ERPNext removes them
at dispatch, and `projected_qty` is the figure the two models agree on in
between. Syncing against `actual_qty` alone would re-introduce the difference on
every open order.

Everything here is best-effort per product: a stock hiccup must never block a
product save or an order's status change, but it IS recorded, and
`stock_mismatches()` lists whatever fell through.
"""

import frappe
from frappe.utils import flt

CHILD = "Marketplace Product Warehouse"


def resolve_warehouse(settings=None, company=None):
    """Warehouse untracked-by-branch stock lives in: the configured default, else
    any non-group warehouse of the operator company. None if none exists."""
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


def _bins(item_code):
    """{warehouse: {"actual": x, "reserved": y}} for every warehouse holding a row."""
    rows = frappe.get_all(
        "Bin",
        filters={"item_code": item_code},
        fields=["warehouse", "actual_qty", "reserved_qty"],
        ignore_permissions=True,
    )
    return {
        r["warehouse"]: {"actual": flt(r["actual_qty"]), "reserved": flt(r["reserved_qty"])}
        for r in rows
    }


def _branch_rows(product_name):
    return frappe.get_all(
        CHILD,
        filters={"parent": product_name, "parenttype": "Marketplace Product"},
        fields=["company", "warehouse", "stock_qty"],
        ignore_permissions=True,
    )


def desired_distribution(product):
    """{warehouse: units the storefront offers there} for a tracked product.

    Per-branch rows when the product has them — that table is the whole point of
    multi-warehouse routing, and until now it existed only inside the
    marketplace. Otherwise the whole quantity sits in the default warehouse.
    """
    rows = _branch_rows(product.name)
    if rows:
        wanted = {}
        for r in rows:
            if r.get("warehouse"):
                wanted[r["warehouse"]] = wanted.get(r["warehouse"], 0.0) + flt(r.get("stock_qty"))
        return wanted
    warehouse = resolve_warehouse()
    return {warehouse: flt(product.get("stock_qty"))} if warehouse else {}


def reconciliation_targets(wanted, bins):
    """[(warehouse, target actual_qty)] for every warehouse that needs moving.

    `wanted` is {warehouse: units the storefront offers}; `bins` is
    {warehouse: {"actual", "reserved"}} as ERPNext holds it today.

    Two rules, and both were bugs before:

    * **Target = offered + reserved.** Reserved units belong to submitted Sales
      Orders that haven't shipped. The storefront already deducted them and
      ERPNext removes them at dispatch, so ERPNext must still be carrying them —
      setting `actual` to the offered figure would delete an open order's stock.
    * **Warehouses ERPNext holds but the storefront no longer names are included**
      with a target that empties them. A deleted branch row otherwise leaves
      stock stranded in a warehouse nothing sells from.

    Warehouses already at their target are omitted, so a save that changes
    nothing posts nothing.
    """
    out = []
    for warehouse in sorted(set(wanted) | set(bins)):
        current = bins.get(warehouse) or {"actual": 0.0, "reserved": 0.0}
        target = flt(wanted.get(warehouse, 0.0)) + flt(current.get("reserved"))
        if abs(target - flt(current.get("actual"))) < 0.001:
            continue
        out.append((warehouse, target))
    return out


def _valuation_rate(item_code, warehouse, fallback):
    existing = frappe.db.get_value(
        "Bin", {"item_code": item_code, "warehouse": warehouse}, "valuation_rate"
    )
    return flt(existing) or flt(fallback) or 0.0


def sync_product_stock(product):
    """Bring ERPNext's per-warehouse quantities in line with the storefront.

    Uses a **Stock Reconciliation**, which sets an absolute quantity per
    warehouse rather than adding a delta — so it is idempotent, corrects drift in
    either direction, and moves several branches in one document. Only warehouses
    that actually differ are included, so a save that changes nothing posts
    nothing.
    """
    if not product.get("track_inventory") or not product.get("item"):
        return None
    item = product.item
    row = frappe.db.get_value("Item", item, ["is_stock_item", "disabled"], as_dict=True)
    if not row or not row.is_stock_item:
        return None
    # A disabled Item is deliberately out of the stock system — ERPNext refuses to
    # reconcile it ("Item … is disabled"), and one such product used to abort the
    # whole nightly sweep with a traceback. `stock_mismatches` still reports it,
    # flagged, so it stays visible instead of silently skipped.
    if row.disabled:
        return None

    settings = frappe.get_cached_doc("Marketplace Settings")
    wanted = desired_distribution(product)
    if not wanted:
        return None
    bins = _bins(item)

    lines = [
        {
            "item_code": item,
            "warehouse": warehouse,
            "qty": qty,
            "valuation_rate": _valuation_rate(item, warehouse, product.get("price")),
        }
        for warehouse, qty in reconciliation_targets(wanted, bins)
    ]
    if not lines:
        return None
    try:
        sr = frappe.new_doc("Stock Reconciliation")
        sr.company = settings.operator_company
        sr.purpose = "Stock Reconciliation"
        for line in lines:
            sr.append("items", line)
        sr.flags.ignore_permissions = True
        sr.insert()
        sr.submit()
        return sr.name
    except Exception:
        # ERPNext now disagrees with what the shop is selling. The nightly sweep
        # will try again and `stock_health` lists it meanwhile, but it is
        # recorded as deferred so "why is this product drifting" has an answer
        # that predates someone noticing the drift.
        from ovira_marketplace.failures import DEFERRABLE, guard

        with guard("stock sync", DEFERRABLE, ref=product.name):
            raise
        return None


# Kept under its old name so existing callers keep working; the behaviour is now
# "make ERPNext match", not "seed once and never look again".
ensure_opening_stock = sync_product_stock


def receive_stock(item_code, qty, warehouse=None, rate=0.0, supplier=None):
    """Add ``qty`` of an item into the warehouse. With a supplier → a **Purchase
    Receipt** (procurement: books the goods and a payable to that supplier);
    otherwise a **Material Receipt** Stock Entry (a plain stock top-up, no
    payable — right for consignment/marketplace stock). Returns the voucher name."""
    settings = frappe.get_cached_doc("Marketplace Settings")
    company = settings.operator_company
    warehouse = warehouse or resolve_warehouse(settings, company)
    if not warehouse or flt(qty) <= 0:
        return None
    if supplier:
        pr = frappe.new_doc("Purchase Receipt")
        pr.company = company
        pr.supplier = supplier
        pr.append(
            "items",
            {"item_code": item_code, "qty": flt(qty), "warehouse": warehouse, "rate": flt(rate)},
        )
        pr.flags.ignore_permissions = True
        pr.insert()
        pr.submit()
        return pr.name
    se = frappe.new_doc("Stock Entry")
    se.stock_entry_type = "Material Receipt"
    se.company = company
    se.append(
        "items",
        {"item_code": item_code, "qty": flt(qty), "t_warehouse": warehouse, "basic_rate": flt(rate)},
    )
    se.flags.ignore_permissions = True
    se.insert()
    se.submit()
    return se.name


def deliver_order(order):
    """Create + submit a Delivery Note per vendor Sales Order for the order's
    **stock** items, drawing them from the warehouse. Called when the order
    ships. Idempotent per Sales Order; best-effort per sub-order."""
    for so_name in {r.sales_order for r in order.items if r.sales_order}:
        try:
            _deliver_sales_order(so_name)
        except Exception:
            frappe.log_error(title="Ovira: delivery note failed")


def _deliver_sales_order(so_name):
    if frappe.db.exists("Delivery Note Item", {"against_sales_order": so_name, "docstatus": 1}):
        return  # already delivered
    if not frappe.db.exists("Sales Order", so_name):
        return  # nothing to deliver against — see payment.book_order_accounting
    from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note

    dn = make_delivery_note(so_name)
    fallback = resolve_warehouse()
    # Keep only stock items — a Delivery Note line for a non-stock item moves no
    # stock, so there's nothing to deliver for it here.
    kept = []
    for it in dn.items:
        if not frappe.db.get_value("Item", it.item_code, "is_stock_item"):
            continue
        # Ship from the warehouse the ORDER was routed to. Overwriting this with
        # the store default (what the old code did) drew every branch's sales out
        # of one warehouse, so a correctly routed order still emptied the wrong
        # shelf — and failed outright once that shelf ran dry.
        if not it.warehouse:
            it.warehouse = fallback
        kept.append(it)
    if not kept:
        return
    dn.set("items", kept)
    dn.flags.ignore_permissions = True
    dn.insert()
    dn.submit()


# -- health ------------------------------------------------------------------


def stock_mismatches(limit=200):
    """Every tracked product whose ERPNext stock disagrees with the storefront.

    The reconciliation runs on save, so a healthy store returns an empty list.
    A row here means a sync was refused or failed — the question "why is the
    ledger saying something different from the shop?" now has an answer that
    doesn't require reading two systems by hand.
    """
    out = []
    products = frappe.get_all(
        "Marketplace Product",
        filters={"track_inventory": 1},
        fields=["name", "title", "item", "stock_qty", "price"],
        limit_page_length=0,
        ignore_permissions=True,
    )
    for p in products:
        if not p.item:
            continue
        item = frappe.db.get_value("Item", p.item, ["is_stock_item", "disabled"], as_dict=True)
        if not item or not item.is_stock_item:
            continue
        wanted = desired_distribution(p)
        bins = _bins(p.item)
        rows = []
        for warehouse in set(wanted) | set(bins):
            current = bins.get(warehouse) or {"actual": 0.0, "reserved": 0.0}
            available = current["actual"] - current["reserved"]
            expected = flt(wanted.get(warehouse, 0.0))
            if abs(available - expected) >= 0.001:
                rows.append(
                    {
                        "warehouse": warehouse,
                        "storefront": expected,
                        "erpnext_available": available,
                        "erpnext_actual": current["actual"],
                        "reserved": current["reserved"],
                    }
                )
        if rows:
            out.append(
                {
                    "product": p.name,
                    "title": p.title,
                    "item": p.item,
                    "stock_qty": flt(p.stock_qty),
                    "warehouses": rows,
                    # Why a re-sync won't clear this one, when that's the case.
                    "blocked": "item disabled" if item.disabled else None,
                }
            )
        if len(out) >= (limit or 200):
            break
    return out


def reconcile_all_products():
    """Daily sweep: push any drifted product back into line. Cheap when healthy —
    `sync_product_stock` posts nothing when every warehouse already agrees."""
    for row in stock_mismatches():
        if row.get("blocked"):
            continue   # nothing a sync can do — reported, not retried forever
        try:
            product = frappe.get_doc("Marketplace Product", row["product"])
            sync_product_stock(product)
        except Exception:
            frappe.log_error(title="Ovira: nightly stock reconcile failed")
    frappe.db.commit()

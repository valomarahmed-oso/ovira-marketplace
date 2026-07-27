"""Scheduled notifications — the ones nothing in the app "does" to trigger them.

A review request isn't caused by an action; it's caused by time passing after a
delivery. Low stock isn't an event either — it's a condition someone should be
told about once a day, not the instant a counter crosses a line.

Both are deliberately batched: one message per vendor per day beats one per
product, and one review request per order beats one per item.
"""

import frappe
from frappe.utils import add_to_date, cint, flt, nowdate

from ovira_marketplace.notifications.dispatch import emit

# How long after delivery to ask for a review: long enough that the customer has
# actually used the thing, short enough that they still remember buying it.
REVIEW_AFTER_DAYS = 3
REVIEW_WINDOW_DAYS = 10   # don't chase orders older than this on a first run

LOW_STOCK_THRESHOLD = 3
LOW_STOCK_LIST = 8        # how many product names to name before "and N more"


def request_reviews():
    """Daily: ask for a review on orders delivered a few days ago.

    The outbox's dedupe key makes this idempotent per order, so a re-run — or a
    day the scheduler fires twice — cannot nag the same customer again.
    """
    until = add_to_date(nowdate(), days=-REVIEW_AFTER_DAYS)
    since = add_to_date(nowdate(), days=-REVIEW_WINDOW_DAYS)
    orders = frappe.get_all(
        "Marketplace Order",
        filters=[["status", "=", "Completed"], ["modified", "<=", until],
                 ["modified", ">=", since]],
        fields=["name", "email", "phone", "customer_name"],
        limit_page_length=200, ignore_permissions=True,
    )
    for order in orders:
        if not order.get("email"):
            continue
        emit("review.request", {
            "order": order["name"], "email": order["email"],
            "phone": order.get("phone"), "customer_name": order.get("customer_name") or "",
            "kind": "promo",
        }, reference={"doctype": "Marketplace Order", "name": order["name"]})


def warn_low_stock():
    """Daily: one digest per vendor listing what's about to run out.

    A message per product would be the fastest way to teach a vendor to ignore
    the channel entirely.
    """
    threshold = LOW_STOCK_THRESHOLD
    try:
        settings = frappe.get_cached_doc("Marketplace Settings")
        threshold = cint(settings.get("low_stock_threshold")) or LOW_STOCK_THRESHOLD
    except Exception:
        pass

    rows = frappe.get_all(
        "Marketplace Product",
        filters=[["track_inventory", "=", 1], ["published", "=", 1],
                 ["approval_status", "=", "Approved"],
                 ["stock_qty", "<=", threshold], ["vendor", "is", "set"]],
        fields=["name", "title", "vendor", "stock_qty"],
        limit_page_length=1000, ignore_permissions=True,
    )
    by_vendor = {}
    for r in rows:
        by_vendor.setdefault(r["vendor"], []).append(r)

    # One reference per vendor per DAY: the dedupe key then allows tomorrow's
    # digest through while still collapsing a double run today.
    stamp = nowdate()
    for vendor, items in by_vendor.items():
        names = ["{0} ({1})".format(i["title"], int(flt(i["stock_qty"]))) for i in items[:LOW_STOCK_LIST]]
        more = len(items) - len(names)
        if more > 0:
            names.append("… +{0}".format(more))
        emit("vendor.low_stock", {
            "count": len(items), "threshold": threshold,
            "products": "، ".join(names), "vendors": [vendor], "kind": "system",
        }, reference={"doctype": "Marketplace Vendor", "name": "{0}::{1}".format(vendor, stamp)})

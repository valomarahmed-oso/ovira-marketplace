"""Scheduled notifications — the ones nothing in the app "does" to trigger them.

A review request isn't caused by an action; it's caused by time passing after a
delivery. Low stock isn't an event either — it's a condition someone should be
told about once a day, not the instant a counter crosses a line.

Both are deliberately batched: one message per vendor per day beats one per
product, and one review request per order beats one per item.
"""

import json

import frappe
from frappe.utils import add_to_date, cint, flt, now_datetime, nowdate

from ovira_marketplace.notifications.dispatch import emit

# How long after delivery to ask for a review: long enough that the customer has
# actually used the thing, short enough that they still remember buying it.
REVIEW_AFTER_DAYS = 3
REVIEW_WINDOW_DAYS = 10   # don't chase orders older than this on a first run

LOW_STOCK_THRESHOLD = 3
LOW_STOCK_LIST = 8        # how many product names to name before "and N more"

# A price drop worth interrupting someone for. Below this it's rounding, and a
# store that messages on every 1% wobble trains people to mute it.
MIN_DROP_PERCENT = 5
WATCH_DT = "Marketplace Price Watch"


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


def watch_price_drops():
    """Daily: tell shoppers when something on their wishlist got cheaper.

    The baseline is one number per (shopper, product) — `Marketplace Price Watch` —
    not a price history: the only question is "cheaper than when they last looked?".
    A first sighting records the price silently; nobody wants a notification for a
    product they just saved.

    Two guards keep this from becoming noise: a drop must clear MIN_DROP_PERCENT,
    and it must beat the price we last announced, so a slow slide down doesn't
    generate a message every single day.
    """
    lists = frappe.get_all(
        "Marketplace Wishlist", fields=["name", "data"],
        limit_page_length=2000, ignore_permissions=True,
    )
    if not lists:
        return

    # slug -> (name, title, price) for everything currently wishlisted anywhere
    wanted = {}
    parsed = []
    for row in lists:
        try:
            items = json.loads(row.get("data") or "[]")
        except (ValueError, TypeError):
            continue
        slugs = [i.get("slug") for i in items if isinstance(i, dict) and i.get("slug")]
        if not slugs:
            continue
        parsed.append((row["name"], slugs))
        for s in slugs:
            wanted[s] = None
    if not wanted:
        return

    for p in frappe.get_all(
        "Marketplace Product", filters={"slug": ["in", list(wanted.keys())]},
        fields=["name", "slug", "title", "price", "currency"],
        limit_page_length=0, ignore_permissions=True,
    ):
        wanted[p["slug"]] = p

    for recipient, slugs in parsed:
        for slug in slugs:
            product = wanted.get(slug)
            if not product or flt(product["price"]) <= 0:
                continue
            _check_one_price(recipient, product)


def _check_one_price(recipient, product):
    price = flt(product["price"])
    name = "{0}::{1}".format(recipient, product["name"])
    watch = frappe.db.get_value(
        WATCH_DT, name, ["last_price", "last_notified_price"], as_dict=True)

    if not watch:
        # First sighting: record the baseline, say nothing.
        frappe.get_doc({
            "doctype": WATCH_DT, "recipient": recipient, "product": product["name"],
            "last_price": price,
        }).insert(ignore_permissions=True)
        return

    baseline = flt(watch.get("last_price"))
    if baseline <= 0 or price >= baseline:
        # Same or higher: re-baseline so the NEXT drop is measured from here.
        frappe.db.set_value(WATCH_DT, name, "last_price", price, update_modified=False)
        return

    drop_percent = (baseline - price) / baseline * 100
    already_told = flt(watch.get("last_notified_price"))
    if drop_percent < MIN_DROP_PERCENT or (already_told and price >= already_told):
        frappe.db.set_value(WATCH_DT, name, "last_price", price, update_modified=False)
        return

    currency = product.get("currency") or ""
    emit("price.drop", {
        "product": product.get("title") or product["name"],
        "total": frappe.utils.fmt_money(price, currency=currency),
        "old_price": frappe.utils.fmt_money(baseline, currency=currency),
        "currency": currency, "email": recipient, "kind": "promo",
    }, recipients=[{"user": recipient, "email": recipient, "phone": None,
                    "lang": None, "kind": "promo"}],
       reference={"doctype": "Marketplace Product",
                  "name": "{0}::{1}".format(product["name"], nowdate())})

    frappe.db.set_value(WATCH_DT, name, {
        "last_price": price, "last_notified_price": price,
        "last_notified_on": now_datetime(),
    }, update_modified=False)

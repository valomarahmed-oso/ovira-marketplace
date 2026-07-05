"""Vendor trust score.

A single 0–5 reputation score per vendor, blended from three signals we already
capture: buyer ratings (heaviest), fulfilment rate (orders that shipped or
completed), and return rate (inverted). The score + a coarse tier are cached on
the Marketplace Vendor for cheap display on product cards; `vendor_trust` also
computes it live for a store/PDP view. Recomputed daily (scheduler) — see
hooks.py.
"""

import frappe
from frappe import _
from frappe.utils import cint, flt

# Orders that count as successfully fulfilled vs. the whole decided pipeline.
FULFILLED_STATUSES = ("Shipped", "Completed")
DECIDED_STATUSES = ("Paid", "Processing", "Shipped", "Completed", "Cancelled")

TIERS = ("new", "rising", "trusted", "top")


def _vendor_name(vendor):
    """Resolve a vendor by docname or slug."""
    if not vendor:
        return None
    if frappe.db.exists("Marketplace Vendor", vendor):
        return vendor
    return frappe.db.get_value("Marketplace Vendor", {"slug": vendor}, "name")


def _rating_stats(vendor):
    row = frappe.db.sql(
        """
        select avg(r.rating) as avg_rating, count(*) as cnt
        from `tabMarketplace Review` r
        join `tabMarketplace Product` p on p.name = r.product
        where p.vendor = %s and r.status = 'Published'
        """,
        (vendor,),
        as_dict=True,
    )
    avg = flt(row[0].avg_rating) if row and row[0].avg_rating is not None else 0.0
    return round(avg, 2), cint(row[0].cnt) if row else 0


def _order_stats(vendor):
    rows = frappe.db.sql(
        """
        select o.status as status, count(distinct o.name) as cnt
        from `tabMarketplace Order` o
        join `tabMarketplace Order Item` oi on oi.parent = o.name
        where oi.vendor = %s
        group by o.status
        """,
        (vendor,),
        as_dict=True,
    )
    by_status = {r.status: cint(r.cnt) for r in rows}
    decided = sum(by_status.get(s, 0) for s in DECIDED_STATUSES)
    fulfilled = sum(by_status.get(s, 0) for s in FULFILLED_STATUSES)
    delivered = by_status.get("Completed", 0)
    total = sum(by_status.values())
    return total, decided, fulfilled, delivered


def _return_count(vendor):
    row = frappe.db.sql(
        """
        select count(distinct rt.name) as cnt
        from `tabMarketplace Return` rt
        join `tabMarketplace Order Item` oi on oi.parent = rt.marketplace_order
        where oi.vendor = %s
        """,
        (vendor,),
        as_dict=True,
    )
    return cint(row[0].cnt) if row else 0


def _tier(score, orders_count, ratings_count):
    """Coarse label. A store with almost no history is 'new' regardless of a
    high score off one review, so the badge can't be gamed on day one."""
    if orders_count < 3 and ratings_count < 2:
        return "new"
    if score >= 4.5:
        return "top"
    if score >= 4.0:
        return "trusted"
    if score >= 3.0:
        return "rising"
    return "new"


def compute_vendor_trust(vendor):
    """Live-compute the trust breakdown for a resolved vendor docname."""
    rating, ratings_count = _rating_stats(vendor)
    total, decided, fulfilled, delivered = _order_stats(vendor)
    returns = _return_count(vendor)

    fulfillment_rate = round(fulfilled / decided, 3) if decided else None
    return_rate = round(returns / delivered, 3) if delivered else 0.0

    # Weighted blend of whatever signals exist. Rating dominates but its weight
    # ramps with review volume so one 5-star review doesn't crown a store.
    signals, weights = [], []
    if ratings_count > 0:
        signals.append(rating)
        weights.append(1.0 + min(ratings_count, 20) / 20 * 2.0)
    if decided > 0:
        signals.append(fulfillment_rate * 5)
        weights.append(1.5)
        signals.append(max(0.0, 1.0 - return_rate) * 5)
        weights.append(1.0)

    score = round(sum(s * w for s, w in zip(signals, weights)) / sum(weights), 2) if signals else 0.0
    tier = _tier(score, total, ratings_count)

    return {
        "score": score,
        "tier": tier,
        "rating": rating,
        "ratings_count": ratings_count,
        "orders": total,
        "delivered": delivered,
        "fulfillment_rate": fulfillment_rate,
        "return_rate": return_rate,
    }


def recompute_vendor_trust(vendor):
    """Compute + cache the score/tier on the Marketplace Vendor. Returns the
    breakdown. Safe to call from events or the scheduler."""
    name = _vendor_name(vendor)
    if not name:
        return None
    data = compute_vendor_trust(name)
    frappe.db.set_value(
        "Marketplace Vendor",
        name,
        {
            "rating": data["rating"],
            "ratings_count": data["ratings_count"],
            "trust_score": data["score"],
            "trust_tier": data["tier"],
            "orders_count": data["orders"],
        },
        update_modified=False,
    )
    return data


def recompute_all_vendor_trust():
    """Daily scheduler: refresh the cached trust score for every live vendor."""
    for name in frappe.get_all(
        "Marketplace Vendor",
        filters={"status": ["in", ["Active", "Pending"]]},
        pluck="name",
    ):
        try:
            recompute_vendor_trust(name)
        except Exception:
            frappe.log_error(title=f"Ovira: trust recompute failed for {name}")
    frappe.db.commit()


@frappe.whitelist(allow_guest=True)
def vendor_trust(vendor):
    """Public trust breakdown for a vendor (docname or slug)."""
    name = _vendor_name(vendor)
    if not name:
        return None
    data = compute_vendor_trust(name)
    data["vendor"] = name
    data["vendor_name"] = frappe.db.get_value("Marketplace Vendor", name, "vendor_name")
    return data

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
# Cancelled is deliberately NOT here. It used to be, which meant an order the
# BUYER cancelled counted against the seller's fulfilment rate — a store could
# ship everything it was ever asked to ship and still read 73%. A cancellation is
# only the vendor's failure when the vendor caused it, and nothing in the data
# says which is which, so it stays out of the denominator entirely.
DECIDED_STATUSES = ("Paid", "Processing", "Shipped", "Completed")

# A return is opened against an order that REACHED the buyer, which is Shipped or
# Completed — not Completed alone. Dividing by the smaller number inflated every
# store's return rate.
RECEIVED_STATUSES = ("Shipped", "Completed")

TIERS = ("new", "rising", "trusted", "top")


def _vendor_name(vendor):
    """Resolve a vendor by docname or slug."""
    if not vendor:
        return None
    if frappe.db.exists("Marketplace Vendor", vendor):
        return vendor
    return frappe.db.get_value("Marketplace Vendor", {"slug": vendor}, "name")


def _rating_stats(vendor):
    """Average rating and review count across ALL of this vendor's products.

    Two exclusions, both of which the score is worthless without:

    * **Store staff.** One operator account leaving a five-star review is not a
      signal of anything, and a trust score is exactly the number that must not
      be self-issued.
    * **Unverified purchases.** A review from someone with no paid order for the
      product costs nothing to write, in either direction — it is the cheapest
      way to inflate your own store or attack a competitor's. Those reviews still
      appear on the product page (a shopper can see they're unverified and weigh
      them); they just don't move a reputation number.

    A store whose only reviews are unverified therefore scores on its ORDER
    record alone, which is the honest answer rather than a flattering one.
    """
    row = frappe.db.sql(
        """
        select avg(r.rating) as avg_rating, count(*) as cnt
        from `tabMarketplace Review` r
        join `tabMarketplace Product` p on p.name = r.product
        where p.vendor = %s and r.status = 'Published'
          and ifnull(r.verified_purchase, 0) = 1
          and ifnull(r.owner,'') not in %s
        """,
        (vendor, tuple(_staff_logins()) or ("",)),
        as_dict=True,
    )
    avg = flt(row[0].avg_rating) if row and row[0].avg_rating is not None else 0.0
    return round(avg, 2), cint(row[0].cnt) if row else 0


def _staff_logins():
    """Logins whose reviews must not count: Administrator, the store's operators,
    and the vendor's own users."""
    from ovira_marketplace.api.admin import OPERATOR_ROLES

    staff = {"Administrator", "Guest"}
    for role in OPERATOR_ROLES:
        staff.update(
            frappe.get_all(
                "Has Role", filters={"role": role, "parenttype": "User"}, pluck="parent"
            )
            or []
        )
    return sorted(staff)


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
    received = sum(by_status.get(s, 0) for s in RECEIVED_STATUSES)
    total = sum(by_status.values())
    return total, decided, fulfilled, received


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


def blend_score(rating, ratings_count, fulfillment_rate, return_rate, has_orders):
    """Weighted blend of whatever signals exist, as a 0–5 score.

    Rating dominates, but its weight ramps with review volume so one five-star
    review doesn't crown a store. Pure arithmetic, separated from the queries so
    it can be reasoned about — and tested — without a database.
    """
    signals, weights = [], []
    if ratings_count > 0:
        signals.append(flt(rating))
        weights.append(1.0 + min(ratings_count, 20) / 20 * 2.0)
    if has_orders:
        signals.append(flt(fulfillment_rate) * 5)
        weights.append(1.5)
        signals.append(max(0.0, 1.0 - flt(return_rate)) * 5)
        weights.append(1.0)
    if not signals:
        return 0.0
    return round(sum(s * w for s, w in zip(signals, weights)) / sum(weights), 2)


def rates(decided, fulfilled, received, returns):
    """(fulfillment_rate, return_rate) from the four counts.

    `fulfillment_rate` is None with nothing decided yet — a store with no history
    has no rate, which is different from a rate of zero. `return_rate` is capped
    at 1 because a buyer can open more than one return against an order, and a
    figure above 100% is nonsense on a badge.
    """
    fulfillment_rate = round(fulfilled / decided, 3) if decided else None
    return_rate = round(min(1.0, returns / received), 3) if received else 0.0
    return fulfillment_rate, return_rate


def compute_vendor_trust(vendor):
    """Live-compute the trust breakdown for a resolved vendor docname."""
    rating, ratings_count = _rating_stats(vendor)
    total, decided, fulfilled, received = _order_stats(vendor)
    returns = _return_count(vendor)

    fulfillment_rate, return_rate = rates(decided, fulfilled, received, returns)
    score = blend_score(rating, ratings_count, fulfillment_rate, return_rate, decided > 0)
    tier = _tier(score, total, ratings_count)

    return {
        "score": score,
        "tier": tier,
        "rating": rating,
        "ratings_count": ratings_count,
        "orders": total,
        "delivered": received,
        "fulfillment_rate": fulfillment_rate,
        "return_rate": return_rate,
    }


# The `_tier` label is part of the public contract, so expose it under a name a
# caller can reasonably import.
tier_for = _tier


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
    """Public trust breakdown for a vendor (docname or slug).

    Recomputes AND caches, rather than computing a private answer. This panel
    used to compute live while every product card read the value the nightly
    scheduler had cached, so the same store showed 4.2 here and 4.3 one section
    above it, off one review left that morning. One number, one source.

    The write needs its own commit: Frappe only commits automatically on
    POST/PUT, and the storefront reads this over GET — without it the refreshed
    score is rolled back and the drift returns on the next render.
    """
    name = _vendor_name(vendor)
    if not name:
        return None
    data = recompute_vendor_trust(name) or compute_vendor_trust(name)
    try:
        frappe.db.commit()
    except Exception:
        pass
    data = dict(data)
    data["vendor"] = name
    data["vendor_name"] = frappe.db.get_value("Marketplace Vendor", name, "vendor_name")
    # The panel reports on the STORE, not on the product being viewed. Saying so
    # is what stops "3 ratings" here reading as a contradiction of the 2 reviews
    # listed further down the same page.
    data["scope"] = "vendor"
    return data

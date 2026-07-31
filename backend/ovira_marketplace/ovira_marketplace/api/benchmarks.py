"""How a seller is doing compared to sellers like them.

A vendor dashboard that reports "average order value: 340 EGP" tells a seller
nothing. Good or bad? Better or worse than last month, than the store, than the
people they actually compete with? Every number a vendor sees here has been
sitting without a reference, which is the difference between a report and a
decision.

Comparisons are drawn against the seller's **peer group** — the other vendors
selling in the same categories — not against the whole marketplace, because a
phone seller's basket is not a stationery seller's and the comparison would be
noise.

Three rules that keep this honest:

* **The median, not the mean.** One vendor with a 90,000 EGP order would drag a
  mean AOV somewhere no real seller lives.
* **No peer group, no comparison.** Fewer than `MIN_PEERS` other sellers and the
  figure is withheld rather than computed from two data points — and withholding
  also stops a "peer average" that is really one identifiable competitor's
  numbers.
* **A vendor never sees another vendor's row.** Only the aggregate, and only when
  the aggregate is large enough to hide behind.
"""

import frappe
from frappe.utils import add_days, cint, flt, nowdate

# Below this, a peer "average" is either meaningless or a thin disguise over one
# competitor's private numbers.
MIN_PEERS = 3

DEFAULT_DAYS = 30


def _range(days):
    days = cint(days) or DEFAULT_DAYS
    return add_days(nowdate(), -days), nowdate()


def _vendor_categories(vendor):
    """The categories this seller actually sells in."""
    return frappe.get_all(
        "Marketplace Product",
        filters={"vendor": vendor, "approval_status": "Approved"},
        pluck="category", limit_page_length=0, ignore_permissions=True,
    )


def _peers(vendor):
    """Other ACTIVE vendors selling in at least one of the same categories."""
    categories = [c for c in set(_vendor_categories(vendor)) if c]
    if not categories:
        return []
    rows = frappe.get_all(
        "Marketplace Product",
        filters=[["category", "in", categories], ["approval_status", "=", "Approved"],
                 ["vendor", "!=", vendor]],
        pluck="vendor", limit_page_length=0, ignore_permissions=True,
    )
    candidates = {v for v in rows if v}
    if not candidates:
        return []
    return frappe.get_all(
        "Marketplace Vendor",
        filters=[["name", "in", list(candidates)], ["status", "=", "Active"]],
        pluck="name", ignore_permissions=True,
    )


def _per_vendor_metrics(vendors, frm, to):
    """{vendor: {orders, gross, units, aov}} over the window, paid orders only."""
    if not vendors:
        return {}
    rows = frappe.db.sql(
        """
        select oi.vendor as vendor,
               count(distinct o.name) as orders,
               sum(oi.qty) as units,
               sum(oi.amount) as gross
        from `tabMarketplace Order Item` oi
        join `tabMarketplace Order` o on o.name = oi.parent
        where oi.vendor in %(vendors)s
          and o.payment_status = 'Paid'
          and date(o.creation) between %(frm)s and %(to)s
        group by oi.vendor
        """,
        {"vendors": tuple(vendors), "frm": frm, "to": to},
        as_dict=True,
    )
    out = {}
    for r in rows:
        orders = cint(r.orders)
        gross = flt(r.gross)
        out[r.vendor] = {
            "orders": orders,
            "units": cint(r.units),
            "gross": round(gross, 2),
            "aov": round(gross / orders, 2) if orders else 0.0,
        }
    return out


def _median(values):
    values = sorted(v for v in values if v is not None)
    if not values:
        return None
    mid = len(values) // 2
    if len(values) % 2:
        return values[mid]
    return round((values[mid - 1] + values[mid]) / 2, 2)


def _percentile_rank(value, peers):
    """What share of peers this seller is at or above, 0–100.

    Answers the question a vendor actually asks — "where do I stand?" — in a form
    that survives one outlier, which a ratio against the average does not.
    """
    peers = [p for p in peers if p is not None]
    if not peers:
        return None
    at_or_below = sum(1 for p in peers if value >= p)
    return round(at_or_below / len(peers) * 100)


def _compare(label, mine, peer_values, higher_is_better=True):
    median = _median(peer_values)
    return {
        "metric": label,
        "mine": mine,
        "peer_median": median,
        "percentile": _percentile_rank(mine, peer_values),
        "higher_is_better": higher_is_better,
        # The honest summary word, so the UI doesn't have to re-derive it and
        # get the direction wrong on the metrics where LOW is good.
        "standing": _standing(mine, median, higher_is_better),
    }


def _standing(mine, median, higher_is_better):
    if median is None or mine is None:
        return "unknown"
    if abs(mine - median) < (abs(median) * 0.05 or 0.01):
        return "typical"
    better = mine > median if higher_is_better else mine < median
    return "ahead" if better else "behind"


@frappe.whitelist()
def my_benchmarks(days=DEFAULT_DAYS):
    """This seller's numbers next to the median of the sellers they compete with.

    Returns `{"available": False, "reason": ...}` rather than a fabricated
    comparison when there aren't enough peers — a benchmark against two stores is
    worse than no benchmark, because it looks like information.
    """
    from ovira_marketplace.api.vendor import _my_vendor

    vendor = _my_vendor()
    if not vendor:
        frappe.throw(frappe._("You don't have a vendor store."), frappe.PermissionError)

    frm, to = _range(days)
    peers = _peers(vendor)
    mine = _per_vendor_metrics([vendor], frm, to).get(vendor) or {
        "orders": 0, "units": 0, "gross": 0.0, "aov": 0.0
    }

    if len(peers) < MIN_PEERS:
        return {
            "available": False,
            "reason": "not_enough_peers",
            "peer_count": len(peers),
            "min_peers": MIN_PEERS,
            "mine": mine,
            "from_date": frm, "to_date": to,
        }

    peer_metrics = _per_vendor_metrics(peers, frm, to)
    # Peers with no sales in the window still count, at zero — dropping them
    # would compare this seller only against the ones who had a good month.
    def peer_values(key):
        return [flt((peer_metrics.get(p) or {}).get(key, 0)) for p in peers]

    from ovira_marketplace.api.trust import compute_vendor_trust

    my_trust = compute_vendor_trust(vendor)
    peer_trust = []
    for p in peers:
        cached = frappe.db.get_value("Marketplace Vendor", p, "trust_score")
        if cached is not None:
            peer_trust.append(flt(cached))

    return {
        "available": True,
        "from_date": frm, "to_date": to,
        "peer_count": len(peers),
        "currency": frappe.db.get_single_value("Marketplace Settings", "default_currency"),
        "mine": mine,
        "comparisons": [
            _compare("orders", mine["orders"], peer_values("orders")),
            _compare("gross", mine["gross"], peer_values("gross")),
            _compare("aov", mine["aov"], peer_values("aov")),
            _compare("trust_score", flt(my_trust.get("score")), peer_trust),
            _compare(
                "return_rate", flt(my_trust.get("return_rate")),
                _peer_return_rates(peers), higher_is_better=False,
            ),
        ],
    }


def _peer_return_rates(peers):
    from ovira_marketplace.api.trust import compute_vendor_trust

    rates = []
    for p in peers:
        try:
            rates.append(flt(compute_vendor_trust(p).get("return_rate")))
        except Exception:
            continue   # one unreadable peer must not blank the whole comparison
    return rates

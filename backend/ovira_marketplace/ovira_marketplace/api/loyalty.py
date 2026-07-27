"""Loyalty points — earn on completed orders, redeem for store credit.

A ledger of Marketplace Loyalty Entry rows. Each Earn row is a **batch** with its
own expiry date and its own spent counter, because expiry is per batch: what was
earned in March lapses in March regardless of what has been spent since. A single
running total cannot answer that, which is why every serious programme holds
points this way.

Redemption burns the batch that expires SOONEST first, so a customer never loses
points they could have spent. Expiry itself posts nothing: points were never
booked as a liability here, so a lapsed batch simply stops counting — the
`expired_points()` figure exists only so a balance that drops has a visible
reason instead of looking like a bug.

The whole feature is gated on `Marketplace Settings.loyalty_enabled` and stays a
silent no-op until the operator turns it on and sets an earn rate. Earning is
awarded once per order when it reaches Completed (idempotent by order). Redeeming
converts points into wallet credit at the configured value — reusing the wallet
ledger so redeemed points behave exactly like any other store credit at checkout
(operator-funded, vendor settlement untouched).
"""

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, nowdate

ENTRY_FIELDS = [
    "name",
    "entry_type",
    "points",
    "expires_on",
    "reason",
    "reference_doctype",
    "reference_name",
    "note",
    "balance_after",
    "creation",
]


def _config():
    """Loyalty settings as a plain dict (safe defaults when unset)."""
    from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
        get_settings,
    )

    s = get_settings()
    return {
        "enabled": bool(cint(s.get("loyalty_enabled"))),
        "earn_rate": flt(s.get("loyalty_earn_rate")),
        "redeem_value": flt(s.get("loyalty_redeem_value")),
        "min_redeem": cint(s.get("loyalty_min_redeem")),
        "currency": s.get("default_currency") or "EGP",
        # 0 = points never expire. Default matches the common one-year practice.
        "expiry_days": cint(s.get("loyalty_expiry_days")),
        "warn_days": cint(s.get("loyalty_expiry_warn_days")) or 30,
    }


def _live_buckets(user):
    """Unspent Earn batches that haven't expired, soonest-to-expire first.

    Points are held as batches rather than one running total because expiry is
    per batch: what someone earned in March expires in March, whatever they've
    spent since. Ordering by expiry (undated batches last) means redemption burns
    what would be lost anyway — the arrangement every major programme uses, and
    the only one that doesn't quietly cost the customer points.
    """
    if not user or user == "Guest":
        return []
    today = nowdate()
    rows = frappe.get_all(
        "Marketplace Loyalty Entry",
        filters=[["user", "=", user], ["entry_type", "=", "Earn"]],
        fields=["name", "points", "points_used", "expires_on"],
        order_by="ifnull(expires_on, '9999-12-31') asc, creation asc",
        limit_page_length=0, ignore_permissions=True,
    )
    live = []
    for r in rows:
        left = cint(r.get("points")) - cint(r.get("points_used"))
        if left <= 0:
            continue
        if r.get("expires_on") and str(r["expires_on"]) < today:
            continue    # expired: simply not counted — no entry, nothing booked
        r["left"] = left
        live.append(r)
    return live


def balance(user):
    """Current points balance for a login (0 for guests / unknown users).

    Expired batches drop out of this sum on their own: expiry is a date, not a
    transaction, so nothing has to be posted for points to lapse.
    """
    return sum(b["left"] for b in _live_buckets(user))


def expired_points(user):
    """Points this shopper lost to expiry — shown so a balance that drops has a
    visible reason rather than looking like a bug."""
    if not user or user == "Guest":
        return 0
    today = nowdate()
    rows = frappe.get_all(
        "Marketplace Loyalty Entry",
        filters=[["user", "=", user], ["entry_type", "=", "Earn"],
                 ["expires_on", "is", "set"], ["expires_on", "<", today]],
        fields=["points", "points_used"], limit_page_length=0, ignore_permissions=True,
    )
    return sum(max(0, cint(r["points"]) - cint(r["points_used"])) for r in rows)


def _consume(user, points):
    """Draw `points` from the live batches, soonest expiry first."""
    remaining = cint(points)
    for bucket in _live_buckets(user):
        if remaining <= 0:
            break
        take = min(remaining, bucket["left"])
        frappe.db.set_value(
            "Marketplace Loyalty Entry", bucket["name"],
            "points_used", cint(bucket.get("points_used")) + take, update_modified=False)
        remaining -= take
    return cint(points) - remaining


def _post(user, entry_type, points, reason, reference_doctype=None, reference_name=None, note=None):
    """Append one ledger row and stamp the resulting balance. Caller commits."""
    points = cint(points)
    if points <= 0:
        return None
    current = balance(user)
    new_balance = current + points if entry_type == "Earn" else current - points
    doc = frappe.new_doc("Marketplace Loyalty Entry")
    doc.user = user
    doc.entry_type = entry_type
    doc.points = points
    doc.reason = reason
    doc.reference_doctype = reference_doctype
    doc.reference_name = reference_name
    doc.note = note
    doc.balance_after = new_balance
    if entry_type == "Earn":
        days = _config()["expiry_days"]
        # Stamped at earn time, so changing the setting later can't retroactively
        # shorten (or lengthen) points somebody already has.
        doc.expires_on = add_days(nowdate(), days) if days > 0 else None
        doc.points_used = 0
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    if entry_type == "Redeem":
        _consume(user, points)
    return doc


def award_for_order(order):
    """Award points for a completed order, once. Gated + idempotent + best-effort:
    a scoring failure must never block the order reaching Completed.

    Points earn on net goods spend (subtotal minus discount, shipping excluded)
    and go to the registered buyer the order is addressed to. Guest-checkout
    orders (no matching User) earn nothing — there's no account to hold points."""
    try:
        cfg = _config()
        if not cfg["enabled"] or cfg["earn_rate"] <= 0:
            return None

        user = order.get("email")
        if not user or not frappe.db.exists("User", user):
            return None

        # One Earn per order, keyed by reference — a re-save of a Completed order
        # (or a Completed→x→Completed bounce) must not double-award.
        if frappe.db.exists(
            "Marketplace Loyalty Entry",
            {"reference_doctype": "Marketplace Order", "reference_name": order.name, "entry_type": "Earn"},
        ):
            return None

        base = flt(order.get("subtotal")) - flt(order.get("discount_amount"))
        points = int(base * cfg["earn_rate"])
        if points <= 0:
            return None

        doc = _post(
            user,
            "Earn",
            points,
            reason="Order",
            reference_doctype="Marketplace Order",
            reference_name=order.name,
        )
        frappe.db.commit()
        _notify_earned(user, points, order.name)
        return doc
    except Exception:
        frappe.log_error(title="Ovira: loyalty award failed")
        return None


def _notify_earned(user, points, order_name):
    from ovira_marketplace.notifications.dispatch import emit

    emit("loyalty.earned",
         {"points": points, "order": order_name, "user": user, "email": user, "kind": "promo"},
         recipients=[{"user": user, "email": user, "phone": None, "lang": None, "kind": "promo"}],
         reference={"doctype": "Marketplace Order", "name": order_name})


@frappe.whitelist()
def my_points(limit=20):
    """The signed-in shopper's points balance, redemption terms and recent
    ledger. Returns an `enabled: False` shape when the program is off so the UI
    can hide itself."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw(_("Please sign in to view your points."), frappe.PermissionError)
    cfg = _config()
    if not cfg["enabled"]:
        return {"enabled": False, "balance": 0, "entries": []}

    entries = frappe.get_all(
        "Marketplace Loyalty Entry",
        filters={"user": user},
        fields=ENTRY_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 20,
        ignore_permissions=True,
    )
    bal = balance(user)
    buckets = _live_buckets(user)
    # The next batch to lapse, so the UI can say "120 points expire on …" rather
    # than leaving the shopper to discover it when the number drops.
    next_expiry = next((b for b in buckets if b.get("expires_on")), None)
    return {
        "enabled": True,
        "balance": bal,
        "expired_points": expired_points(user),
        "next_expiry_on": str(next_expiry["expires_on"]) if next_expiry else None,
        "next_expiry_points": next_expiry["left"] if next_expiry else 0,
        "earn_rate": cfg["earn_rate"],
        "redeem_value": cfg["redeem_value"],
        "min_redeem": cfg["min_redeem"],
        "currency": cfg["currency"],
        "redeemable_value": round(bal * cfg["redeem_value"], 2),
        "entries": entries,
    }


@frappe.whitelist()
def redeem_points(points):
    """Convert points into store credit at the configured value. Debits the
    points ledger and credits the wallet in one committed step."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw(_("Please sign in to redeem points."), frappe.PermissionError)

    cfg = _config()
    if not cfg["enabled"]:
        frappe.throw(_("The loyalty program isn't active right now."))
    if cfg["redeem_value"] <= 0:
        frappe.throw(_("Points can't be redeemed at the moment."))

    points = cint(points)
    if points <= 0:
        frappe.throw(_("Enter how many points to redeem."))
    if cfg["min_redeem"] and points < cfg["min_redeem"]:
        frappe.throw(_("You can redeem at least {0} points at a time.").format(cfg["min_redeem"]))

    bal = balance(user)
    if points > bal:
        frappe.throw(_("You only have {0} points.").format(bal))

    value = round(points * cfg["redeem_value"], 2)
    if value <= 0:
        frappe.throw(_("That many points is worth nothing yet — redeem more."))

    from ovira_marketplace.api import wallet

    _post(user, "Redeem", points, reason="Redeem to store credit")
    wallet.credit(
        user,
        value,
        reason="Loyalty",
        reference_doctype="Marketplace Loyalty Entry",
        note=_("Redeemed {0} loyalty points").format(points),
    )
    frappe.db.commit()

    return {
        "balance": balance(user),
        "redeemed_points": points,
        "credited_value": value,
        "wallet_balance": wallet.balance(user),
        "currency": cfg["currency"],
    }

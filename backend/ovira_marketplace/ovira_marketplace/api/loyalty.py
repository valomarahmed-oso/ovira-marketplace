"""Loyalty points — earn on completed orders, redeem for store credit.

An append-only ledger of Marketplace Loyalty Entry rows (mirrors the wallet):
balance is the running sum of Earn minus Redeem, entries are never mutated.

The whole feature is gated on `Marketplace Settings.loyalty_enabled` and stays a
silent no-op until the operator turns it on and sets an earn rate. Earning is
awarded once per order when it reaches Completed (idempotent by order). Redeeming
converts points into wallet credit at the configured value — reusing the wallet
ledger so redeemed points behave exactly like any other store credit at checkout
(operator-funded, vendor settlement untouched).
"""

import frappe
from frappe import _
from frappe.utils import cint, flt

ENTRY_FIELDS = [
    "name",
    "entry_type",
    "points",
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
    }


def balance(user):
    """Current points balance for a login (0 for guests / unknown users)."""
    if not user or user == "Guest":
        return 0
    rows = frappe.db.sql(
        """
        select entry_type, sum(points) as total
        from `tabMarketplace Loyalty Entry`
        where user = %s
        group by entry_type
        """,
        (user,),
        as_dict=True,
    )
    earn = sum(cint(r.total) for r in rows if r.entry_type == "Earn")
    redeem = sum(cint(r.total) for r in rows if r.entry_type == "Redeem")
    return earn - redeem


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
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
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
    try:
        from ovira_marketplace.api.notifications import create_notification

        create_notification(
            user=user,
            kind="promo",
            title=_("You earned {0} loyalty points").format(points),
            message=_("Points from order {0} are ready to redeem for store credit.").format(order_name),
            reference_doctype="Marketplace Order",
            reference_name=order_name,
        )
        frappe.db.commit()
    except Exception:
        frappe.log_error(title="Ovira: loyalty notify failed")


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
    return {
        "enabled": True,
        "balance": bal,
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

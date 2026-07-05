"""Store credit (wallet) — an append-only ledger of Marketplace Wallet Entry rows.

Balance is always the running sum of credits minus debits; entries are never
mutated after posting. Credit is issued by refunds (returns) and operator
goodwill; it is spent at checkout where it behaves like an operator-funded
discount (see checkout.place_order / payment._invoice_and_pay) so vendor
settlement is never touched.
"""

import frappe
from frappe import _
from frappe.utils import cint, flt

from ovira_marketplace.api.admin import _require_operator

ENTRY_FIELDS = [
    "name",
    "entry_type",
    "amount",
    "reason",
    "reference_doctype",
    "reference_name",
    "note",
    "balance_after",
    "creation",
]


def balance(user):
    """Current store-credit balance for a login (0 for guests / unknown users)."""
    if not user or user == "Guest":
        return 0.0
    rows = frappe.db.sql(
        """
        select entry_type, sum(amount) as total
        from `tabMarketplace Wallet Entry`
        where user = %s
        group by entry_type
        """,
        (user,),
        as_dict=True,
    )
    credit = sum(flt(r.total) for r in rows if r.entry_type == "Credit")
    debit = sum(flt(r.total) for r in rows if r.entry_type == "Debit")
    return round(credit - debit, 2)


def _post(user, entry_type, amount, reason, reference_doctype=None, reference_name=None, note=None):
    """Append one ledger row and stamp the resulting balance. Caller commits."""
    amount = flt(amount)
    if amount <= 0:
        return None
    current = balance(user)
    new_balance = current + amount if entry_type == "Credit" else current - amount
    doc = frappe.new_doc("Marketplace Wallet Entry")
    doc.user = user
    doc.entry_type = entry_type
    doc.amount = amount
    doc.reason = reason
    doc.reference_doctype = reference_doctype
    doc.reference_name = reference_name
    doc.note = note
    doc.balance_after = round(new_balance, 2)
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    return doc


def credit(user, amount, reason="Adjustment", **kwargs):
    """Add store credit to a user (refund, promo, goodwill). Internal helper."""
    if not user or user == "Guest":
        return None
    return _post(user, "Credit", amount, reason, **kwargs)


def debit(user, amount, reason="Order payment", **kwargs):
    """Spend store credit. Refuses to overdraw the balance."""
    if flt(amount) > balance(user) + 0.001:
        frappe.throw(_("Insufficient store credit."))
    return _post(user, "Debit", amount, reason, **kwargs)


@frappe.whitelist()
def get_wallet(limit=20):
    """The signed-in shopper's balance + recent ledger entries."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw(_("Please sign in to view your wallet."), frappe.PermissionError)
    entries = frappe.get_all(
        "Marketplace Wallet Entry",
        filters={"user": user},
        fields=ENTRY_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 20,
        ignore_permissions=True,
    )
    from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
        get_settings,
    )

    return {
        "balance": balance(user),
        "currency": get_settings().default_currency,
        "entries": entries,
    }


# -- operator -----------------------------------------------------------------


@frappe.whitelist()
def adjust_wallet(user, amount, direction="Credit", note=None):
    """Operator: manually credit (goodwill/promo) or debit (correction) a user."""
    _require_operator()
    if not frappe.db.exists("User", user):
        frappe.throw(_("User not found."))
    amount = flt(amount)
    if amount <= 0:
        frappe.throw(_("Enter a positive amount."))

    if direction == "Debit":
        doc = debit(user, amount, reason="Adjustment", note=note)
    else:
        doc = credit(user, amount, reason="Promotional", note=note)
    frappe.db.commit()
    return {"balance": balance(user), "entry": doc.name if doc else None}


@frappe.whitelist()
def user_wallet(user, limit=50):
    """Operator: a user's balance + ledger, for the wallet admin view."""
    _require_operator()
    entries = frappe.get_all(
        "Marketplace Wallet Entry",
        filters={"user": user},
        fields=ENTRY_FIELDS,
        order_by="creation desc",
        limit_page_length=cint(limit) or 50,
        ignore_permissions=True,
    )
    return {"user": user, "balance": balance(user), "entries": entries}

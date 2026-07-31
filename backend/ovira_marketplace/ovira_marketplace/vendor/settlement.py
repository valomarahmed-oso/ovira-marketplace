"""Vendor settlement for Ovira Marketplace.

When a marketplace order is paid, the operator (who collected the full amount
from the shopper and is the seller of record) owes each vendor their share:

    vendor payout = Sales Order net total (ex-VAT) - marketplace commission

booked as a Journal Entry (Debit COGS, Credit the vendor's payable account).
The retained margin equals the commission; output VAT is the operator's
liability to the tax authority (already booked on the customer Sales Invoice).

Paying the vendor later draws down that payable via a Payment Entry
(`run_due_payouts`).
"""

import frappe
from frappe.utils import flt, nowdate


def _splits_revenue():
    """Is there anyone to settle WITH?

    In Single Company mode the store sells its own goods: the "vendor" behind
    every order is the operator. Booking an expense and a payable there would
    have the company owing itself the money it just earned — a liability that
    can never be paid and an expense that never happened. Only a marketplace
    with third-party sellers splits revenue.
    """
    settings = frappe.get_cached_doc("Marketplace Settings")
    return (settings.get("mode") or "Multi Vendor") == "Multi Vendor"


def settle_order(order):
    """Book the operator's payable to each vendor for a paid order. Idempotent."""
    if not _splits_revenue():
        return []
    if isinstance(order, str):
        order = frappe.get_doc("Marketplace Order", order)

    by_so: dict[str, list] = {}
    for row in order.items:
        if row.sales_order:
            by_so.setdefault(row.sales_order, []).append(row)

    booked = []
    for so_name, rows in by_so.items():
        entry = _settle_sub_order(order, so_name, rows)
        if entry:
            booked.append(entry)
    return booked


def _settle_sub_order(order, so_name, rows):
    remark = f"Ovira vendor settlement | order {order.name} | {so_name}"
    if frappe.db.exists("Journal Entry", {"user_remark": remark, "docstatus": 1}):
        return None  # already settled

    so = frappe.get_doc("Sales Order", so_name)
    company = so.company
    supplier = frappe.db.get_value("Marketplace Vendor", rows[0].vendor, "supplier")
    if not supplier:
        return None

    commission = sum(flt(r.commission_amount) for r in rows)
    # Per-Vendor shipping mode books the vendor's own shipping on their Sales
    # Order and records it on the first line; add it back so the fee the customer
    # paid for shipping reaches the vendor (0 in Operator mode).
    vendor_shipping = sum(flt(r.get("vendor_shipping")) for r in rows)
    payout = flt(so.net_total) - commission + vendor_shipping
    if payout <= 0:
        return None

    expense = frappe.db.get_value("Company", company, "default_expense_account")
    payable = frappe.db.get_value("Company", company, "default_payable_account")
    cost_center = frappe.db.get_value("Company", company, "cost_center") or frappe.db.get_value(
        "Cost Center", {"company": company, "is_group": 0}, "name"
    )
    if not (expense and payable):
        return None

    je = frappe.new_doc("Journal Entry")
    je.company = company
    je.posting_date = nowdate()
    je.user_remark = remark
    je.append(
        "accounts",
        {"account": expense, "debit_in_account_currency": payout, "cost_center": cost_center},
    )
    je.append(
        "accounts",
        {
            "account": payable,
            "credit_in_account_currency": payout,
            "party_type": "Supplier",
            "party": supplier,
            "cost_center": cost_center,
        },
    )
    je.flags.ignore_permissions = True
    je.insert()
    je.submit()
    return je.name


def _payout_accounts(company):
    """(payable account, cash/bank account) used to pay a vendor, or (None, None)."""
    payable = frappe.db.get_value("Company", company, "default_payable_account")
    paid_from = frappe.db.get_value("Company", company, "default_cash_account") or frappe.db.get_value(
        "Company", company, "default_bank_account"
    )
    return payable, paid_from


def pay_supplier(supplier, company, payable=None, paid_from=None):
    """Pay a supplier's full outstanding payable via a submitted Payment Entry.

    Returns the Payment Entry name, or ``None`` when nothing is due or the
    company payout accounts aren't configured. Raises on a booking error so the
    caller can surface it (``run_due_payouts`` logs and continues instead)."""
    if payable is None or paid_from is None:
        payable, paid_from = _payout_accounts(company)
    if not (payable and paid_from):
        return None

    outstanding = _supplier_outstanding(supplier, company)
    if outstanding <= 0:
        return None

    pe = frappe.new_doc("Payment Entry")
    pe.payment_type = "Pay"
    pe.company = company
    pe.posting_date = nowdate()
    pe.party_type = "Supplier"
    pe.party = supplier
    pe.paid_from = paid_from
    pe.paid_to = payable
    pe.paid_amount = outstanding
    pe.received_amount = outstanding
    pe.reference_no = f"OVIRA-PAYOUT-{nowdate()}"
    pe.reference_date = nowdate()
    pe.flags.ignore_permissions = True
    pe.insert()
    pe.submit()
    _notify_payout(supplier, outstanding, pe.name, company)
    return pe.name


def _notify_payout(supplier, amount, payment_entry, company):
    """Tell the vendor their money went out. Nothing about a payout should have to
    be discovered by checking a bank app."""
    vendor = frappe.db.get_value("Marketplace Vendor", {"supplier": supplier}, "name")
    if not vendor:
        return
    currency = frappe.db.get_value("Company", company, "default_currency") or ""
    from ovira_marketplace.notifications.dispatch import emit

    emit("vendor.payout_settled", {
        "total": frappe.utils.fmt_money(flt(amount), currency=currency),
        "currency": currency, "reference": payment_entry,
        "vendors": [vendor], "kind": "system",
    }, reference={"doctype": "Payment Entry", "name": payment_entry})


def vendor_balances(company=None):
    """Every vendor with a linked supplier and the balance the operator owes them.

    Powers the operator's payout view: each row carries the outstanding payable
    so the operator can see who is due what before paying. Empty in Single
    Company mode — an operator is never owed money by themselves."""
    if not _splits_revenue():
        return []
    settings = frappe.get_cached_doc("Marketplace Settings")
    company = company or settings.operator_company
    rows = []
    for v in frappe.get_all(
        "Marketplace Vendor",
        filters={"supplier": ["is", "set"]},
        fields=["name", "vendor_name", "supplier", "status"],
    ):
        rows.append(
            {
                "vendor": v.name,
                "vendor_name": v.vendor_name,
                "supplier": v.supplier,
                "status": v.status,
                "balance_due": round(_supplier_outstanding(v.supplier, company), 2),
                "currency": settings.default_currency,
            }
        )
    rows.sort(key=lambda r: r["balance_due"], reverse=True)
    return rows


def run_due_payouts(company=None):
    """Pay each active vendor their outstanding payable balance via a Payment
    Entry (Pay). Best-effort per vendor. Returns the list of created payments."""
    if not _splits_revenue():
        return []
    settings = frappe.get_cached_doc("Marketplace Settings")
    company = company or settings.operator_company
    payable, paid_from = _payout_accounts(company)
    if not (payable and paid_from):
        return []

    paid = []
    suppliers = frappe.get_all(
        "Marketplace Vendor",
        filters={"status": "Active", "supplier": ["is", "set"]},
        pluck="supplier",
    )
    from ovira_marketplace.failures import DEFERRABLE, guard

    for supplier in set(suppliers):
        # One vendor's payout failing must not stop the rest — but a vendor who
        # wasn't paid is the loudest kind of unfinished work in a marketplace,
        # so it is recorded rather than logged and forgotten.
        with guard("vendor payout", DEFERRABLE, ref=supplier):
            pe = pay_supplier(supplier, company, payable, paid_from)
            if pe:
                paid.append(pe)
    frappe.db.commit()
    return paid


def _supplier_outstanding(supplier, company):
    rows = frappe.get_all(
        "GL Entry",
        filters={"party_type": "Supplier", "party": supplier, "company": company, "is_cancelled": 0},
        pluck="credit",
    )
    debits = frappe.get_all(
        "GL Entry",
        filters={"party_type": "Supplier", "party": supplier, "company": company, "is_cancelled": 0},
        pluck="debit",
    )
    return sum(flt(c) for c in rows) - sum(flt(d) for d in debits)

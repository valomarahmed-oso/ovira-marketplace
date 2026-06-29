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


def settle_order(order):
    """Book the operator's payable to each vendor for a paid order. Idempotent."""
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
    payout = flt(so.net_total) - commission
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


def run_due_payouts(company=None):
    """Scheduler: pay each vendor their outstanding payable balance via a
    Payment Entry (Pay). Returns the list of created payments."""
    settings = frappe.get_cached_doc("Marketplace Settings")
    company = company or settings.operator_company
    payable = frappe.db.get_value("Company", company, "default_payable_account")
    paid_from = frappe.db.get_value("Company", company, "default_cash_account") or frappe.db.get_value(
        "Company", company, "default_bank_account"
    )
    if not (payable and paid_from):
        return []

    paid = []
    suppliers = frappe.get_all(
        "Marketplace Vendor",
        filters={"status": "Active", "supplier": ["is", "set"]},
        pluck="supplier",
    )
    for supplier in set(suppliers):
        outstanding = _supplier_outstanding(supplier, company)
        if outstanding <= 0:
            continue
        try:
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
            paid.append(pe.name)
        except Exception:
            frappe.log_error(title="Ovira: vendor payout failed", message=frappe.get_traceback())
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

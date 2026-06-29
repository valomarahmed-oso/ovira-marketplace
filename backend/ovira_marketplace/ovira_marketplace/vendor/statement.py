"""Vendor financial statement for Ovira Marketplace.

Surfaces, per vendor, the numbers behind their dashboard: gross sales,
marketplace commission, registered expenses, payouts received and the balance
the operator still owes them — all derived from the ERPNext ledger so the
vendor sees their real position.
"""

import frappe
from frappe import _
from frappe.utils import flt

from ovira_marketplace.permissions import is_privileged, vendor_for_user


@frappe.whitelist()
def my_statement():
    """Statement for the vendor linked to the logged-in user."""
    vendor = vendor_for_user(frappe.session.user)
    if not vendor:
        frappe.throw(_("No vendor profile is linked to this account."))
    return vendor_statement(vendor)


@frappe.whitelist()
def vendor_statement(vendor):
    """Financial summary for a vendor. Operators see any; vendors see only their own."""
    if not (is_privileged() or vendor_for_user() == vendor):
        frappe.throw(_("Not permitted."), frappe.PermissionError)

    settings = frappe.get_cached_doc("Marketplace Settings")
    company = settings.operator_company
    supplier = frappe.db.get_value("Marketplace Vendor", vendor, "supplier")

    lines = frappe.get_all(
        "Marketplace Order Item",
        filters={"vendor": vendor, "sales_order": ["is", "set"]},
        fields=["parent", "amount", "commission_amount", "qty"],
    )
    gross_sales = sum(flt(line.amount) for line in lines)
    commission = sum(flt(line.commission_amount) for line in lines)
    units_sold = sum(flt(line.qty) for line in lines)
    orders = len({line.parent for line in lines})

    earned, paid = _settled_and_paid(supplier, company)
    expenses = _vendor_expenses(vendor)

    return {
        "vendor": vendor,
        "currency": settings.default_currency,
        "products": frappe.db.count("Marketplace Product", {"vendor": vendor}),
        "orders": orders,
        "units_sold": units_sold,
        "gross_sales": round(gross_sales, 2),
        "commission": round(commission, 2),
        "net_earnings": round(earned, 2),
        "expenses": round(expenses, 2),
        "net_profit": round(earned - expenses, 2),
        "payouts_received": round(paid, 2),
        "balance_due": round(earned - paid, 2),
    }


def _settled_and_paid(supplier, company):
    """(total settled to the vendor, total already paid out) from the ledger."""
    if not supplier:
        return 0.0, 0.0
    gl = frappe.get_all(
        "GL Entry",
        filters={"party_type": "Supplier", "party": supplier, "company": company, "is_cancelled": 0},
        fields=["debit", "credit"],
    )
    earned = sum(flt(g.credit) for g in gl)  # credits to the payable = amounts owed to the vendor
    paid = sum(flt(g.debit) for g in gl)  # debits = payouts made
    return earned, paid


def _vendor_expenses(vendor):
    if not frappe.db.exists("DocType", "Marketplace Vendor Expense"):
        return 0.0
    amounts = frappe.get_all(
        "Marketplace Vendor Expense",
        filters={"vendor": vendor, "docstatus": ["<", 2]},
        pluck="amount",
    )
    return sum(flt(a) for a in amounts)


@frappe.whitelist()
def my_expenses(limit=50):
    """List the logged-in vendor's expenses (newest first)."""
    vendor = vendor_for_user(frappe.session.user)
    if not vendor:
        frappe.throw(_("No vendor profile is linked to this account."))
    return frappe.get_all(
        "Marketplace Vendor Expense",
        filters={"vendor": vendor},
        fields=["name", "expense_date", "category", "amount", "description"],
        order_by="expense_date desc, creation desc",
        limit_page_length=frappe.utils.cint(limit),
    )


@frappe.whitelist()
def add_expense(amount, category=None, description=None, expense_date=None):
    """Record an expense for the logged-in vendor."""
    vendor = vendor_for_user(frappe.session.user)
    if not vendor:
        frappe.throw(_("No vendor profile is linked to this account."))
    doc = frappe.new_doc("Marketplace Vendor Expense")
    doc.vendor = vendor
    doc.amount = flt(amount)
    doc.category = category or "Other"
    doc.description = description
    doc.expense_date = expense_date or frappe.utils.nowdate()
    doc.insert()
    return {"name": doc.name, "amount": doc.amount}

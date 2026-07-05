import frappe
from frappe.model.document import Document


class MarketplaceWalletEntry(Document):
    """One immutable line in a customer's store-credit ledger. The balance is the
    running sum of credits minus debits — entries are never edited after posting,
    so the ledger stays auditable. Use ovira_marketplace.api.wallet.credit/debit
    to post entries (they compute balance_after and guard funds); don't write rows
    by hand."""

    def validate(self):
        if self.entry_type not in ("Credit", "Debit"):
            frappe.throw("Wallet entry type must be Credit or Debit.")
        if not self.amount or self.amount <= 0:
            frappe.throw("Wallet entry amount must be positive.")

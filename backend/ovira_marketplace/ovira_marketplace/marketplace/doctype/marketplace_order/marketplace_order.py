import frappe
from frappe.model.document import Document
from frappe.utils import add_days, flt, nowdate


STATUS_TITLE = {
    "Pending Payment": "بانتظار الدفع",
    "Paid": "تم استلام الدفع",
    "Processing": "طلبك قيد التجهيز",
    "Shipped": "تم شحن طلبك",
    "Completed": "تم تسليم طلبك",
    "Cancelled": "تم إلغاء طلبك",
}


class MarketplaceOrder(Document):
    def before_insert(self):
        # A capability token so a guest can drive *their* order's payment without
        # a login, while an attacker who merely guesses the order id (OVR-000123)
        # cannot. Registered buyers and operators are authorized separately.
        if not self.access_token:
            self.access_token = frappe.generate_hash(length=48)

    def validate(self):
        for row in self.items:
            row.amount = flt(row.rate) * (row.qty or 0)
        self.subtotal = sum(flt(r.amount) for r in self.items)
        if self.total is None:
            self.total = flt(self.subtotal) + flt(self.shipping_amount)

    def on_update(self):
        self._notify_status_change()

    def _notify_status_change(self):
        """Raise a buyer notification whenever the order status advances.

        Best-effort: a notification failure must never block the status change.
        """
        before = self.get_doc_before_save()
        if not before or before.status == self.status:
            return
        recipient = self.email if self.email and frappe.db.exists("User", self.email) else None
        if not recipient:
            return
        try:
            from ovira_marketplace.api.notifications import create_notification

            title = STATUS_TITLE.get(self.status, self.status)
            create_notification(
                user=recipient,
                kind="order",
                title=title,
                message=f"{title} — {self.name}",
                reference_doctype="Marketplace Order",
                reference_name=self.name,
            )
        except Exception:
            frappe.log_error(title="Ovira order notification failed")

    def create_vendor_orders(self):
        """Split the order into one ERPNext Sales Order per vendor and book
        the commission on each line. Idempotent per line (skips linked rows)."""
        settings = frappe.get_cached_doc("Marketplace Settings")
        by_vendor: dict[str, list] = {}
        for row in self.items:
            if row.sales_order:
                continue
            by_vendor.setdefault(row.vendor, []).append(row)

        for vendor, rows in by_vendor.items():
            sales_order = self._make_sales_order(vendor, rows, settings)
            if not sales_order:
                continue
            rate = self._commission_rate(vendor, settings)
            for row in rows:
                row.db_set("sales_order", sales_order)
                row.db_set("commission_amount", flt(row.amount) * rate / 100.0)

    def _make_sales_order(self, vendor, rows, settings):
        so = frappe.new_doc("Sales Order")
        so.customer = self.customer
        so.company = settings.operator_company
        so.transaction_date = nowdate()
        so.delivery_date = add_days(nowdate(), 5)
        if self.currency:
            so.currency = self.currency

        for row in rows:
            item_code = frappe.db.get_value("Marketplace Product", row.marketplace_product, "item")
            if not item_code:
                continue
            so.append(
                "items",
                {
                    "item_code": item_code,
                    "qty": row.qty,
                    "rate": row.rate,
                    "delivery_date": so.delivery_date,
                },
            )

        if not so.get("items"):
            return None

        _apply_sales_taxes(so, settings)
        so.flags.ignore_permissions = True
        so.insert()
        so.submit()
        return so.name

    @staticmethod
    def _commission_rate(vendor, settings):
        override = frappe.db.get_value("Marketplace Vendor", vendor, "commission_rate")
        return flt(override) or flt(settings.default_commission_rate)


def _apply_sales_taxes(so, settings):
    """Attach the configured Sales Taxes and Charges Template (e.g. inclusive
    Egypt VAT) to the Sales Order, falling back to the company default."""
    template = settings.get("sales_tax_template") or frappe.db.get_value(
        "Sales Taxes and Charges Template",
        {"company": so.company, "is_default": 1},
        "name",
    )
    if not template:
        return

    from erpnext.controllers.accounts_controller import get_taxes_and_charges

    so.taxes_and_charges = template
    so.set("taxes", [])
    for tax in get_taxes_and_charges("Sales Taxes and Charges Template", template):
        so.append("taxes", tax)

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
            self.total = flt(self.subtotal) + flt(self.shipping_amount) - flt(self.discount_amount)

    def on_update(self):
        self._notify_status_change()
        self._maybe_issue_delivery_otp()
        self._maybe_award_loyalty()
        self._maybe_restock_on_cancel()

    def _maybe_restock_on_cancel(self):
        """When an order becomes Cancelled, return its quantities to marketplace
        stock (the mirror of the reservation made at checkout). Fires once, only
        on the transition into Cancelled, so it can't double-restock."""
        before = self.get_doc_before_save()
        if not before or before.status == self.status:
            return
        if self.status != "Cancelled":
            return
        try:
            from ovira_marketplace.api.checkout import restock_order

            restock_order(self)
        except Exception:
            frappe.log_error(title="Ovira: restock on cancel failed")

    def _maybe_award_loyalty(self):
        """When an order reaches Completed, award loyalty points to the buyer
        (once). Gated + idempotent inside the loyalty layer; best-effort here so
        it can never block completion."""
        before = self.get_doc_before_save()
        if not before or before.status == self.status:
            return
        if self.status != "Completed":
            return
        try:
            from ovira_marketplace.api.loyalty import award_for_order

            award_for_order(self)
        except Exception:
            frappe.log_error(title="Ovira: loyalty award failed")

    def _maybe_issue_delivery_otp(self):
        """When an order goes out for delivery (→ Shipped), mint a one-time
        delivery code once and push it to the buyer, so the courier can verify
        the handover. Best-effort — never blocks the status change."""
        before = self.get_doc_before_save()
        if not before or before.status == self.status:
            return
        if self.status != "Shipped" or self.delivery_otp:
            return
        try:
            from ovira_marketplace.api.shipping import dispatch_delivery_otp, new_delivery_otp

            otp = new_delivery_otp()
            self.db_set("delivery_otp", otp, update_modified=False)
            dispatch_delivery_otp(self, otp)
        except Exception:
            frappe.log_error(title="Ovira: delivery OTP issue failed")

    def _notify_status_change(self):
        """On every status advance: raise an in-app notification for a registered
        buyer, and email whoever the order is addressed to (guest or registered).

        Best-effort: a notification/email failure must never block the status
        change.
        """
        before = self.get_doc_before_save()
        if not before or before.status == self.status:
            return

        recipient = self.email if self.email and frappe.db.exists("User", self.email) else None
        if recipient:
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

        try:
            from ovira_marketplace.emails import send_order_status

            send_order_status(self)
        except Exception:
            frappe.log_error(title="Ovira order status email failed")

        try:
            from ovira_marketplace.whatsapp import notify_order_status

            notify_order_status(self)
        except Exception:
            frappe.log_error(title="Ovira order status whatsapp failed")

    def create_vendor_orders(self):
        """Split the order into one ERPNext Sales Order per vendor and book
        the commission on each line. Idempotent per line (skips linked rows)."""
        settings = frappe.get_cached_doc("Marketplace Settings")
        by_vendor: dict[str, list] = {}
        for row in self.items:
            if row.sales_order:
                continue
            by_vendor.setdefault(row.vendor, []).append(row)

        # The shipping fee is order-level, so it rides on the FIRST vendor
        # Sales Order only (and only on a fresh order — a retry after a partial
        # failure must not bill it twice).
        include_shipping = not any(row.sales_order for row in self.items)
        for vendor, rows in by_vendor.items():
            sales_order = self._make_sales_order(
                vendor, rows, settings, include_shipping=include_shipping
            )
            if not sales_order:
                continue
            include_shipping = False
            rate = self._commission_rate(vendor, settings)
            for row in rows:
                row.db_set("sales_order", sales_order)
                row.db_set("commission_amount", flt(row.amount) * rate / 100.0)

    def _make_sales_order(self, vendor, rows, settings, include_shipping=False):
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
        if include_shipping and flt(self.shipping_amount) and settings.get("shipping_account"):
            # Actual charge → flows to the Sales Invoice as shipping income.
            # Kept out of net_total, so vendor settlement is unaffected.
            so.append(
                "taxes",
                {
                    "charge_type": "Actual",
                    "account_head": settings.shipping_account,
                    "description": "Shipping",
                    "tax_amount": flt(self.shipping_amount),
                },
            )
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

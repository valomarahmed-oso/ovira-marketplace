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
        self._maybe_create_delivery_notes()
        self._maybe_award_loyalty()
        self._maybe_restock_on_cancel()

    def _maybe_create_delivery_notes(self):
        """When an order ships (→ Shipped), draw its inventory-tracked items out
        of the warehouse with a Delivery Note per vendor Sales Order, so ERPNext
        stock reflects the dispatch. Fires once on the transition; best-effort so
        it never blocks the status change. Non-tracked items move nothing."""
        before = self.get_doc_before_save()
        if not before or before.status == self.status:
            return
        if self.status != "Shipped":
            return
        try:
            from ovira_marketplace.inventory import deliver_order

            deliver_order(self)
        except Exception:
            frappe.log_error(title="Ovira: delivery notes on ship failed")

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
        the commission on each line. Idempotent per line (skips linked rows).

        Shipping placement depends on the marketplace shipping mode:
        - Operator: the order-level fee rides on the FIRST vendor Sales Order only
          (and only on a fresh order — a retry mustn't bill it twice).
        - Per Vendor: each vendor's own fee rides on THEIR Sales Order, and is
          recorded on the vendor's first line so settlement pays it to them."""
        settings = frappe.get_cached_doc("Marketplace Settings")
        per_vendor_mode = (settings.get("shipping_mode") or "Operator") == "Per Vendor"
        default_company = settings.operator_company
        # Group by (vendor, company): a Sales Order carries ONE company, so a
        # multi-company order splits into one SO per company (per vendor). With no
        # per-line company (no multi-warehouse routing) this collapses to the old
        # one-SO-per-vendor behaviour under the operator company.
        groups: dict[tuple, list] = {}
        for row in self.items:
            if row.sales_order:
                continue
            company = row.get("fulfil_company") or default_company
            groups.setdefault((row.vendor, company), []).append(row)

        include_shipping = not any(row.sales_order for row in self.items)
        discounted_vendors: set = set()
        for (vendor, company), rows in groups.items():
            if per_vendor_mode:
                from ovira_marketplace.api.shipping import get_rate_for_vendor

                vsub = sum(flt(r.amount) for r in rows)
                ship = flt(get_rate_for_vendor(vendor, vsub))
            else:
                ship = flt(self.shipping_amount) if include_shipping else 0.0

            # A vendor coupon is funded by the vendor: apply it as a Net-Total
            # discount on THEIR Sales Order. Apply it once per vendor even if the
            # vendor's lines span several companies.
            vendor_discount = 0.0
            if (
                self.get("coupon_vendor")
                and vendor == self.coupon_vendor
                and vendor not in discounted_vendors
            ):
                vendor_discount = flt(self.get("vendor_discount_amount"))
                discounted_vendors.add(vendor)

            sales_order = self._make_sales_order(
                vendor, rows, settings, shipping=ship, discount=vendor_discount, company=company
            )
            if not sales_order:
                continue
            include_shipping = False
            # Only booked shipping (has an income account) is paid to the vendor,
            # so the payout stays balanced with what the customer invoice charges.
            if per_vendor_mode and ship and settings.get("shipping_account"):
                rows[0].db_set("vendor_shipping", ship)
            rate = self._commission_rate(vendor, settings)
            for row in rows:
                row.db_set("sales_order", sales_order)
                row.db_set("commission_amount", flt(row.amount) * rate / 100.0)

    def _make_sales_order(self, vendor, rows, settings, shipping=0.0, discount=0.0, company=None):
        so = frappe.new_doc("Sales Order")
        so.customer = self.customer
        so.company = company or settings.operator_company
        so.transaction_date = nowdate()
        so.delivery_date = add_days(nowdate(), 5)
        if self.currency:
            so.currency = self.currency

        for row in rows:
            item_code = frappe.db.get_value("Marketplace Product", row.marketplace_product, "item")
            if not item_code:
                continue
            line = {
                "item_code": item_code,
                "qty": row.qty,
                "rate": row.rate,
                "delivery_date": so.delivery_date,
            }
            # Multi-warehouse: ship this line from its routed branch.
            if row.get("fulfil_warehouse"):
                line["warehouse"] = row.fulfil_warehouse
            so.append("items", line)

        if not so.get("items"):
            return None

        _apply_sales_taxes(so, settings)
        if flt(shipping) and settings.get("shipping_account"):
            # Actual charge → flows to the Sales Invoice as shipping income. Kept
            # out of net_total; in Per-Vendor mode settlement adds it back to the
            # vendor's payout (see vendor.settlement), otherwise it's the operator's.
            so.append(
                "taxes",
                {
                    "charge_type": "Actual",
                    "account_head": settings.shipping_account,
                    "description": "Shipping",
                    "tax_amount": flt(shipping),
                },
            )
        # Vendor-funded coupon: a Net-Total discount so it lowers the goods total
        # (not shipping), the customer invoice made from this SO, and the vendor's
        # settlement payout (which reads so.net_total) — all in one place.
        if flt(discount) > 0:
            so.apply_discount_on = "Net Total"
            so.discount_amount = flt(discount)
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

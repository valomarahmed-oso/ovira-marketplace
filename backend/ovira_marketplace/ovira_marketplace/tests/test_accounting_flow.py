"""The books: invoicing a paid order, and what each vendor is then owed.

The two money paths I named as needing cover and hadn't covered. They are the
heaviest to test because they run the whole ERPNext chain — Sales Order → Sales
Invoice → Payment Entry → settlement Journal Entry — which is exactly why they
were the ones left out, and exactly why they need this most.

The invariants that matter here are not "a document was created". They are:

* every retry is a no-op (money is charged once, a vendor is credited once);
* the vendor is owed net-of-commission, not gross;
* a failure is recorded rather than swallowed, so an order that took a payment
  and didn't close its books can be found.
"""

import json

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import flt

from ovira_marketplace.tests import fixtures as fx


class TestAccountingFlow(IntegrationTestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        fx.settings(mode="Multi Vendor", operator_vendor=None, default_commission_rate=10)
        frappe.local._ovira_hidden_vendors = None
        # Active so `provision_erpnext_records` links the Supplier settlement
        # needs; a vendor with no Supplier is silently un-settleable.
        self.seller = fx.vendor("Books Seller %s" % self._testMethodName, status="Active")
        self.item = fx.product(
            "Booked Item %s" % self._testMethodName, price=200, stock=50,
            vendor_name=self.seller.name,
        )

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.local._ovira_hidden_vendors = None

    def _paid_order(self, qty=1):
        from ovira_marketplace.api.checkout import place_order
        from ovira_marketplace.api.payment import record_payment

        placed = place_order(
            items=json.dumps(fx.cart(self.item, qty=qty)),
            customer=json.dumps(fx.customer_info()),
        )
        record_payment(placed["name"])
        return frappe.get_doc("Marketplace Order", placed["name"])

    def _invoices(self, order):
        out = []
        for row in order.items:
            if not row.sales_order:
                continue
            name = frappe.db.get_value(
                "Sales Invoice Item", {"sales_order": row.sales_order, "docstatus": 1}, "parent"
            )
            if name and name not in out:
                out.append(name)
        return out

    # -- invoicing ----------------------------------------------------------

    def test_a_paid_order_closes_its_books(self):
        order = self._paid_order()
        self.assertEqual(order.payment_status, "Paid")
        self.assertEqual(
            frappe.db.get_value("Marketplace Order", order.name, "accounting_status"), "Booked"
        )

    def test_each_vendor_sales_order_is_invoiced(self):
        order = self._paid_order()
        self.assertTrue(self._invoices(order), "the vendor's Sales Order should be invoiced")

    def test_the_invoice_is_settled_not_left_outstanding(self):
        """A payment was taken from the shopper; the invoice must not still be
        showing as owed, or every receivables report is wrong."""
        order = self._paid_order()
        for name in self._invoices(order):
            self.assertLessEqual(flt(frappe.db.get_value("Sales Invoice", name, "outstanding_amount")), 0)

    def test_booking_twice_does_not_invoice_twice(self):
        """The idempotency the retry button depends on. Without it, an operator
        clicking 'retry' on a partially-failed order double-bills the customer."""
        from ovira_marketplace.api.payment import book_order_accounting

        order = self._paid_order()
        before = self._invoices(order)
        book_order_accounting(order.reload() or frappe.get_doc("Marketplace Order", order.name))
        self.assertEqual(self._invoices(frappe.get_doc("Marketplace Order", order.name)), before)

    def test_a_deleted_sales_order_is_reported_not_retried_forever(self):
        """28 line items on the live store pointed at Sales Orders deleted from
        the Desk, and every retry failed the same way with no way out."""
        from ovira_marketplace.api.payment import book_order_accounting

        order = self._paid_order()
        order.items[0].db_set("sales_order", "SAL-ORD-DOES-NOT-EXIST", update_modified=False)
        fresh = frappe.get_doc("Marketplace Order", order.name)
        self.assertFalse(book_order_accounting(fresh))
        error = frappe.db.get_value("Marketplace Order", order.name, "accounting_error") or ""
        self.assertIn("deleted in ERPNext", error)

    # -- settlement ---------------------------------------------------------

    def test_the_vendor_is_owed_net_of_commission(self):
        """The whole point of the marketplace's economics: the operator keeps the
        commission, the vendor is credited the rest."""
        from ovira_marketplace.vendor.settlement import _supplier_outstanding

        order = self._paid_order()
        supplier = frappe.db.get_value("Marketplace Vendor", self.seller.name, "supplier")
        if not supplier:
            self.skipTest("vendor has no linked Supplier on this site")
        so_name = order.items[0].sales_order
        net = flt(frappe.db.get_value("Sales Order", so_name, "net_total"))
        commission = sum(flt(r.commission_amount) for r in order.items)
        owed = _supplier_outstanding(supplier, frappe.db.get_value("Sales Order", so_name, "company"))
        self.assertAlmostEqual(owed, net - commission, places=2)
        self.assertGreater(commission, 0, "a 10% commission should have been booked")

    def test_settling_twice_does_not_credit_the_vendor_twice(self):
        from ovira_marketplace.vendor.settlement import _supplier_outstanding, settle_order

        order = self._paid_order()
        supplier = frappe.db.get_value("Marketplace Vendor", self.seller.name, "supplier")
        if not supplier:
            self.skipTest("vendor has no linked Supplier on this site")
        company = frappe.db.get_value("Sales Order", order.items[0].sales_order, "company")
        before = _supplier_outstanding(supplier, company)
        settle_order(frappe.get_doc("Marketplace Order", order.name))
        self.assertAlmostEqual(_supplier_outstanding(supplier, company), before, places=2)

    def test_single_company_mode_never_settles(self):
        """The store would be booking itself an expense and a payable for its own
        sales — 21,347 EGP of them had accrued that way before it was gated."""
        from ovira_marketplace.vendor.settlement import settle_order, vendor_balances

        fx.settings(mode="Single Company", operator_vendor=self.seller.name)
        frappe.local._ovira_hidden_vendors = None
        order = self._paid_order()
        self.assertEqual(settle_order(frappe.get_doc("Marketplace Order", order.name)), [])
        self.assertEqual(vendor_balances(), [])

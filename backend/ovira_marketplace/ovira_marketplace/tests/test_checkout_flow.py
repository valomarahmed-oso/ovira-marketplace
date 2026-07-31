"""Checkout: stock, prices and tax, as the database actually records them.

The unit suite proves the arithmetic in isolation. These prove that placing a
real order writes the numbers the arithmetic produced — that stock comes off the
shelf, that the tax the invoice will bill is recorded on the order, and that a
client that lies about a price or a quantity is ignored.
"""

import json

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import flt

from ovira_marketplace.tests import fixtures as fx


class TestCheckout(IntegrationTestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        fx.settings(mode="Multi Vendor", operator_vendor=None)
        frappe.local._ovira_hidden_vendors = None
        self.seller = fx.vendor("Checkout Seller", status="Active")
        self.item = fx.product("Checkout Item", price=100, stock=10, vendor_name=self.seller.name)

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.local._ovira_hidden_vendors = None

    def _place(self, items=None, **kwargs):
        from ovira_marketplace.api.checkout import place_order

        return place_order(
            items=json.dumps(items or fx.cart(self.item)),
            customer=json.dumps(fx.customer_info()),
            **kwargs,
        )

    # -- stock --------------------------------------------------------------

    def test_placing_an_order_takes_the_stock_off_the_shelf(self):
        before = fx.stock_of(self.item.name)
        self._place(items=fx.cart(self.item, qty=3))
        self.assertEqual(fx.stock_of(self.item.name), before - 3)

    def test_cancelling_puts_it_back(self):
        before = fx.stock_of(self.item.name)
        placed = self._place(items=fx.cart(self.item, qty=2))
        order = frappe.get_doc("Marketplace Order", placed["name"])
        order.status = "Cancelled"
        order.flags.ignore_permissions = True
        order.save(ignore_permissions=True)
        self.assertEqual(fx.stock_of(self.item.name), before)

    def test_a_cancelled_order_does_not_restock_twice(self):
        """The transition guard: re-saving a Cancelled order must not keep
        crediting stock the store never got back."""
        before = fx.stock_of(self.item.name)
        placed = self._place(items=fx.cart(self.item, qty=2))
        order = frappe.get_doc("Marketplace Order", placed["name"])
        order.status = "Cancelled"
        order.flags.ignore_permissions = True
        order.save(ignore_permissions=True)
        order.reload()
        order.save(ignore_permissions=True)
        self.assertEqual(fx.stock_of(self.item.name), before)

    def test_overselling_a_tracked_product_is_refused(self):
        tracked = fx.product(
            "Scarce Item", price=50, stock=2, vendor_name=self.seller.name, track_inventory=1
        )
        with self.assertRaises(Exception):
            self._place(items=fx.cart(tracked, qty=5))

    # -- server-side truth --------------------------------------------------

    def test_the_price_comes_from_the_database_not_the_request(self):
        from ovira_marketplace.api.checkout import place_order

        placed = place_order(
            items=json.dumps([{"slug": self.item.slug, "qty": 1, "rate": 1, "price": 1}]),
            customer=json.dumps(fx.customer_info()),
        )
        order = frappe.get_doc("Marketplace Order", placed["name"])
        self.assertEqual(flt(order.items[0].rate), 100)

    def test_a_negative_quantity_cannot_drive_the_total_down(self):
        from ovira_marketplace.api.checkout import place_order

        placed = place_order(
            items=json.dumps([{"slug": self.item.slug, "qty": -5}]),
            customer=json.dumps(fx.customer_info()),
        )
        order = frappe.get_doc("Marketplace Order", placed["name"])
        self.assertEqual(order.items[0].qty, 1)
        self.assertGreater(flt(order.total), 0)

    def test_a_hidden_sellers_product_cannot_be_bought(self):
        hidden_seller = fx.vendor("Blocked Seller", status="Suspended")
        blocked = fx.product("Blocked Item", vendor_name=hidden_seller.name)
        frappe.local._ovira_hidden_vendors = None
        with self.assertRaises(Exception):
            self._place(items=fx.cart(blocked))

    # -- tax ----------------------------------------------------------------

    def test_the_order_records_the_tax_the_invoice_will_bill(self):
        """Tax used to exist only on the ERPNext Sales Invoice, so the customer
        first met it on a document they couldn't see beforehand."""
        placed = self._place(items=fx.cart(self.item, qty=1))
        order = frappe.get_doc("Marketplace Order", placed["name"])
        from ovira_marketplace.taxes import sales_tax_profile

        if not sales_tax_profile().get("rate"):
            self.skipTest("no sales tax template configured on this site")
        self.assertGreater(flt(order.tax_amount), 0)
        self.assertGreater(flt(order.net_total), 0)

    def test_inclusive_tax_does_not_change_what_the_customer_pays(self):
        from ovira_marketplace.taxes import sales_tax_profile

        profile = sales_tax_profile()
        if not (profile.get("rate") and profile.get("inclusive")):
            self.skipTest("this site is not configured with an inclusive tax template")
        placed = self._place(items=fx.cart(self.item, qty=1))
        order = frappe.get_doc("Marketplace Order", placed["name"])
        # net + tax == goods, and the total is goods + shipping.
        self.assertAlmostEqual(
            flt(order.net_total) + flt(order.tax_amount), flt(order.subtotal), places=2
        )

"""Returns: the money actually reaching the customer.

Every completed return on the live store sat at `refund_amount = 0`, so the
`> 0` guard skipped the wallet credit, the vendor chargeback AND the "your money
is on its way" message — silently. The buyer saw an approved return and an empty
wallet, and three customers were owed 13,966 EGP for weeks.

The unit tests prove the arithmetic. These prove the *consequences*: that
completing a return puts money somewhere a customer can spend it, takes back the
points the purchase earned, and does neither twice.
"""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import flt

from ovira_marketplace.tests import fixtures as fx


class TestReturnRefund(IntegrationTestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        # Own shopper per test: the code under test commits, so frappe's
        # per-test rollback has nothing left to undo (see test_support).
        self.email = "return.%s@ovira.test" % self._testMethodName
        fx.buyer(self.email, "Return Buyer")
        self.item = fx.product(
            "Returnable %s" % self._testMethodName, price=500, stock=100
        )
        self.order = self._order(total=500)

    def tearDown(self):
        frappe.set_user("Administrator")

    def _order(self, total, wallet_applied=0):
        """A delivered order, built directly — this suite is about what happens
        AFTER delivery, and routing it through checkout would drag ERPNext's
        whole accounting chain into a test about store credit.

        It carries a real line item because `MarketplaceOrder.validate`
        recomputes `subtotal` from the lines: an order with none is an order
        worth zero, whatever the field was set to. (That cost me a confusing
        "earned no points" failure, and it is the correct behaviour — the total
        of an order is the sum of what's in it.)
        """
        doc = frappe.new_doc("Marketplace Order")
        doc.customer_name = "Return Buyer"
        doc.email = self.email
        doc.phone = "01000000000"
        doc.status = "Completed"
        doc.payment_status = "Paid"
        doc.currency = "EGP"
        doc.append(
            "items",
            {
                "marketplace_product": self.item.name,
                "title": self.item.title,
                "vendor": self.item.vendor,
                "qty": 1,
                "rate": total,
                "amount": total,
            },
        )
        doc.total = total
        doc.wallet_applied = wallet_applied
        doc.flags.ignore_permissions = True
        doc.insert(ignore_permissions=True)
        return doc

    def _return(self, order=None, fault="Vendor"):
        doc = frappe.new_doc("Marketplace Return")
        doc.marketplace_order = (order or self.order).name
        doc.customer_email = self.email
        doc.reason = "Damaged"
        doc.status = "Requested"
        doc.fault = fault
        doc.flags.ignore_permissions = True
        doc.insert(ignore_permissions=True)
        return doc

    def _wallet(self):
        from ovira_marketplace.api.wallet import balance

        return flt(balance(self.email))

    # -- the bug ------------------------------------------------------------

    def test_completing_a_return_without_naming_an_amount_still_refunds(self):
        """The exact failure: an operator clicks "complete" and types nothing.

        A blank field used to mean zero, and zero meant the customer got nothing
        while the screen said the return was approved.
        """
        from ovira_marketplace.api.returns import set_return_status

        rma = self._return()
        before = self._wallet()
        result = set_return_status(rma.name, "Completed")

        self.assertEqual(flt(result["refund_amount"]), 500)
        self.assertEqual(self._wallet(), before + 500)

    def test_store_credit_spent_on_the_order_is_refunded_too(self):
        # `total` is already net of credit spent, so refunding `total` alone
        # would quietly keep the part the customer paid with their own balance.
        from ovira_marketplace.api.returns import set_return_status

        order = self._order(total=300, wallet_applied=200)
        rma = self._return(order=order)
        before = self._wallet()
        set_return_status(rma.name, "Completed")
        self.assertEqual(self._wallet(), before + 500)

    def test_refunding_nothing_takes_an_explicit_decision(self):
        from ovira_marketplace.api.returns import set_return_status

        rma = self._return()
        before = self._wallet()
        set_return_status(rma.name, "Completed", no_refund=1)
        self.assertEqual(self._wallet(), before, "no_refund must mean no credit")

    def test_an_operators_own_figure_wins(self):
        from ovira_marketplace.api.returns import set_return_status

        rma = self._return()
        before = self._wallet()
        set_return_status(rma.name, "Completed", refund_amount=120)
        self.assertEqual(self._wallet(), before + 120)

    def test_completing_twice_does_not_pay_twice(self):
        """Idempotency, keyed on the return — an operator double-clicking, or a
        retry after a partial failure, must not credit the customer again."""
        from ovira_marketplace.api.returns import set_return_status

        rma = self._return()
        before = self._wallet()
        set_return_status(rma.name, "Completed")
        set_return_status(rma.name, "Completed")
        self.assertEqual(self._wallet(), before + 500)

    # -- loyalty ------------------------------------------------------------

    def test_a_refunded_order_gives_its_loyalty_points_back(self):
        """`award_for_order` had no counterpart, so returning goods PAID."""
        from ovira_marketplace.api.loyalty import balance as points_balance
        from ovira_marketplace.api.returns import set_return_status

        fx.settings(loyalty_enabled=1, loyalty_earn_rate=1, loyalty_redeem_value=0.01)
        order = self._order(total=400)
        # Awarded directly: the hook fires on a status TRANSITION into Completed,
        # and this order was created Completed.
        from ovira_marketplace.api.loyalty import award_for_order

        award_for_order(frappe.get_doc("Marketplace Order", order.name))
        earned = points_balance(self.email)
        self.assertGreater(earned, 0, "the order should have earned points to claw back")

        set_return_status(self._return(order=order).name, "Completed")
        self.assertLess(points_balance(self.email), earned)

    def test_a_partial_refund_takes_back_a_proportional_share(self):
        from ovira_marketplace.api.loyalty import award_for_order, balance as points_balance
        from ovira_marketplace.api.returns import set_return_status

        fx.settings(loyalty_enabled=1, loyalty_earn_rate=1, loyalty_redeem_value=0.01)
        order = self._order(total=1000)
        award_for_order(frappe.get_doc("Marketplace Order", order.name))
        earned = points_balance(self.email)

        set_return_status(self._return(order=order).name, "Completed", refund_amount=250)
        # A quarter refunded → about a quarter of the points gone.
        self.assertAlmostEqual(points_balance(self.email), earned - 250, delta=5)

"""Redeeming points for store credit — two ledgers moving in one step.

The unit suite covers the guard that refuses an absurd rate. What needs a
database is the exchange itself: points must leave the loyalty ledger and money
must arrive in the wallet, and a failure between the two would either give a
shopper free credit or take points and hand back nothing.
"""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import flt

from ovira_marketplace.tests import fixtures as fx


class TestRedeemPoints(IntegrationTestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        self.email = "points.%s@ovira.test" % self._testMethodName
        fx.buyer(self.email, "Points Buyer")
        fx.settings(
            loyalty_enabled=1, loyalty_earn_rate=1,
            loyalty_redeem_value=0.01, loyalty_min_redeem=0,
        )
        self._grant(1000)

    def tearDown(self):
        frappe.set_user("Administrator")

    def _grant(self, points):
        from ovira_marketplace.api.loyalty import _post

        _post(self.email, "Earn", points, reason="Test grant")
        frappe.db.commit()

    def _points(self):
        from ovira_marketplace.api.loyalty import balance

        return balance(self.email)

    def _wallet(self):
        from ovira_marketplace.api.wallet import balance

        return flt(balance(self.email))

    # -- the exchange -------------------------------------------------------

    def test_points_become_store_credit_at_the_configured_value(self):
        from ovira_marketplace.api.loyalty import redeem_points

        frappe.set_user(self.email)
        wallet_before = self._wallet()
        result = redeem_points(500)

        self.assertEqual(result["redeemed_points"], 500)
        self.assertEqual(flt(result["credited_value"]), 5.0)  # 500 x 0.01
        self.assertEqual(self._wallet(), wallet_before + 5.0)

    def test_the_points_actually_leave_the_ledger(self):
        """Both sides must move. Crediting the wallet without burning the points
        would let the same points be spent again and again."""
        from ovira_marketplace.api.loyalty import redeem_points

        frappe.set_user(self.email)
        before = self._points()
        redeem_points(400)
        self.assertEqual(self._points(), before - 400)

    def test_a_shopper_cannot_redeem_more_than_they_have(self):
        from ovira_marketplace.api.loyalty import redeem_points

        frappe.set_user(self.email)
        with self.assertRaises(Exception):
            redeem_points(self._points() + 1)

    def test_nothing_moves_when_the_redemption_is_refused(self):
        from ovira_marketplace.api.loyalty import redeem_points

        frappe.set_user(self.email)
        points, wallet = self._points(), self._wallet()
        try:
            redeem_points(points + 5000)
        except Exception:
            pass
        self.assertEqual(self._points(), points)
        self.assertEqual(self._wallet(), wallet)

    def test_a_guest_cannot_redeem(self):
        from ovira_marketplace.api.loyalty import redeem_points

        frappe.set_user("Guest")
        with self.assertRaises(frappe.PermissionError):
            redeem_points(10)

    def test_the_minimum_is_enforced(self):
        from ovira_marketplace.api.loyalty import redeem_points

        fx.settings(loyalty_min_redeem=100)
        frappe.set_user(self.email)
        with self.assertRaises(Exception):
            redeem_points(50)

    # -- expiry -------------------------------------------------------------

    def test_the_batch_expiring_soonest_is_spent_first(self):
        """Per-batch expiry is why points are held as batches at all: burning the
        oldest-expiring first is the only order that doesn't quietly cost the
        customer points they could have used."""
        from frappe.utils import add_days, nowdate

        from ovira_marketplace.api.loyalty import _live_buckets, redeem_points

        # A second batch that expires much later than the setUp grant.
        self._grant(500)
        buckets = _live_buckets(self.email)
        soonest = buckets[0]["name"]
        frappe.db.set_value(
            "Marketplace Loyalty Entry", soonest, "expires_on", add_days(nowdate(), 1),
            update_modified=False,
        )
        frappe.db.commit()

        frappe.set_user(self.email)
        redeem_points(100)
        spent = frappe.db.get_value("Marketplace Loyalty Entry", soonest, "points_used")
        self.assertEqual(spent, 100, "the batch about to lapse should be the one spent")

    def test_an_expired_batch_does_not_count_towards_the_balance(self):
        from frappe.utils import add_days, nowdate

        from ovira_marketplace.api.loyalty import _live_buckets

        before = self._points()
        stale = _live_buckets(self.email)[0]
        frappe.db.set_value(
            "Marketplace Loyalty Entry", stale["name"], "expires_on", add_days(nowdate(), -1),
            update_modified=False,
        )
        frappe.db.commit()
        self.assertEqual(self._points(), before - stale["left"])

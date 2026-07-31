"""Two properties a commerce system is expected to have, and this one didn't.

**Idempotency.** The architecture has called for it since Phase 0. Without it a
double tap on "confirm", a connection the browser retried, or a back button gives
the shopper two orders, two stock reservations and two charges.

**An audit trail.** Frappe's Version table records what a field changed to, which
is not the same as who decided, and what it cost. A 12,380 EGP refund, a wallet
credited by hand, a seller suspended — those are decisions, and a marketplace has
to be able to show them long after the screen that made them has moved on.
"""

import json

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import flt

from ovira_marketplace.tests import fixtures as fx


class TestCheckoutIdempotency(IntegrationTestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        fx.settings(mode="Multi Vendor", operator_vendor=None)
        frappe.local._ovira_hidden_vendors = None
        self.item = fx.product("Idempotent Item %s" % self._testMethodName, price=100, stock=50)

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.local._ovira_hidden_vendors = None

    def _place(self, key=None):
        from ovira_marketplace.api.checkout import place_order

        return place_order(
            items=json.dumps(fx.cart(self.item)),
            customer=json.dumps(fx.customer_info()),
            idempotency_key=key,
        )

    def test_the_same_key_twice_is_one_order(self):
        key = "attempt-%s" % frappe.generate_hash(length=12)
        first = self._place(key)
        second = self._place(key)
        self.assertEqual(first["name"], second["name"])

    def test_a_retry_does_not_reserve_the_stock_twice(self):
        """The consequence that actually costs money: two reservations for one
        cart means the store believes it has sold twice as much as it has."""
        key = "attempt-%s" % frappe.generate_hash(length=12)
        before = fx.stock_of(self.item.name)
        self._place(key)
        after_first = fx.stock_of(self.item.name)
        self._place(key)
        self.assertEqual(fx.stock_of(self.item.name), after_first)
        self.assertEqual(after_first, before - 1)

    def test_a_replay_still_returns_a_usable_payment_token(self):
        # The client cannot tell a retry from the original and shouldn't have to:
        # it still needs the token to start payment for that order.
        key = "attempt-%s" % frappe.generate_hash(length=12)
        first = self._place(key)
        replay = self._place(key)
        self.assertEqual(replay["token"], first["token"])
        self.assertTrue(replay.get("idempotent_replay"))

    def test_different_keys_are_different_orders(self):
        first = self._place("attempt-%s" % frappe.generate_hash(length=12))
        second = self._place("attempt-%s" % frappe.generate_hash(length=12))
        self.assertNotEqual(first["name"], second["name"])

    def test_no_key_still_works(self):
        """Older clients, and any caller that doesn't send one, must not break —
        and must not all collide on an empty key either."""
        first = self._place(None)
        second = self._place(None)
        self.assertNotEqual(first["name"], second["name"])


class TestAuditTrail(IntegrationTestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        self.email = "audit.%s@ovira.test" % self._testMethodName
        fx.buyer(self.email, "Audit Buyer")

    def tearDown(self):
        frappe.set_user("Administrator")

    def _entries(self, action):
        return frappe.get_all(
            "Marketplace Audit Log",
            filters={"action": action},
            fields=["name", "actor", "amount", "reference_name", "before_value", "after_value"],
            order_by="creation desc",
            limit_page_length=5,
        )

    def test_a_manual_wallet_credit_is_recorded_with_who_and_how_much(self):
        from ovira_marketplace.api.wallet import adjust_wallet

        adjust_wallet(self.email, 250, "Credit", note="goodwill")
        row = self._entries("wallet.adjusted")[0]
        self.assertEqual(row.reference_name, self.email)
        self.assertEqual(flt(row.amount), 250)
        self.assertEqual(row.actor, "Administrator")

    def test_the_recorded_state_shows_the_balance_moving(self):
        from ovira_marketplace.api.wallet import adjust_wallet

        adjust_wallet(self.email, 100, "Credit")
        row = self._entries("wallet.adjusted")[0]
        before = json.loads(row.before_value)
        after = json.loads(row.after_value)
        # The DELTA, not the absolute: the suite runs against a persistent site,
        # so a second run starts from whatever the first one left behind.
        self.assertEqual(flt(after["balance"]) - flt(before["balance"]), 100)
        self.assertEqual(after["direction"], "Credit")

    def test_suspending_a_seller_is_traceable_to_a_person(self):
        from ovira_marketplace.api.operator import set_vendor_status

        seller = fx.vendor("Audited Seller %s" % self._testMethodName, status="Active")
        set_vendor_status(seller.name, "Suspended")
        row = self._entries("vendor.status_changed")[0]
        self.assertEqual(row.reference_name, seller.name)
        self.assertEqual(json.loads(row.after_value)["status"], "Suspended")

    def test_a_failed_audit_write_never_breaks_the_action(self):
        """Recording a decision must not be able to abandon it halfway."""
        from ovira_marketplace.audit import audit

        # An action longer than the column allows: the row fails, the caller
        # carries on with None rather than an exception.
        self.assertIsNone(audit("x" * 500, "User", self.email))

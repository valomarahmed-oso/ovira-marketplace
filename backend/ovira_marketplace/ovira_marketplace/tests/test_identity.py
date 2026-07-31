"""Who a record belongs to, and what language they get spoken to in.

Two live bugs: every customer email went out in English because Frappe stamps new
accounts with the SITE language and nobody had chosen it; and orders placed by
one login had to be invisible to another, which is the single rule the whole
buyer portal rests on.
"""

import frappe
from frappe.tests import IntegrationTestCase

from ovira_marketplace.tests import fixtures as fx


class TestRegistrationLanguage(IntegrationTestCase):
    def tearDown(self):
        frappe.set_user("Administrator")

    def test_a_shopper_who_signed_up_in_arabic_is_recorded_as_arabic(self):
        """Frappe would otherwise write the site language here, and every
        receipt, shipping update and delivery code afterwards renders from it."""
        email = "lang.ar@ovira.test"
        if frappe.db.exists("User", email):
            frappe.delete_doc("User", email, force=True, ignore_permissions=True)
        from ovira_marketplace.api.auth import register_customer

        register_customer("متسوّق", email, "Ovira!test1234", lang="ar")
        self.assertEqual(frappe.db.get_value("User", email, "language"), "ar")

    def test_a_shopper_who_signed_up_in_english_keeps_english(self):
        email = "lang.en@ovira.test"
        if frappe.db.exists("User", email):
            frappe.delete_doc("User", email, force=True, ignore_permissions=True)
        from ovira_marketplace.api.auth import register_customer

        register_customer("Shopper", email, "Ovira!test1234", lang="en")
        self.assertEqual(frappe.db.get_value("User", email, "language"), "en")

    def test_the_engine_resolves_that_language_for_messages(self):
        from ovira_marketplace.notifications.dispatch import _lang_of

        fx.buyer("lang.check@ovira.test", "لغة")
        self.assertEqual(_lang_of("lang.check@ovira.test"), "ar")

    def test_an_unknown_recipient_falls_back_to_the_store_language(self):
        from ovira_marketplace.notifications.dispatch import _lang_of, store_language

        self.assertEqual(_lang_of(None), store_language())
        self.assertEqual(_lang_of("Guest"), store_language())


class TestOrderOwnership(IntegrationTestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        self.mine = "owner@ovira.test"
        self.theirs = "stranger@ovira.test"
        fx.buyer(self.mine, "Owner")
        fx.buyer(self.theirs, "Stranger")
        self.order = self._order(self.mine)

    def tearDown(self):
        frappe.set_user("Administrator")

    def _order(self, email):
        doc = frappe.new_doc("Marketplace Order")
        doc.customer_name = "Owner"
        doc.email = email
        doc.status = "Completed"
        doc.payment_status = "Paid"
        doc.currency = "EGP"
        doc.subtotal = 100
        doc.total = 100
        doc.flags.ignore_permissions = True
        doc.insert(ignore_permissions=True)
        return doc

    def test_a_buyer_sees_their_own_order(self):
        from ovira_marketplace.api.orders import get_order

        frappe.set_user(self.mine)
        self.assertEqual(get_order(self.order.name)["name"], self.order.name)

    def test_a_buyer_cannot_open_someone_elses_order(self):
        """The rule the whole buyer portal rests on. Orders are resolved by the
        LOGIN that owns them, never by a name two people could share."""
        from ovira_marketplace.api.orders import get_order

        frappe.set_user(self.theirs)
        with self.assertRaises(frappe.PermissionError):
            get_order(self.order.name)

    def test_my_orders_lists_only_mine(self):
        from ovira_marketplace.api.orders import my_orders

        frappe.set_user(self.theirs)
        self.assertNotIn(self.order.name, [o["name"] for o in my_orders()])

    def test_a_return_cannot_be_opened_against_someone_elses_order(self):
        from ovira_marketplace.api.returns import request_return

        frappe.set_user(self.theirs)
        with self.assertRaises(frappe.PermissionError):
            request_return(self.order.name, "Damaged")

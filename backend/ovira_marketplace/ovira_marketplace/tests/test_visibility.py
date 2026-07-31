"""What a shopper is allowed to see.

Every one of these would have caught a bug that shipped. The "recommended for
you" strip showed suspended vendors' products and then 404'd when you clicked
one, because the strip checked approved+published while `get_product` also
checks the seller. Single Company mode gated the money paths and left five
sellers' catalogues on sale.
"""

import frappe
from frappe.tests import IntegrationTestCase

from ovira_marketplace.tests import fixtures as fx


class TestVisibility(IntegrationTestCase):
    def setUp(self):
        fx.settings(mode="Multi Vendor", operator_vendor=None)
        self.good = fx.vendor("Visible Seller", status="Active")
        self.bad = fx.vendor("Suspended Seller", status="Suspended")
        self.ok_product = fx.product("Visible Item", vendor_name=self.good.name)
        self.hidden_product = fx.product("Hidden Item", vendor_name=self.bad.name)
        frappe.local._ovira_hidden_vendors = None

    def tearDown(self):
        frappe.set_user("Administrator")
        frappe.local._ovira_hidden_vendors = None

    # -- the leak itself ----------------------------------------------------

    def test_listing_hides_a_suspended_seller(self):
        from ovira_marketplace.api.catalog import list_products

        slugs = {p.slug for p in list_products(limit=100)}
        self.assertIn(self.ok_product.slug, slugs)
        self.assertNotIn(self.hidden_product.slug, slugs)

    def test_recommendations_hide_a_suspended_seller(self):
        # The exact surface that leaked: it built its own approved+published
        # filter instead of going through the shared visibility rule.
        from ovira_marketplace.api.recommendations import popular_products

        slugs = {p.slug for p in popular_products(limit=50)}
        self.assertNotIn(self.hidden_product.slug, slugs)

    def test_a_card_a_shopper_can_see_always_opens(self):
        """The invariant behind the 404: every surface must agree with `get_product`.

        A listing that shows a card `get_product` refuses to open produces a dead
        link the shopper cannot explain, so assert the two agree rather than
        testing each in isolation.
        """
        from ovira_marketplace.api.catalog import get_product, list_products
        from ovira_marketplace.api.recommendations import popular_products

        for card in list(list_products(limit=100)) + list(popular_products(limit=50)):
            get_product(card.slug)  # throws DoesNotExistError if they disagree

    def test_a_hidden_product_cannot_be_opened_directly(self):
        from ovira_marketplace.api.catalog import get_product

        with self.assertRaises(frappe.DoesNotExistError):
            get_product(self.hidden_product.slug)

    # -- single company -----------------------------------------------------

    def test_single_company_hides_every_other_seller(self):
        # Two Active vendors and an explicit choice between them.
        other = fx.vendor("Someone Else", status="Active")
        mine = fx.product("Mine", vendor_name=self.good.name)
        theirs = fx.product("Theirs", vendor_name=other.name)
        fx.settings(mode="Single Company", operator_vendor=self.good.name)
        frappe.local._ovira_hidden_vendors = None

        from ovira_marketplace.api.catalog import list_products

        slugs = {p.slug for p in list_products(limit=100)}
        self.assertIn(mine.slug, slugs)
        self.assertNotIn(theirs.slug, slugs)

    def test_single_company_with_an_ambiguous_answer_hides_nothing(self):
        """Two Active sellers and no choice made: show everything.

        Guessing which one is "the store" would blank most of the catalogue on a
        misconfigured site, which is far worse than showing one seller too many.
        """
        fx.vendor("Someone Else", status="Active")
        fx.settings(mode="Single Company", operator_vendor=None)
        frappe.local._ovira_hidden_vendors = None

        from ovira_marketplace.api.catalog import list_products

        self.assertIn(self.ok_product.slug, {p.slug for p in list_products(limit=100)})

    def test_a_hidden_sellers_storefront_is_gone_too(self):
        from ovira_marketplace.api.vendor import vendor_storefront

        with self.assertRaises(frappe.DoesNotExistError):
            vendor_storefront(self.bad.slug)

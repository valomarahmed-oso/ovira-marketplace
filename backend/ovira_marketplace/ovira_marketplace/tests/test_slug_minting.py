"""Slugs, as they are actually minted against a database.

`web_slug` is unit-tested. What needs a database is the part that made two
products unreachable: uniqueness, and the fact that a saved record never keeps a
slug that breaks a URL.
"""

import frappe
from frappe.tests import IntegrationTestCase

from ovira_marketplace.tests import fixtures as fx


class TestSlugMinting(IntegrationTestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        self.seller = fx.vendor("Slug Seller", status="Active")

    def test_an_arabic_title_gets_a_latin_address(self):
        item = fx.product("رواكول", vendor_name=self.seller.name)
        self.assertEqual(item.slug, "rwakwl")

    def test_two_products_with_the_same_name_get_different_addresses(self):
        """Identical titles transliterate identically; without a suffix the
        second product silently shadows the first and one becomes unreachable."""
        first = fx.product("سماعة بلوتوث", vendor_name=self.seller.name)
        second = fx.product("سماعة بلوتوث", vendor_name=self.seller.name)
        self.assertNotEqual(first.slug, second.slug)
        self.assertTrue(second.slug.startswith(first.slug))

    def test_a_trailing_space_does_not_leave_a_dangling_hyphen(self):
        # `testtest-` and `smart-fone-` were both live, and both broke the
        # stricter slug check that came later.
        item = fx.product("Testtest ", vendor_name=self.seller.name)
        self.assertEqual(item.slug, "testtest")

    def test_every_saved_slug_is_url_safe(self):
        from ovira_marketplace.slugs import is_web_slug

        for title in ["الكمبيوتر و مستلزماته", "65W  GaN --- Charger!!", "منتج ١٢٣"]:
            item = fx.product(title, vendor_name=self.seller.name)
            self.assertTrue(is_web_slug(item.slug), f"{title!r} → {item.slug!r}")

    def test_a_url_breaking_slug_is_replaced_on_save(self):
        """A vendor row on the live store carried `????-????????`, from an early
        write on a non-utf8mb4 connection. `?` starts a query string."""
        item = fx.product("Fixable", vendor_name=self.seller.name)
        frappe.db.set_value("Marketplace Product", item.name, "slug", "????-????", update_modified=False)
        doc = frappe.get_doc("Marketplace Product", item.name)
        doc.flags.ignore_permissions = True
        doc.save(ignore_permissions=True)

        from ovira_marketplace.slugs import is_web_slug

        self.assertTrue(is_web_slug(doc.slug))
        self.assertNotIn("?", doc.slug)

    def test_an_old_arabic_link_still_resolves(self):
        """No mapping table: transliterating the OLD slug produces the NEW one,
        because hyphens separate words either way."""
        from ovira_marketplace.slugs import resolve

        item = fx.product("رواكول", vendor_name=self.seller.name)
        name, canonical = resolve("Marketplace Product", "رواكول")
        self.assertEqual(name, item.name)
        self.assertEqual(canonical, item.slug)

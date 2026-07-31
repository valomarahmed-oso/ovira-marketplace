import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)


class MarketplaceProduct(Document):
    def before_validate(self):
        self._default_vendor()

    def validate(self):
        self._ensure_slug()
        self._guard_vendor_approval()
        self._auto_approve_if_configured()

    def on_update(self):
        if self.approval_status == "Approved":
            self.sync_to_erpnext()

    # -- internal ----------------------------------------------------------

    def _default_vendor(self):
        if self.vendor:
            return
        if "Marketplace Vendor" in frappe.get_roles(frappe.session.user):
            self.vendor = frappe.db.get_value(
                "Marketplace Vendor", {"user": frappe.session.user}, "name"
            )

    def _ensure_slug(self):
        """Mint a URL-safe slug once, and never let a URL-breaking one through.

        `frappe.scrub` keeps Arabic letters, which produced slugs that
        percent-encode in every link and come back from Next's router still
        encoded — a product page that can't find its own product. See
        `ovira_marketplace.slugs`.
        """
        from ovira_marketplace.slugs import is_web_slug, unique_slug

        if not self.slug or not is_web_slug(self.slug):
            source = self.slug or self.title
            self.slug = unique_slug(
                "Marketplace Product", source, fallback=self.name, exclude=self.name
            )
        if self.slug:
            self.slug = self.slug.strip().lower()

    def _guard_vendor_approval(self):
        """A vendor cannot approve or reject their own product."""
        if get_settings().auto_approve_products:
            return
        privileged = {"Marketplace Operator", "System Manager", "Administrator"}
        if privileged & set(frappe.get_roles(frappe.session.user)):
            return
        if self.approval_status in ("Approved", "Rejected"):
            self.approval_status = "Pending"

    def _auto_approve_if_configured(self):
        if self.is_new() and (self.approval_status or "Draft") == "Draft":
            if get_settings().auto_approve_products:
                self.approval_status = "Approved"

    def sync_to_erpnext(self):
        """Idempotently create the linked Item (+ Website Item if webshop is
        installed) and pull current stock. Safe to call on every save."""
        if not self.item:
            self.db_set("item", self._create_item())
        if not self.website_item and _website_item_available() and get_settings().sync_website_item:
            self.db_set("website_item", self._create_website_item())
        # Tracked products: push this screen's quantities INTO ERPNext, per
        # warehouse. The vendor's number is the master (see inventory.py) — the
        # old code seeded ERPNext once and then read back from it, which is how
        # a product showing 98 in the shop sat at 1 in the stock ledger.
        from ovira_marketplace.inventory import sync_product_stock

        sync_product_stock(self)

    def _create_item(self):
        item = frappe.new_doc("Item")
        item.item_code = self.slug or self.name
        item.item_name = self.title
        item.item_group = self._item_group()
        item.stock_uom = self.stock_uom or "Nos"
        item.is_stock_item = 1 if self.track_inventory else 0
        item.description = self.short_description or self.title
        item.standard_rate = self.price or 0
        item.insert(ignore_permissions=True)
        return item.name

    def _create_website_item(self):
        web_item = frappe.new_doc("Website Item")
        web_item.item_code = self.item
        web_item.web_item_name = self.title
        web_item.published = 1 if self.published else 0
        web_item.insert(ignore_permissions=True)
        return web_item.name

    def _item_group(self):
        if self.category:
            mapped = frappe.db.get_value("Marketplace Category", self.category, "item_group")
            if mapped:
                return mapped
        return frappe.db.get_value("Item Group", {"is_group": 0}, "name") or "All Item Groups"

    def refresh_stock(self):
        """Pull ERPNext's quantity back onto this product.

        The opposite direction to `sync_to_erpnext`, and used only where ERPNext
        genuinely moved first: an operator booking a Purchase Receipt, or the
        back-in-stock sweep. What's read is **available** stock (actual minus
        what submitted Sales Orders already reserved) — reading `actual_qty`
        alone re-offers units that are spoken for, and, now that saving pushes
        `stock_qty + reserved` into the Bin, would inflate the number a little
        more on every single save.
        """
        if not self.item:
            return
        if not frappe.db.get_value("Item", self.item, "is_stock_item"):
            return
        # A product with per-branch rows keeps its headline as the sum of those
        # rows; ERPNext must not overwrite a distribution it doesn't own.
        from ovira_marketplace.api.fulfillment import has_stock_locations

        if has_stock_locations(self.name):
            return
        rows = frappe.get_all(
            "Bin",
            filters={"item_code": self.item},
            fields=["actual_qty", "reserved_qty"],
            ignore_permissions=True,
        )
        new_qty = sum(flt(r.actual_qty) - flt(r.reserved_qty) for r in rows)
        if new_qty <= 0:
            # An empty ledger means "not managed in ERPNext", not "sold out" —
            # never zero out a vendor's declared number on the strength of it.
            return
        old_qty = self.stock_qty or 0
        self.db_set("stock_qty", new_qty)
        # Back in stock: tell anyone waiting on this product (best-effort).
        if old_qty <= 0 < new_qty:
            try:
                from ovira_marketplace.api.stock_alerts import notify_back_in_stock

                notify_back_in_stock(self.name)
            except Exception:
                frappe.log_error("back-in-stock notify failed")


def _website_item_available():
    return bool(frappe.db.exists("DocType", "Website Item"))

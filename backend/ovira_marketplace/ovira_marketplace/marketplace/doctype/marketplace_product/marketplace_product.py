import frappe
from frappe import _
from frappe.model.document import Document

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
        if not self.slug and self.title:
            self.slug = frappe.scrub(self.title).replace("_", "-")
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
        if not self.website_item and _website_item_available():
            self.db_set("website_item", self._create_website_item())
        self.refresh_stock()

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
        if not self.item:
            return
        rows = frappe.get_all(
            "Bin", filters={"item_code": self.item}, fields=["sum(actual_qty) as qty"]
        )
        qty = (rows[0].qty if rows and rows[0].qty else 0) or 0
        self.db_set("stock_qty", qty)


def _website_item_available():
    return bool(frappe.db.exists("DocType", "Website Item"))

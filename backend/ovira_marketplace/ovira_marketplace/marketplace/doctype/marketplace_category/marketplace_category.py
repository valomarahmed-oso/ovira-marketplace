import frappe
from frappe.utils.nestedset import NestedSet


class MarketplaceCategory(NestedSet):
    nsm_parent_field = "parent_marketplace_category"

    def validate(self):
        self._ensure_slug()

    def on_update(self):
        NestedSet.on_update(self)
        if not self.item_group:
            self.db_set("item_group", self._ensure_item_group())

    # -- internal ----------------------------------------------------------

    def _ensure_slug(self):
        if not self.slug and self.category_name:
            self.slug = frappe.scrub(self.category_name).replace("_", "-")
        if self.slug:
            self.slug = self.slug.strip().lower()

    def _ensure_item_group(self):
        """Mirror the category as an ERPNext Item Group so products map cleanly."""
        if frappe.db.exists("Item Group", self.category_name):
            return self.category_name

        parent_ig = "All Item Groups"
        if self.parent_marketplace_category:
            mapped = frappe.db.get_value(
                "Marketplace Category", self.parent_marketplace_category, "item_group"
            )
            if mapped:
                parent_ig = mapped

        group = frappe.new_doc("Item Group")
        group.item_group_name = self.category_name
        group.parent_item_group = parent_ig
        group.is_group = 1 if self.is_group else 0
        group.insert(ignore_permissions=True)
        return group.name

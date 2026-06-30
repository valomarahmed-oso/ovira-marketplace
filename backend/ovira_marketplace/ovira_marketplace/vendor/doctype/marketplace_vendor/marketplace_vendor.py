import frappe
from frappe import _
from frappe.model.document import Document


class MarketplaceVendor(Document):
    def validate(self):
        self._ensure_slug()

    def after_insert(self):
        if self.status == "Pending":
            self._notify_operators()

    def on_update(self):
        if self.status == "Active":
            self.provision_erpnext_records()

    # -- internal ----------------------------------------------------------

    def _notify_operators(self):
        """Ping operators in the Desk that a store is awaiting approval."""
        for user in _operator_users():
            note = frappe.new_doc("Notification Log")
            note.subject = _("New vendor application: {0}").format(self.vendor_name)
            note.email_content = _("A new vendor has applied and is awaiting approval.")
            note.for_user = user
            note.type = "Alert"
            note.document_type = "Marketplace Vendor"
            note.document_name = self.name
            note.from_user = self.user or frappe.session.user
            note.insert(ignore_permissions=True)

    def _ensure_slug(self):
        if not self.slug and self.vendor_name:
            self.slug = frappe.scrub(self.vendor_name).replace("_", "-")
        if self.slug:
            self.slug = self.slug.strip().lower()

    def provision_erpnext_records(self):
        """Create the linked Supplier / Customer / role once the store is live.

        Idempotent: only fills what is missing, safe to call on every save.
        """
        if not self.supplier:
            self.db_set("supplier", self._create_supplier())
        if not self.customer:
            self.db_set("customer", self._create_customer())
        if self.user:
            self._grant_vendor_role()

    def _create_supplier(self):
        supplier = frappe.new_doc("Supplier")
        supplier.supplier_name = self.vendor_name
        supplier.supplier_group = _default_group("Supplier Group", "All Supplier Groups")
        supplier.insert(ignore_permissions=True)
        return supplier.name

    def _create_customer(self):
        customer = frappe.new_doc("Customer")
        customer.customer_name = self.vendor_name
        customer.customer_type = "Company"
        customer.customer_group = _default_group("Customer Group", "All Customer Groups")
        customer.territory = _default_group("Territory", "All Territories")
        customer.insert(ignore_permissions=True)
        return customer.name

    def _grant_vendor_role(self):
        if "Marketplace Vendor" in frappe.get_roles(self.user):
            return
        user = frappe.get_doc("User", self.user)
        user.add_roles("Marketplace Vendor")


def _default_group(doctype, fallback):
    name = frappe.db.get_value(doctype, {"is_group": 0}, "name")
    return name or fallback


def _operator_users():
    """Enabled users who can approve vendors."""
    rows = frappe.get_all(
        "Has Role",
        filters={
            "parenttype": "User",
            "role": ["in", ["Marketplace Operator", "System Manager"]],
        },
        pluck="parent",
        ignore_permissions=True,
    )
    users = {u for u in rows if u and u not in ("Administrator", "Guest")}
    return [u for u in users if frappe.db.get_value("User", u, "enabled")]

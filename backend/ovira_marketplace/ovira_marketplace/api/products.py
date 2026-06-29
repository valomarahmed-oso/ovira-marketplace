import frappe
from frappe import _

from ovira_marketplace.permissions import vendor_for_user

VENDOR_PRODUCT_FIELDS = [
    "name",
    "title",
    "slug",
    "price",
    "compare_at_price",
    "stock_qty",
    "approval_status",
    "category",
    "condition",
]


@frappe.whitelist()
def my_products():
    """Products owned by the current vendor."""
    vendor = vendor_for_user()
    if not vendor:
        return []
    return frappe.get_all(
        "Marketplace Product",
        filters={"vendor": vendor},
        fields=VENDOR_PRODUCT_FIELDS,
        order_by="modified desc",
    )


@frappe.whitelist()
def upsert_product(
    title,
    price,
    name=None,
    category=None,
    compare_at_price=None,
    stock_uom=None,
    condition=None,
    short_description=None,
    description=None,
):
    """Create or update one of the vendor's own products.

    The controller forces the product back to Pending for vendors and binds it to
    the vendor's store, so a vendor can never publish or hijack another's product.
    """
    vendor = vendor_for_user()
    if not vendor:
        frappe.throw(_("Only registered vendors can manage products."), frappe.PermissionError)

    if name:
        doc = frappe.get_doc("Marketplace Product", name)
        if doc.vendor != vendor:
            frappe.throw(_("This product belongs to another vendor."), frappe.PermissionError)
    else:
        doc = frappe.new_doc("Marketplace Product")

    doc.vendor = vendor
    doc.title = title
    doc.price = price
    if category:
        doc.category = category
    if compare_at_price is not None:
        doc.compare_at_price = compare_at_price
    if stock_uom:
        doc.stock_uom = stock_uom
    if condition:
        doc.condition = condition
    if short_description:
        doc.short_description = short_description
    if description:
        doc.description = description

    doc.save(ignore_permissions=True)
    return {"name": doc.name, "approval_status": doc.approval_status}

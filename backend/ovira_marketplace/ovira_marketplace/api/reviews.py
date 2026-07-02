"""Product reviews for the storefront.

Reviews are stored as ``Marketplace Review`` docs and rolled up onto the product
(average + count) by the doctype controller. Writes require a signed-in user; a
buyer who has a paid/completed order for the product is flagged as a verified
purchase.
"""

import frappe
from frappe import _
from frappe.utils import cint


def _product_name(product):
    """Accept a product slug (storefront) or docname and return the docname of a
    live, purchasable product — or None."""
    if not product:
        return None
    return frappe.db.get_value(
        "Marketplace Product",
        {"name": product, "approval_status": "Approved", "published": 1},
        "name",
    ) or frappe.db.get_value(
        "Marketplace Product",
        {"slug": product, "approval_status": "Approved", "published": 1},
        "name",
    )


def _session_email():
    user = frappe.session.user
    if not user or user == "Guest":
        return None
    return frappe.db.get_value("User", user, "email") or user


def _has_purchased(email, product):
    """True if this login has a paid/completed order containing the product."""
    if not email:
        return False
    from ovira_marketplace.api.orders import _order_or_filters

    orders = frappe.get_all(
        "Marketplace Order",
        or_filters=_order_or_filters(email),
        filters=[
            ["payment_status", "in", ["Paid"]],
        ],
        pluck="name",
        ignore_permissions=True,
    )
    # Also treat "Completed" orders as purchases even if payment_status lags.
    orders += frappe.get_all(
        "Marketplace Order",
        or_filters=_order_or_filters(email),
        filters=[["status", "=", "Completed"]],
        pluck="name",
        ignore_permissions=True,
    )
    if not orders:
        return False
    return bool(
        frappe.db.exists(
            "Marketplace Order Item",
            {"parent": ["in", list(set(orders))], "marketplace_product": product},
        )
    )


def _to_flat(row):
    return {
        "id": row.name,
        "author": row.author_name,
        "rating": cint(row.rating),
        "body": row.body,
        "verified": bool(row.verified_purchase),
        "date": frappe.utils.get_datetime(row.creation).strftime("%Y-%m-%d"),
    }


@frappe.whitelist(allow_guest=True)
def list_reviews(product, limit=50):
    """Published reviews for a product (by slug or docname) + aggregate."""
    name = _product_name(product)
    if not name:
        return {"reviews": [], "avg": 0, "count": 0}
    rows = frappe.get_all(
        "Marketplace Review",
        filters={"product": name, "status": "Published"},
        fields=["name", "author_name", "rating", "body", "verified_purchase", "creation"],
        order_by="creation desc",
        limit_page_length=cint(limit) or 50,
        ignore_permissions=True,
    )
    reviews = [_to_flat(r) for r in rows]
    count = len(reviews)
    avg = round(sum(r["rating"] for r in reviews) / count, 1) if count else 0
    return {"reviews": reviews, "avg": avg, "count": count}


@frappe.whitelist()
@frappe.rate_limit(key="add_review", limit=20, seconds=60 * 60)
def add_review(product, rating, body, author=None):
    """Add (or replace) the signed-in buyer's review of a product."""
    email = _session_email()
    if not email:
        frappe.throw(_("Please sign in to leave a review."), frappe.PermissionError)

    name = _product_name(product)
    if not name:
        frappe.throw(_("Product not found."), frappe.DoesNotExistError)

    rating = max(1, min(5, cint(rating)))
    body = (body or "").strip()
    if not body:
        frappe.throw(_("Please write a short review."))

    author = (author or "").strip() or (
        frappe.db.get_value("User", frappe.session.user, "full_name") or _("Ovira shopper")
    )
    verified = _has_purchased(email, name)

    # One review per user per product — update in place rather than piling up.
    existing = frappe.db.get_value(
        "Marketplace Review", {"product": name, "user": frappe.session.user}, "name"
    )
    doc = frappe.get_doc("Marketplace Review", existing) if existing else frappe.new_doc(
        "Marketplace Review"
    )
    doc.product = name
    doc.user = frappe.session.user
    doc.author_name = author
    doc.rating = rating
    doc.body = body
    doc.verified_purchase = 1 if verified else 0
    doc.status = "Published"
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return _to_flat(doc)

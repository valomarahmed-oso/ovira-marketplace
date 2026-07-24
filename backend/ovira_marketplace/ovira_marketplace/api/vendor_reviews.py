"""Seller (store) reviews for the storefront.

Distinct from product reviews: a buyer rates the VENDOR/store — their service,
packaging, delivery — not a single product. Stored as ``Marketplace Vendor
Review`` docs and rolled up onto the vendor (``store_rating`` +
``store_reviews_count``). Writes require a signed-in user; a buyer who has a
paid/completed order from the vendor is flagged as a verified purchase.
"""

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint, flt


def _vendor_name(vendor):
    """Accept a vendor slug (storefront) or docname → active vendor docname."""
    if not vendor:
        return None
    if frappe.db.exists("Marketplace Vendor", vendor):
        return vendor
    return frappe.db.get_value("Marketplace Vendor", {"slug": vendor}, "name")


def _session_email():
    user = frappe.session.user
    if not user or user == "Guest":
        return None
    return frappe.db.get_value("User", user, "email") or user


def _has_purchased_from(email, vendor):
    """True if this login has a paid/completed order with an item from the vendor."""
    if not email:
        return False
    from ovira_marketplace.api.orders import _order_or_filters

    orders = frappe.get_all(
        "Marketplace Order",
        or_filters=_order_or_filters(email),
        filters=[["payment_status", "=", "Paid"]],
        pluck="name",
        ignore_permissions=True,
    )
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
            {"parent": ["in", list(set(orders))], "vendor": vendor},
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


def _recompute_store_rating(vendor):
    """Roll the published seller reviews up onto the vendor (avg + count)."""
    row = frappe.db.sql(
        """
        select avg(rating) as avg_rating, count(*) as cnt
        from `tabMarketplace Vendor Review`
        where vendor = %s and status = 'Published'
        """,
        (vendor,),
        as_dict=True,
    )
    avg = round(flt(row[0].avg_rating), 2) if row and row[0].avg_rating is not None else 0.0
    count = cint(row[0].cnt) if row else 0
    frappe.db.set_value(
        "Marketplace Vendor",
        vendor,
        {"store_rating": avg, "store_reviews_count": count},
        update_modified=False,
    )
    return avg, count


@frappe.whitelist(allow_guest=True)
def list_vendor_reviews(vendor, limit=50):
    """Published seller reviews for a vendor (by slug or docname) + aggregate."""
    name = _vendor_name(vendor)
    if not name:
        return {"reviews": [], "avg": 0, "count": 0}
    rows = frappe.get_all(
        "Marketplace Vendor Review",
        filters={"vendor": name, "status": "Published"},
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
@rate_limit(limit=20, seconds=60 * 60, methods="POST")
def add_vendor_review(vendor, rating, body, author=None):
    """Add (or replace) the signed-in buyer's review of a seller/store."""
    email = _session_email()
    if not email:
        frappe.throw(_("Please sign in to leave a review."), frappe.PermissionError)

    name = _vendor_name(vendor)
    if not name:
        frappe.throw(_("Store not found."), frappe.DoesNotExistError)

    rating = max(1, min(5, cint(rating)))
    body = (body or "").strip()
    if not body:
        frappe.throw(_("Please write a short review."))

    author = (author or "").strip() or (
        frappe.db.get_value("User", frappe.session.user, "full_name") or _("Ovira shopper")
    )
    verified = _has_purchased_from(email, name)

    # One review per user per store — update in place rather than piling up.
    existing = frappe.db.get_value(
        "Marketplace Vendor Review", {"vendor": name, "user": frappe.session.user}, "name"
    )
    doc = (
        frappe.get_doc("Marketplace Vendor Review", existing)
        if existing
        else frappe.new_doc("Marketplace Vendor Review")
    )
    doc.vendor = name
    doc.user = frappe.session.user
    doc.author_name = author
    doc.rating = rating
    doc.body = body
    doc.verified_purchase = 1 if verified else 0
    doc.status = "Published"
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    _recompute_store_rating(name)
    frappe.db.commit()

    return _to_flat(doc)

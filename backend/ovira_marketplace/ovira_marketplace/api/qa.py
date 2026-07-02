"""Product questions & answers.

Any signed-in shopper may ask a question on a product; the operator or the
product's own vendor answers. Questions are published immediately (v1) and shown
on the product page.
"""

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint

from ovira_marketplace.api.admin import OPERATOR_ROLES


def _product_name(product):
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


def _is_operator():
    user = frappe.session.user
    return user != "Guest" and any(r in frappe.get_roles(user) for r in OPERATOR_ROLES)


def _my_vendor():
    return frappe.db.get_value("Marketplace Vendor", {"user": frappe.session.user}, "name")


def _to_flat(row):
    return {
        "id": row.name,
        "author": row.author_name,
        "body": row.body,
        "answer": row.answer,
        "answered_by": row.answered_by,
        "date": frappe.utils.get_datetime(row.creation).strftime("%Y-%m-%d"),
    }


@frappe.whitelist(allow_guest=True)
def list_questions(product, limit=50):
    """Published questions (with answers) for a product, newest first."""
    name = _product_name(product)
    if not name:
        return []
    rows = frappe.get_all(
        "Marketplace Question",
        filters={"product": name, "status": "Published"},
        fields=["name", "author_name", "body", "answer", "answered_by", "creation"],
        order_by="creation desc",
        limit_page_length=cint(limit) or 50,
        ignore_permissions=True,
    )
    return [_to_flat(r) for r in rows]


@frappe.whitelist()
@rate_limit(limit=20, seconds=60 * 60, methods="POST")
def ask_question(product, body, author=None):
    """A signed-in shopper asks a question about a product."""
    if not _session_email():
        frappe.throw(_("Please sign in to ask a question."), frappe.PermissionError)
    name = _product_name(product)
    if not name:
        frappe.throw(_("Product not found."), frappe.DoesNotExistError)
    body = (body or "").strip()
    if not body:
        frappe.throw(_("Please write your question."))

    author = (author or "").strip() or (
        frappe.db.get_value("User", frappe.session.user, "full_name") or _("Ovira shopper")
    )
    doc = frappe.new_doc("Marketplace Question")
    doc.product = name
    doc.user = frappe.session.user
    doc.author_name = author
    doc.body = body
    doc.status = "Published"
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return _to_flat(doc)


@frappe.whitelist()
def answer_question(name, answer):
    """Answer a question — operator, or the vendor who owns the product."""
    doc = frappe.get_doc("Marketplace Question", name)

    if not _is_operator():
        product_vendor = frappe.db.get_value("Marketplace Product", doc.product, "vendor")
        if not product_vendor or product_vendor != _my_vendor():
            frappe.throw(_("You can't answer this question."), frappe.PermissionError)
        label = frappe.db.get_value("Marketplace Vendor", product_vendor, "vendor_name") or _("Vendor")
    else:
        label = _("Store")

    answer = (answer or "").strip()
    if not answer:
        frappe.throw(_("Please write an answer."))

    doc.answer = answer
    doc.answered_by = label
    doc.flags.ignore_permissions = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return _to_flat(doc)

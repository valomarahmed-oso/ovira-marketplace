import hashlib
import secrets

import frappe
from frappe.model.document import Document


class MarketplaceNotificationPreference(Document):
    def before_insert(self):
        if not self.unsubscribe_token:
            self.unsubscribe_token = secrets.token_urlsafe(24)


def for_recipient(email, user=None, create=False):
    """The stored preferences for an address, or None.

    Nothing is created just to read: a customer who never touched their settings
    has no row, and the caller applies the defaults.
    """
    if not email:
        return None
    email = email.strip().lower()
    name = frappe.db.exists("Marketplace Notification Preference", email)
    if name:
        return frappe.get_doc("Marketplace Notification Preference", name)
    if not create:
        return None
    doc = frappe.get_doc({
        "doctype": "Marketplace Notification Preference",
        "recipient": email, "user": user,
        "marketing_email": 1, "marketing_push": 1,
    })
    doc.insert(ignore_permissions=True)
    return doc


def token_for(email, user=None):
    """The unsubscribe token for an address, creating the row on first use — a
    marketing email without a working unsubscribe link is not one we should send."""
    doc = for_recipient(email, user=user, create=True)
    return doc.unsubscribe_token if doc else None


def by_token(token):
    if not token:
        return None
    name = frappe.db.get_value(
        "Marketplace Notification Preference", {"unsubscribe_token": token}, "name")
    return frappe.get_doc("Marketplace Notification Preference", name) if name else None


def digest(email):
    """A stable, non-reversible id for an address — used where a preference has to
    be referenced without printing the address itself."""
    return hashlib.sha1((email or "").strip().lower().encode("utf-8")).hexdigest()[:12]

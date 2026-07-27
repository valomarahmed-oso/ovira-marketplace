import frappe
from frappe.model.document import Document


class MarketplaceNotificationTemplate(Document):
    """An operator's wording for one event in one language.

    The shipped defaults stay in `notifications/events.py`; this only ever
    overrides them, so an override that's deleted (or an event that never had
    one) falls back to code rather than to nothing.
    """

    def on_update(self):
        _clear_cache()

    def on_trash(self):
        _clear_cache()


def _clear_cache():
    # The engine reads templates on every emit; keep that a cache hit.
    try:
        frappe.cache().delete_value("ovira_notification_templates")
    except Exception:
        pass

import frappe
from frappe.model.document import Document


class MarketplaceNotification(Document):
    def after_insert(self):
        # Nudge any open storefront session so the bell updates live.
        try:
            frappe.publish_realtime(
                "ovira_notification",
                {"name": self.name, "title": self.title, "kind": self.kind},
                user=self.user,
            )
        except Exception:
            pass

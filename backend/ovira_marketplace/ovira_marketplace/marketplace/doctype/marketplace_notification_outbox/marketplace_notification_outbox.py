from frappe.model.document import Document


class MarketplaceNotificationOutbox(Document):
    """A queued/attempted notification. Rows are written by the engine
    (`notifications.dispatch`) and are read-only from the operator console —
    the only mutation an operator performs is asking for a re-send."""

    pass

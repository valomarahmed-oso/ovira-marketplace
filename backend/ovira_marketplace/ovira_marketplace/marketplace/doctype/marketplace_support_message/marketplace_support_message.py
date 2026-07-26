"""One message in a support ticket.

Read state is two flags rather than a timestamp: a message stays unread for the
*other* side until they open the thread, which bulk-marks it. That mirrors the
buyer↔vendor chat so both inboxes behave the same way.
"""

from frappe.model.document import Document


class MarketplaceSupportMessage(Document):
    pass

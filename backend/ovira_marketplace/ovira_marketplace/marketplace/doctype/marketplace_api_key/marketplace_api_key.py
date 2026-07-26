"""Registry row for one issued API access key.

The key itself lives on a dedicated service `User` (Frappe's `api_key` /
`api_secret`); this row is the audit trail — what the key is for, what it may
do, who issued it and when it was revoked. Keeping a registry means the console
never has to scan every User on the site, so it can't surface or touch accounts
that have nothing to do with the marketplace.
"""

import frappe
from frappe.model.document import Document


class MarketplaceAPIKey(Document):
    def on_trash(self):
        """Deleting the row must not leave a working key behind — the service
        user is the thing that actually grants access."""
        from ovira_marketplace.api.api_access import disable_service_user

        if self.user:
            disable_service_user(self.user)

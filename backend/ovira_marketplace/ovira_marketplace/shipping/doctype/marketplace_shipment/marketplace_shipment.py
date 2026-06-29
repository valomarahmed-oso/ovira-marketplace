import frappe
from frappe.model.document import Document

from ovira_marketplace.shipping.connectors import get_shipping_connector


class MarketplaceShipment(Document):
    def book(self):
        """Create the shipment with the provider and store tracking + label."""
        connector = get_shipping_connector(self.provider)
        if not connector:
            frappe.throw(frappe._("Shipping provider {0} is not configured.").format(self.provider))
        result = connector.create_shipment(self)
        self.tracking_number = result.get("tracking_number")
        self.tracking_url = result.get("tracking_url")
        self.label_url = result.get("label_url")
        if result.get("shipping_cost") is not None:
            self.shipping_cost = result["shipping_cost"]
        self.status = "Created"
        self.save(ignore_permissions=True)

    def refresh_tracking(self):
        connector = get_shipping_connector(self.provider)
        if not connector or not self.tracking_number:
            return
        events = connector.track(self.tracking_number)
        self.set("events", [])
        for ev in events:
            self.append("events", ev)
        if events:
            self.status = events[-1].get("status") or self.status
        self.save(ignore_permissions=True)

import random

from frappe.utils import flt

from ovira_marketplace.shipping.connectors.base import ShippingConnector


class ManualConnector(ShippingConnector):
    """In-house / flat-rate shipping with no external carrier call."""

    provider = "Manual"

    def rate(self, subtotal, governorate=None):
        free_over = flt(self.config.free_over)
        if free_over and flt(subtotal) >= free_over:
            return 0
        return flt(self.config.flat_rate)

    def create_shipment(self, shipment):
        return {
            "tracking_number": "OVS%09d" % random.randint(0, 999999999),
            "tracking_url": None,
            "label_url": None,
            "shipping_cost": flt(self.config.flat_rate),
        }

    def track(self, tracking_number):
        return []

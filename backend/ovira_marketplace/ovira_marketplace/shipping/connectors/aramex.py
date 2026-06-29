import random

from frappe.utils import flt

from ovira_marketplace.shipping.connectors.base import ShippingConnector


class AramexConnector(ShippingConnector):
    """Aramex placeholder.

    Aramex uses SOAP web services (Shipping + Tracking). Until those are wired,
    this books an internal tracking number so the fulfilment flow works end to end;
    swap `create_shipment`/`track` for the real SOAP calls when credentials are ready.
    """

    provider = "Aramex"

    def rate(self, subtotal, governorate=None):
        free_over = flt(self.config.free_over)
        if free_over and flt(subtotal) >= free_over:
            return 0
        return flt(self.config.flat_rate)

    def create_shipment(self, shipment):
        # TODO: call Aramex CreateShipments SOAP endpoint and return the real AWB.
        return {
            "tracking_number": "ARX%09d" % random.randint(0, 999999999),
            "tracking_url": None,
            "label_url": None,
            "shipping_cost": flt(shipment.shipping_cost),
        }

    def track(self, tracking_number):
        # TODO: call Aramex TrackShipments SOAP endpoint.
        return []

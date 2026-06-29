class ShippingConnector:
    """Provider-neutral shipping interface. One subclass per carrier."""

    provider: str = ""

    def __init__(self, config):
        # `config` is the Shipping Provider doc.
        self.config = config

    def rate(self, subtotal, governorate=None):
        """Shipping fee for an order subtotal (and optionally a destination)."""
        raise NotImplementedError

    def create_shipment(self, shipment):
        """Book the shipment with the carrier.

        Returns {"tracking_number", "tracking_url", "label_url", "shipping_cost"}.
        """
        raise NotImplementedError

    def track(self, tracking_number):
        """Return a list of event dicts: {posted_at, status, description, location}."""
        return []

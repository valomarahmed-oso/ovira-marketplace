class PaymentConnector:
    """Provider-neutral payment interface. One subclass per gateway."""

    provider: str = ""

    def __init__(self, config):
        # `config` is the Payment Connector doc.
        self.config = config

    def initiate(self, order, return_url):
        """Start a payment for a Marketplace Order.

        Returns a dict with at least `method`, and `redirect_url` when the
        customer must be sent to a hosted/iframe payment page.
        """
        raise NotImplementedError

    def handle_callback(self, payload):
        """Process a gateway callback/webhook.

        Returns {"order": <name>, "success": bool, "reference": <str>}.
        """
        raise NotImplementedError

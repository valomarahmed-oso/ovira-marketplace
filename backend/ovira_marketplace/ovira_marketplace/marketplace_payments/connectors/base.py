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

    # Whether this gateway can send money back to the original instrument.
    supports_refund: bool = False

    def refund(self, transaction_id, amount):
        """Refund `amount` (in the order currency) against a captured payment.

        Returns {"ok": bool, "reference": <str|None>, "error": <str|None>}.
        Connectors that can't refund leave this alone: the default reports the
        limitation rather than raising, so the caller can fall back to store
        credit instead of failing the operator's action.
        """
        return {
            "ok": False,
            "reference": None,
            "error": "This gateway doesn't support automated refunds.",
        }

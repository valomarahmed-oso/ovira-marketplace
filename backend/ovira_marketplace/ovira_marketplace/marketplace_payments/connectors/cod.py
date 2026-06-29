from ovira_marketplace.marketplace_payments.connectors.base import PaymentConnector


class CashOnDeliveryConnector(PaymentConnector):
    provider = "Cash on Delivery"

    def initiate(self, order, return_url):
        # No gateway round-trip; the order stays Pending Payment until delivery.
        return {"method": "cod", "redirect_url": return_url}

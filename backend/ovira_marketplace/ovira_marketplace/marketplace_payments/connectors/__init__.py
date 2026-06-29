import frappe

from ovira_marketplace.marketplace_payments.connectors.cod import CashOnDeliveryConnector
from ovira_marketplace.marketplace_payments.connectors.paymob import PaymobConnector

REGISTRY = {
    CashOnDeliveryConnector.provider: CashOnDeliveryConnector,
    PaymobConnector.provider: PaymobConnector,
}


def get_connector(provider):
    """Return an initialised connector for an enabled provider, or None."""
    cls = REGISTRY.get(provider)
    if not cls:
        return None
    name = frappe.db.get_value("Payment Connector", {"provider": provider, "enabled": 1}, "name")
    if not name:
        return None
    return cls(frappe.get_doc("Payment Connector", name))

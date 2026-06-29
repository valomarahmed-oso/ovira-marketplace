import frappe

from ovira_marketplace.shipping.connectors.aramex import AramexConnector
from ovira_marketplace.shipping.connectors.bosta import BostaConnector
from ovira_marketplace.shipping.connectors.manual import ManualConnector

REGISTRY = {
    ManualConnector.provider: ManualConnector,
    BostaConnector.provider: BostaConnector,
    AramexConnector.provider: AramexConnector,
}


def get_shipping_connector(provider):
    """Return an initialised connector for an enabled provider, or None."""
    cls = REGISTRY.get(provider)
    if not cls:
        return None
    name = frappe.db.get_value("Shipping Provider", {"provider": provider, "enabled": 1}, "name")
    if not name:
        return None
    return cls(frappe.get_doc("Shipping Provider", name))


def default_provider():
    """The first enabled shipping provider (Manual preferred as a safe default)."""
    return (
        frappe.db.get_value("Shipping Provider", {"provider": "Manual", "enabled": 1}, "provider")
        or frappe.db.get_value("Shipping Provider", {"enabled": 1}, "provider")
    )

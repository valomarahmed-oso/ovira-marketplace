import frappe
import requests
from frappe.utils import flt

from ovira_marketplace.shipping.connectors.base import ShippingConnector

DEFAULT_BASE = "https://app.bosta.co/api/v2"


class BostaConnector(ShippingConnector):
    """Bosta (Egypt) integration. Verify endpoints/payloads against your Bosta
    business account on first deploy."""

    provider = "Bosta"

    def _base(self):
        return (self.config.base_url or DEFAULT_BASE).rstrip("/")

    def _headers(self):
        return {"Authorization": self.config.get_password("api_key") or "", "Content-Type": "application/json"}

    def rate(self, subtotal, governorate=None):
        # Bosta pricing is account-specific; fall back to the configured flat rate.
        free_over = flt(self.config.free_over)
        if free_over and flt(subtotal) >= free_over:
            return 0
        return flt(self.config.flat_rate)

    def create_shipment(self, shipment):
        payload = {
            "type": 10,
            "specs": {"packageType": "Parcel", "size": "SMALL"},
            "notes": shipment.marketplace_order,
            "cod": flt(shipment.shipping_cost) or 0,
            "dropOffAddress": {
                "city": shipment.governorate or "Cairo",
                "firstLine": shipment.address or "NA",
            },
            "receiver": {
                "fullName": shipment.recipient_name or "Ovira Customer",
                "phone": shipment.recipient_phone or "",
            },
        }
        res = requests.post(f"{self._base()}/deliveries", json=payload, headers=self._headers(), timeout=30)
        res.raise_for_status()
        data = res.json().get("data", res.json())
        tracking = data.get("trackingNumber") or data.get("_id")
        return {
            "tracking_number": tracking,
            "tracking_url": f"https://bosta.co/tracking-shipments?id={tracking}" if tracking else None,
            "label_url": data.get("awbUrl") or data.get("labelUrl"),
            "shipping_cost": flt(shipment.shipping_cost),
        }

    def track(self, tracking_number):
        try:
            res = requests.get(
                f"{self._base()}/deliveries/business/{tracking_number}",
                headers=self._headers(),
                timeout=30,
            )
            res.raise_for_status()
            data = res.json().get("data", res.json())
        except Exception:
            frappe.log_error(title="Ovira: Bosta tracking failed", message=frappe.get_traceback())
            return []

        events = []
        for ev in data.get("TransitEvents", []) or []:
            events.append(
                {
                    "posted_at": ev.get("timestamp"),
                    "status": ev.get("state") or ev.get("value"),
                    "description": ev.get("reason") or ev.get("state"),
                    "location": (ev.get("hub") or {}).get("name") if isinstance(ev.get("hub"), dict) else None,
                }
            )
        return events

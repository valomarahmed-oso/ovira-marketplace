import hashlib
import hmac

import frappe
import requests

from ovira_marketplace.payments.connectors.base import PaymentConnector

BASE = "https://accept.paymob.com/api"

# Fields, in the exact order Paymob concatenates them to build the HMAC.
HMAC_FIELDS = [
    "amount_cents",
    "created_at",
    "currency",
    "error_occured",
    "has_parent_transaction",
    "id",
    "integration_id",
    "is_3d_secure",
    "is_auth",
    "is_capture",
    "is_refunded",
    "is_standalone_payment",
    "is_voided",
    "order",
    "owner",
    "pending",
    "source_data.pan",
    "source_data.sub_type",
    "source_data.type",
    "success",
]


class PaymobConnector(PaymentConnector):
    provider = "Paymob"

    def initiate(self, order, return_url):
        api_key = self.config.get_password("api_key")
        amount_cents = int(round((order.total or 0) * 100))

        token = self._auth(api_key)
        paymob_order_id = self._register_order(token, amount_cents, order)
        payment_key = self._payment_key(token, amount_cents, paymob_order_id, order)
        iframe_id = self.config.iframe_id

        return {
            "method": "paymob",
            "redirect_url": f"{BASE}/acceptance/iframes/{iframe_id}?payment_token={payment_key}",
            "reference": str(paymob_order_id),
        }

    def handle_callback(self, payload):
        obj = payload.get("obj", payload)
        if not self._verify_hmac(payload):
            frappe.throw("Invalid Paymob HMAC.")
        success = str(obj.get("success")).lower() == "true"
        merchant_order = (obj.get("order") or {}).get("merchant_order_id") if isinstance(obj.get("order"), dict) else None
        return {
            "order": merchant_order or payload.get("merchant_order_id"),
            "success": success,
            "reference": str(obj.get("id") or ""),
        }

    # -- internal ----------------------------------------------------------

    def _auth(self, api_key):
        res = requests.post(f"{BASE}/auth/tokens", json={"api_key": api_key}, timeout=30)
        res.raise_for_status()
        return res.json()["token"]

    def _register_order(self, token, amount_cents, order):
        payload = {
            "auth_token": token,
            "delivery_needed": False,
            "amount_cents": amount_cents,
            "currency": order.currency or "EGP",
            "merchant_order_id": order.name,
            "items": [],
        }
        res = requests.post(f"{BASE}/ecommerce/orders", json=payload, timeout=30)
        res.raise_for_status()
        return res.json()["id"]

    def _payment_key(self, token, amount_cents, paymob_order_id, order):
        name_parts = (order.customer_name or "Ovira Customer").split(" ", 1)
        billing = {
            "first_name": name_parts[0] or "NA",
            "last_name": name_parts[1] if len(name_parts) > 1 else "NA",
            "phone_number": order.phone or "NA",
            "email": order.email or "na@ovira.shop",
            "street": order.shipping_address or "NA",
            "city": order.governorate or "NA",
            "country": "EG",
            "apartment": "NA", "floor": "NA", "building": "NA",
            "shipping_method": "NA", "postal_code": "NA", "state": "NA",
        }
        payload = {
            "auth_token": token,
            "amount_cents": amount_cents,
            "expiration": 3600,
            "order_id": paymob_order_id,
            "billing_data": billing,
            "currency": order.currency or "EGP",
            "integration_id": self.config.integration_id,
        }
        res = requests.post(f"{BASE}/acceptance/payment_keys", json=payload, timeout=30)
        res.raise_for_status()
        return res.json()["token"]

    def _verify_hmac(self, payload):
        received = payload.get("hmac")
        secret = self.config.get_password("hmac_secret")
        if not received or not secret:
            return False
        obj = payload.get("obj") or payload
        concatenated = "".join(str(_dig(obj, key)) for key in HMAC_FIELDS)
        digest = hmac.new(secret.encode(), concatenated.encode(), hashlib.sha512).hexdigest()
        return hmac.compare_digest(digest, received)


def _dig(obj, dotted):
    cur = obj
    for part in dotted.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return ""
    if isinstance(cur, bool):
        return "true" if cur else "false"
    return "" if cur is None else cur

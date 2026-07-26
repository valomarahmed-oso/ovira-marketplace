"""One customer barred from cash-on-delivery.

Keyed by phone or email. Phones are normalised to digits on save so the same
number can't slip through written a different way (+20 10…, 0020 10…, 010…).
"""

import frappe
from frappe.model.document import Document


def normalise_phone(value):
    """Digits only, with Egypt's local/international prefixes folded together so
    one person can't be three different entries."""
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if not digits:
        return ""
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("20") and len(digits) > 10:
        digits = digits[2:]
    return digits.lstrip("0")


class MarketplaceCODBlocklist(Document):
    def validate(self):
        value = (self.identifier or "").strip()
        if self.kind == "Email":
            self.identifier = value.lower()
        else:
            self.identifier = normalise_phone(value)
        if not self.identifier:
            frappe.throw(frappe._("أدخل رقم هاتف أو بريدًا صحيحًا."))

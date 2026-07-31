import frappe
from frappe.model.document import Document


# A loyalty programme gives back `earn_rate × redeem_value` of every pound spent.
# Real ones sit near 0.01 (1%); nobody runs 20%. Above this the numbers are not
# a generous promotion, they're a typo — and the typo is silent until customers
# start redeeming.
MAX_LOYALTY_GIVEBACK = 0.20


class MarketplaceSettings(Document):
    def validate(self):
        if self.default_commission_rate and self.default_commission_rate < 0:
            frappe.throw(frappe._("Default commission rate cannot be negative."))
        self._guard_loyalty_economics()

    def _guard_loyalty_economics(self):
        """Refuse a loyalty setup that hands back more than the store earns.

        `earn_rate` is points per unit of currency and `redeem_value` is currency
        per point, so their PRODUCT is the effective cash-back rate. Entering
        "100" in the redeem field — reading it as "100 points per pound" rather
        than "100 pounds per point" — is an easy mistake that turns a 90 EGP
        order into 9,000 EGP of store credit. Nothing downstream would notice:
        `redeem_points` simply multiplies and pays out.
        """
        from frappe.utils import flt

        if not self.loyalty_enabled:
            return
        giveback = flt(self.loyalty_earn_rate) * flt(self.loyalty_redeem_value)
        if giveback <= MAX_LOYALTY_GIVEBACK:
            return
        frappe.throw(
            frappe._(
                "These loyalty settings return {0}% of every purchase as store credit "
                "({1} points per {3}, each point worth {2} {3}). That is almost certainly "
                "a mistake: 'Point value' is how much ONE POINT is worth in money, not how "
                "many points make one unit of currency. For 1% cash back with an earn rate "
                "of {1}, set the point value to {4}."
            ).format(
                round(giveback * 100, 1),
                flt(self.loyalty_earn_rate),
                flt(self.loyalty_redeem_value),
                self.default_currency or "EGP",
                round(0.01 / flt(self.loyalty_earn_rate), 4) if flt(self.loyalty_earn_rate) else 0.01,
            ),
            title=frappe._("Check the loyalty point value"),
        )


def get_settings():
    """Cached accessor for the single Marketplace Settings doc."""
    return frappe.get_cached_doc("Marketplace Settings")


def is_multi_vendor():
    return get_settings().mode == "Multi Vendor"

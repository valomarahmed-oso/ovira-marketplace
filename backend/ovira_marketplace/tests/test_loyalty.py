"""Loyalty economics — the guard that stops a typo emptying the store.

`earn_rate` (points per unit of currency) times `redeem_value` (currency per
point) IS the cash-back rate. The live store had 1 x 100, so a 90 EGP order
minted 9,000 EGP of store credit and one shopper's balance was redeemable for
about 6.1 million. Nothing downstream noticed: `redeem_points` simply multiplies
and pays out.

Two guards, tested here: one refuses a bad rate going into Settings, the other
refuses a payout from a bad rate already sitting in the singleton.
"""

import pytest

from ovira_marketplace.api.loyalty import _guard_payout


def cfg(earn_rate=1.0, redeem_value=0.01):
    return {"earn_rate": earn_rate, "redeem_value": redeem_value}


class TestPayoutGuard:
    def test_a_sane_one_percent_programme_pays_out(self):
        # 9,000 points at 1 point per EGP is 9,000 EGP of spending; 90 EGP back.
        _guard_payout(points=9000, value=90.0, cfg=cfg())

    def test_paying_back_exactly_what_was_spent_is_allowed(self):
        # The boundary: generous to the point of absurd, but not arithmetic
        # nobody chose. The Settings guard is what stops a store configuring it.
        _guard_payout(points=100, value=100.0, cfg=cfg(earn_rate=1.0, redeem_value=1.0))

    def test_the_live_misconfiguration_is_refused(self):
        # 90 points from a 90 EGP order, valued at 100 EGP each.
        with pytest.raises(Exception):
            _guard_payout(points=90, value=9000.0, cfg=cfg(redeem_value=100))

    def test_the_six_million_case(self):
        with pytest.raises(Exception):
            _guard_payout(points=61016, value=6101600.0, cfg=cfg(redeem_value=100))

    def test_a_higher_earn_rate_shifts_the_boundary_correctly(self):
        # 10 points per EGP means 1,000 points is 100 EGP of spending.
        _guard_payout(points=1000, value=100.0, cfg=cfg(earn_rate=10, redeem_value=0.1))
        with pytest.raises(Exception):
            _guard_payout(points=1000, value=101.0, cfg=cfg(earn_rate=10, redeem_value=0.101))

    def test_no_earn_rate_means_nothing_to_compare_against(self):
        # Points granted by hand (goodwill, a promotion) have no spend behind
        # them; refusing those would break a legitimate use.
        _guard_payout(points=500, value=999999.0, cfg=cfg(earn_rate=0))


class TestSettingsGuard:
    """`MarketplaceSettings._guard_loyalty_economics` — the rate going IN."""

    def _settings(self, enabled=1, earn=1.0, redeem=0.01):
        from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
            MarketplaceSettings,
        )

        doc = MarketplaceSettings.__new__(MarketplaceSettings)
        doc.loyalty_enabled = enabled
        doc.loyalty_earn_rate = earn
        doc.loyalty_redeem_value = redeem
        doc.default_currency = "EGP"
        return doc

    def test_one_percent_is_accepted(self):
        self._settings(redeem=0.01)._guard_loyalty_economics()

    def test_five_percent_is_accepted(self):
        self._settings(redeem=0.05)._guard_loyalty_economics()

    def test_the_twenty_percent_ceiling_is_inclusive(self):
        self._settings(redeem=0.20)._guard_loyalty_economics()

    def test_above_the_ceiling_is_refused(self):
        with pytest.raises(Exception):
            self._settings(redeem=0.21)._guard_loyalty_economics()

    def test_the_live_typo_is_refused(self):
        with pytest.raises(Exception):
            self._settings(redeem=100)._guard_loyalty_economics()

    def test_a_disabled_programme_is_not_policed(self):
        # Nothing can be redeemed, so an odd stored value is harmless.
        self._settings(enabled=0, redeem=100)._guard_loyalty_economics()

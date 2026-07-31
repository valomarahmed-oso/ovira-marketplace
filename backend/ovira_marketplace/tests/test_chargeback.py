"""Who pays for a refund.

The owner's decision was "exactly like Amazon, including the administrative
percentage": the vendor bears the product cost and gets their commission back,
less a fee the operator keeps for handling the return. The clamp at the bottom is
the one that matters — without it a small refund against a large commission would
*pay* the vendor for accepting a return.
"""

from ovira_marketplace.vendor.chargeback import compute_chargeback

# 20% of the commission, uncapped — the store's shipped defaults.
DEFAULT = {"refund_admin_fee_percent": 20, "refund_admin_fee_cap": 0}
CAPPED = {"refund_admin_fee_percent": 20, "refund_admin_fee_cap": 15}
NO_FEE = {"refund_admin_fee_percent": 0, "refund_admin_fee_cap": 0}


class TestStandardSplit:
    def test_the_verified_live_case(self):
        # Refund 1000 against a 100 commission: fee 20, commission back 80,
        # vendor charged 920. Confirmed against the live booking in Phase 10e.
        out = compute_chargeback(1000, 100, DEFAULT)
        assert out == {
            "charged": 920.0,
            "commission_returned": 80.0,
            "admin_fee": 20.0,
            "commission": 100.0,
        }

    def test_the_three_numbers_reconcile(self):
        # charged + commission_returned == refund, always. If this drifts, the
        # operator is either absorbing money or double-charging the vendor.
        out = compute_chargeback(500, 60, DEFAULT)
        assert round(out["charged"] + out["commission_returned"], 2) == 500

    def test_fee_plus_returned_equals_the_original_commission(self):
        out = compute_chargeback(500, 60, DEFAULT)
        assert round(out["admin_fee"] + out["commission_returned"], 2) == 60


class TestFeeCap:
    def test_cap_limits_the_fee(self):
        # 20% of 100 would be 20; the cap holds it at 15.
        out = compute_chargeback(1000, 100, CAPPED)
        assert out["admin_fee"] == 15.0
        assert out["commission_returned"] == 85.0
        assert out["charged"] == 915.0

    def test_cap_above_the_fee_changes_nothing(self):
        assert compute_chargeback(1000, 50, CAPPED)["admin_fee"] == 10.0

    def test_zero_percent_means_the_whole_commission_goes_back(self):
        out = compute_chargeback(1000, 100, NO_FEE)
        assert out["admin_fee"] == 0.0
        assert out["commission_returned"] == 100.0


class TestClamp:
    def test_a_small_refund_never_pays_the_vendor(self):
        # Refund 50 against a 100 commission. Naively: 50 − 80 = −30, i.e. the
        # store would hand the vendor 30 EGP for taking goods back.
        out = compute_chargeback(50, 100, DEFAULT)
        assert out["charged"] == 0.0
        assert out["commission_returned"] == 50.0
        # The difference is kept as fee rather than vanishing.
        assert out["admin_fee"] == 50.0

    def test_zero_refund_charges_nothing(self):
        assert compute_chargeback(0, 100, DEFAULT)["charged"] == 0.0


class TestDefensive:
    def test_negative_commission_is_treated_as_none(self):
        out = compute_chargeback(200, -50, DEFAULT)
        assert out["commission"] == 0.0
        assert out["charged"] == 200.0

    def test_no_commission_charges_the_full_refund(self):
        assert compute_chargeback(200, 0, DEFAULT)["charged"] == 200.0

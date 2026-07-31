"""Seller trust: the blend, and the two denominators that were wrong.

Both denominator bugs were live and both flattered or punished a store unfairly.
Cancelled orders counted against fulfilment even when the BUYER cancelled, and
the return rate divided by completed orders only, though a return can be opened
as soon as the goods arrive.
"""

from ovira_marketplace.api.trust import (
    DECIDED_STATUSES,
    FULFILLED_STATUSES,
    RECEIVED_STATUSES,
    blend_score,
    rates,
    tier_for,
)


class TestWhichOrdersCount:
    """The status sets ARE the two denominator bugs. Assert them directly, so a
    future edit that puts Cancelled back has to argue with a test."""

    def test_cancelled_is_not_held_against_the_seller(self):
        # A buyer cancelling their own order is not the vendor failing to ship.
        assert "Cancelled" not in DECIDED_STATUSES

    def test_fulfilled_is_a_subset_of_decided(self):
        # Otherwise a rate above 100% is possible.
        assert set(FULFILLED_STATUSES) <= set(DECIDED_STATUSES)

    def test_a_return_counts_against_orders_that_reached_the_buyer(self):
        # Returns open from Shipped, not only from Completed — dividing by
        # completed alone inflated the rate.
        assert "Shipped" in RECEIVED_STATUSES and "Completed" in RECEIVED_STATUSES

    def test_pending_payment_counts_nowhere(self):
        # An order nobody has paid for says nothing about the seller.
        for statuses in (DECIDED_STATUSES, FULFILLED_STATUSES, RECEIVED_STATUSES):
            assert "Pending Payment" not in statuses


class TestRates:
    def test_no_history_has_no_fulfilment_rate(self):
        # None, not 0.0 — "we don't know yet" is not "they fail every order".
        fulfilment, _ = rates(decided=0, fulfilled=0, received=0, returns=0)
        assert fulfilment is None

    def test_perfect_record(self):
        fulfilment, returns = rates(decided=10, fulfilled=10, received=10, returns=0)
        assert (fulfilment, returns) == (1.0, 0.0)

    def test_return_rate_divides_by_orders_that_reached_the_buyer(self):
        # 3 returns over 16 delivered AND shipped orders. Dividing by completed
        # alone inflated every store's return rate.
        _, returns = rates(decided=22, fulfilled=16, received=16, returns=3)
        assert returns == 0.188

    def test_return_rate_cannot_exceed_one(self):
        # A buyer can open more than one return against an order; a badge reading
        # 150% would be nonsense.
        _, returns = rates(decided=5, fulfilled=5, received=2, returns=5)
        assert returns == 1.0

    def test_no_deliveries_means_no_return_rate(self):
        _, returns = rates(decided=3, fulfilled=0, received=0, returns=0)
        assert returns == 0.0


class TestBlendScore:
    def test_nothing_to_go_on_scores_zero(self):
        assert blend_score(0, 0, None, 0, has_orders=False) == 0.0

    def test_one_five_star_review_does_not_crown_a_store(self):
        # Rating weight ramps with volume: at one review it carries 1.05 against
        # the 2.5 the order signals carry, so a perfect rating on a mediocre
        # record cannot reach the top tier.
        thin = blend_score(5.0, 1, 0.7, 0.2, has_orders=True)
        assert thin < 4.5

    def test_the_same_rating_counts_for_more_with_volume(self):
        thin = blend_score(5.0, 1, 0.7, 0.2, has_orders=True)
        established = blend_score(5.0, 40, 0.7, 0.2, has_orders=True)
        assert established > thin

    def test_ratings_only_store_scores_its_rating(self):
        assert blend_score(4.0, 10, None, 0, has_orders=False) == 4.0

    def test_returns_pull_the_score_down(self):
        clean = blend_score(4.0, 10, 1.0, 0.0, has_orders=True)
        returning = blend_score(4.0, 10, 1.0, 0.5, has_orders=True)
        assert returning < clean


class TestTier:
    def test_a_brand_new_store_is_new_whatever_its_score(self):
        # Two orders and one review can't buy a "top seller" badge on day one.
        assert tier_for(5.0, orders_count=2, ratings_count=1) == "new"

    def test_established_and_excellent(self):
        assert tier_for(4.6, orders_count=50, ratings_count=20) == "top"

    def test_established_and_good(self):
        assert tier_for(4.1, orders_count=50, ratings_count=20) == "trusted"

    def test_established_and_middling(self):
        assert tier_for(3.2, orders_count=50, ratings_count=20) == "rising"

    def test_established_and_poor(self):
        assert tier_for(2.0, orders_count=50, ratings_count=20) == "new"

"""Peer comparison, and the two rules that keep it from lying.

A vendor dashboard reporting "AOV: 340 EGP" tells a seller nothing. The
comparison is what makes it a decision — and a badly built comparison is worse
than none, because it looks like information.
"""

from ovira_marketplace.api.benchmarks import _median, _percentile_rank, _standing


class TestMedian:
    def test_the_middle_of_an_odd_list(self):
        assert _median([10, 30, 20]) == 20

    def test_the_midpoint_of_an_even_list(self):
        assert _median([10, 20, 30, 40]) == 25

    def test_one_outlier_does_not_move_it(self):
        """Why the median and not the mean: one vendor with a 90,000 EGP order
        would drag an average somewhere no real seller lives."""
        ordinary = [100, 120, 110, 130]
        assert _median(ordinary + [90000]) == 120
        assert sum(ordinary + [90000]) / 5 > 18000  # what the mean would have said

    def test_nothing_to_compare_against(self):
        assert _median([]) is None


class TestPercentileRank:
    def test_best_in_the_group(self):
        assert _percentile_rank(500, [100, 200, 300]) == 100

    def test_worst_in_the_group(self):
        assert _percentile_rank(50, [100, 200, 300]) == 0

    def test_middle_of_the_group(self):
        assert _percentile_rank(200, [100, 200, 300]) == 67

    def test_no_peers_means_no_rank(self):
        assert _percentile_rank(100, []) is None


class TestStanding:
    def test_ahead_when_more_is_better(self):
        assert _standing(mine=500, median=100, higher_is_better=True) == "ahead"

    def test_behind_when_more_is_better(self):
        assert _standing(mine=50, median=100, higher_is_better=True) == "behind"

    def test_the_direction_flips_for_returns(self):
        """The metric that catches a naive implementation: a LOW return rate is
        good, and calling it "behind" would tell a seller to get worse."""
        assert _standing(mine=0.05, median=0.20, higher_is_better=False) == "ahead"
        assert _standing(mine=0.40, median=0.20, higher_is_better=False) == "behind"

    def test_near_the_median_is_typical_not_a_verdict(self):
        # Within 5%: telling a seller they are "behind" on a 1% difference is
        # noise dressed as feedback.
        assert _standing(mine=102, median=100, higher_is_better=True) == "typical"

    def test_unknown_without_a_median(self):
        assert _standing(mine=100, median=None, higher_is_better=True) == "unknown"

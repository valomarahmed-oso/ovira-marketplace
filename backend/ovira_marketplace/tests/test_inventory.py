"""The stock invariant: ERPNext actual − reserved == what the shop offers.

This is the arithmetic behind the worst bug in the audit — a shop selling 98 of
an item ERPNext held 1 of, and a per-branch table that never reached ERPNext at
all, so orders routed to a branch produced Sales Orders against warehouses
holding zero and no Delivery Note could ever be made.

The fixtures below are the real figures from demo.ovira.cloud.
"""

from ovira_marketplace.inventory import reconciliation_targets


def bins(**kwargs):
    """{"Stores - O": (actual, reserved)} → the shape `_bins` returns."""
    return {w.replace("_", " - "): {"actual": a, "reserved": r} for w, (a, r) in kwargs.items()}


class TestReservedUnits:
    def test_target_carries_the_reserved_quantity(self):
        # The shop offers 97 and ERPNext has 2 units spoken for by submitted
        # Sales Orders, so ERPNext must hold 99 — 97 available plus the 2 that
        # are already sold but not yet dispatched.
        assert reconciliation_targets(
            {"Stores - O": 97}, bins(Stores_O=(1, 2))
        ) == [("Stores - O", 99.0)]

    def test_a_warehouse_already_correct_is_left_alone(self):
        # 48 offered + 1 reserved == 49 actual. Nothing to post; a save that
        # changes nothing must not write a Stock Reconciliation.
        assert reconciliation_targets({"Stores - O": 48}, bins(Stores_O=(49, 1))) == []

    def test_ignoring_reserved_would_delete_an_open_order_s_stock(self):
        # Guard against the tempting simplification: if the target were the
        # offered figure alone, this would set actual to 97 and the two reserved
        # units would have nothing behind them.
        (_w, target), = reconciliation_targets({"Stores - O": 97}, bins(Stores_O=(1, 2)))
        assert target != 97


class TestMultiWarehouse:
    def test_the_branch_table_reaches_every_warehouse(self):
        # رواكول: 10 in Daqahliya, 9 in Cairo, 29 in Alexandria — while ERPNext
        # had the whole 49 sitting in one warehouse.
        wanted = {"Finished Goods - O": 10, "Stores - O": 9, "Goods In Transit - O": 29}
        current = bins(Stores_O=(49, 1), Goods_In_Transit_O=(0, 0))
        targets = dict(reconciliation_targets(wanted, current))
        assert targets["Finished Goods - O"] == 10.0
        assert targets["Goods In Transit - O"] == 29.0
        assert targets["Stores - O"] == 10.0  # 9 offered + 1 reserved

    def test_available_after_reconciliation_equals_what_the_shop_offers(self):
        # The invariant itself, stated as a test.
        wanted = {"Finished Goods - O": 10, "Stores - O": 9, "Goods In Transit - O": 29}
        current = bins(Stores_O=(49, 1), Goods_In_Transit_O=(0, 0))
        targets = dict(reconciliation_targets(wanted, current))
        for warehouse, offered in wanted.items():
            reserved = current.get(warehouse, {}).get("reserved", 0)
            actual = targets.get(warehouse, current.get(warehouse, {}).get("actual", 0))
            assert actual - reserved == offered


class TestStrandedStock:
    def test_a_warehouse_the_shop_no_longer_names_is_emptied(self):
        # Deleting a branch row must pull its stock back out, or those units are
        # invisible inventory nothing can sell.
        assert reconciliation_targets({"Stores - O": 5}, bins(Stores_O=(5, 0), Old_O=(12, 0))) == [
            ("Old - O", 0.0)
        ]

    def test_stranded_stock_with_reservations_keeps_them(self):
        # Even a retired warehouse must still carry what an open order claims.
        assert reconciliation_targets({}, bins(Old_O=(12, 3))) == [("Old - O", 3.0)]


class TestEdges:
    def test_nothing_anywhere_posts_nothing(self):
        assert reconciliation_targets({}, {}) == []

    def test_a_brand_new_item_is_received_in_full(self):
        assert reconciliation_targets({"Stores - O": 6}, {}) == [("Stores - O", 6.0)]

    def test_selling_out_sets_the_warehouse_to_zero(self):
        assert reconciliation_targets({"Stores - O": 0}, bins(Stores_O=(4, 0))) == [
            ("Stores - O", 0.0)
        ]

    def test_output_is_ordered_so_the_document_is_reproducible(self):
        targets = reconciliation_targets(
            {"C - O": 1, "A - O": 1, "B - O": 1}, {}
        )
        assert [w for w, _ in targets] == ["A - O", "B - O", "C - O"]

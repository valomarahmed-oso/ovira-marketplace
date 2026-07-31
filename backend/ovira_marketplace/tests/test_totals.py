"""What the customer is charged.

The order of operations is the substance here: discounts before tax, store credit
after it. Getting that wrong doesn't crash anything — it just quietly bills the
wrong number, which is the failure mode this whole suite exists for.
"""

from ovira_marketplace.totals import goods_total, order_total, payable, wallet_to_spend


class TestGoodsTotal:
    def test_both_coupon_kinds_reduce_the_goods(self):
        # Operator- and vendor-funded coupons differ in who PAYS for them, not in
        # what the shopper sees.
        assert goods_total(1000, discount=100, vendor_discount=50) == 850

    def test_never_negative(self):
        # A coupon worth more than the cart must not turn into a credit.
        assert goods_total(50, discount=200) == 0


class TestOrderTotal:
    def test_plain_order(self):
        assert order_total(subtotal=200, shipping=50) == 250

    def test_inclusive_tax_adds_nothing(self):
        # The Egyptian retail norm, and the store's live configuration: the price
        # already contains the VAT, so disclosing it must not change the charge.
        assert order_total(subtotal=90, shipping=0, extra_tax=0) == 90

    def test_exclusive_tax_is_added(self):
        # The trap this guards: ERPNext would add an exclusive tax downstream, so
        # if the order didn't add it too, the invoice would exceed what the
        # shopper approved at checkout.
        assert order_total(subtotal=90, shipping=10, extra_tax=12.6) == 112.6

    def test_store_credit_comes_off_last(self):
        # 1000 goods − 100 coupon = 900, + 50 shipping = 950, − 200 credit.
        assert order_total(
            subtotal=1000, shipping=50, discount=100, wallet_applied=200
        ) == 750

    def test_credit_covering_everything_leaves_zero_not_a_negative(self):
        assert order_total(subtotal=100, shipping=20, wallet_applied=500) == 0

    def test_tax_is_charged_before_credit_is_spent(self):
        # Applying credit first would compute tax on money the customer never
        # spent — and under-collect the VAT the store owes.
        with_credit = order_total(subtotal=100, extra_tax=14, wallet_applied=50)
        assert with_credit == 64  # 100 + 14 − 50, not (100 − 50) + 7


class TestWalletToSpend:
    def test_capped_at_the_balance(self):
        assert wallet_to_spend(balance=30, due=500) == 30

    def test_capped_at_what_is_owed(self):
        # Spending more credit than the order costs would hand the difference to
        # the customer as change.
        assert wallet_to_spend(balance=500, due=30) == 30

    def test_nothing_to_spend_on_a_free_order(self):
        assert wallet_to_spend(balance=500, due=0) == 0

    def test_negative_balance_spends_nothing(self):
        assert wallet_to_spend(balance=-10, due=100) == 0


class TestPayable:
    def test_sums_the_three_parts(self):
        assert payable(goods=100, shipping=25, extra_tax=14) == 139

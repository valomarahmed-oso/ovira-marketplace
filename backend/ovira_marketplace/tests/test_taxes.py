"""VAT, inclusive and exclusive.

The live store runs an INCLUSIVE 14% template, which is why a 90 EGP item posted
78.95 to revenue and 11.05 to VAT and looked to the owner like money going
missing. Nothing was missing — but nothing said so either. These lock in both the
split and, more importantly, which of the two modes moves the total.
"""

from ovira_marketplace.taxes import split

INCLUSIVE = {"rate": 0.14, "inclusive": True, "label": "VAT 14%"}
EXCLUSIVE = {"rate": 0.14, "inclusive": False, "label": "VAT 14%"}
NO_TAX = {"rate": 0.0, "inclusive": False, "label": None}


class TestInclusive:
    def test_the_case_the_owner_reported(self):
        # Exactly the General Ledger figures from demo.ovira.cloud.
        assert split(90, INCLUSIVE) == (78.95, 11.05)

    def test_net_and_tax_add_back_to_the_price(self):
        # The invariant that makes "inclusive" mean anything: the customer pays
        # the shelf price, and the tax is carved out of it.
        net, tax = split(250, INCLUSIVE)
        assert round(net + tax, 2) == 250

    def test_larger_amount(self):
        net, tax = split(1140, INCLUSIVE)
        assert (net, tax) == (1000.0, 140.0)


class TestExclusive:
    def test_tax_sits_on_top(self):
        assert split(100, EXCLUSIVE) == (100.0, 14.0)

    def test_net_is_unchanged_by_the_tax(self):
        net, _tax = split(90, EXCLUSIVE)
        assert net == 90


class TestEdges:
    def test_no_template_configured_means_no_tax(self):
        assert split(90, NO_TAX) == (90.0, 0.0)

    def test_zero_amount(self):
        assert split(0, INCLUSIVE) == (0.0, 0.0)

    def test_negative_amount_is_not_taxed(self):
        # Defensive: a negative goods total is a bug elsewhere, but it must not
        # produce a negative tax line on an invoice.
        net, tax = split(-50, INCLUSIVE)
        assert tax == 0.0

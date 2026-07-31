"""Sales tax, computed where the customer can actually see it.

The marketplace used to know nothing about tax. `Marketplace Order` carried no
tax field, checkout showed no tax line, and the invoice the buyer downloaded had
none — the first and only place VAT appeared was the ERPNext Sales Invoice,
because `MarketplaceOrder._make_sales_order` attaches the configured Sales Taxes
and Charges Template. That left two problems:

1. **An inclusive template looked like money going missing.** A 90 EGP item posts
   78.95 to revenue and 11.05 to the VAT account, and nothing told the operator —
   or the customer — that the 90 already contained the tax.
2. **An exclusive template silently overcharges.** ERPNext would add the tax on
   top, so the Sales Invoice grand total exceeded the `Marketplace Order.total`
   the shopper agreed to at checkout, and vendor settlement drifted with it.

So the rate is read from the same template ERPNext will use, applied here, and
recorded on the order: inclusive tax is *disclosed* without changing the total,
exclusive tax is *added* to it. Either way the number the shopper approves and
the number the invoice bills are the same number.
"""

import frappe
from frappe.utils import cint, flt


def sales_tax_profile(settings=None):
    """The store's effective sales tax: ``{"rate", "inclusive", "label", "template"}``.

    `rate` is a fraction (0.14 for 14%), summed over the template's proportional
    rows — the same rows ERPNext will apply to the Sales Order. Absolute
    ("Actual") rows are ignored here: they are per-document charges like
    shipping, not a rate on the goods.
    """
    empty = {"rate": 0.0, "inclusive": False, "label": None, "template": None}
    try:
        settings = settings or frappe.get_cached_doc("Marketplace Settings")
    except Exception:
        return empty

    template = settings.get("sales_tax_template") or frappe.db.get_value(
        "Sales Taxes and Charges Template",
        {"company": settings.get("operator_company"), "is_default": 1},
        "name",
    )
    if not template:
        return empty

    rows = frappe.get_all(
        "Sales Taxes and Charges",
        filters={"parent": template, "parenttype": "Sales Taxes and Charges Template"},
        fields=["charge_type", "rate", "included_in_print_rate", "description"],
        ignore_permissions=True,
    )
    rate = 0.0
    inclusive = False
    label = None
    for r in rows:
        if r.get("charge_type") not in ("On Net Total", "On Previous Row Total", "On Total"):
            continue
        rate += flt(r.get("rate")) / 100.0
        inclusive = inclusive or bool(cint(r.get("included_in_print_rate")))
        label = label or (r.get("description") or None)
    if rate <= 0:
        return empty
    return {"rate": rate, "inclusive": inclusive, "label": label, "template": template}


def split(amount, profile=None):
    """Break `amount` into ``(net, tax)`` under the store's tax profile.

    Inclusive: the tax is carved OUT of the amount (90 → 78.95 + 11.05).
    Exclusive: the tax sits ON TOP (90 → 90 + 12.60).
    """
    profile = profile or sales_tax_profile()
    rate = flt(profile.get("rate"))
    amount = flt(amount)
    if rate <= 0 or amount <= 0:
        return round(amount, 2), 0.0
    if profile.get("inclusive"):
        net = amount / (1 + rate)
        return round(net, 2), round(amount - net, 2)
    return round(amount, 2), round(amount * rate, 2)


def apply_order_tax(order, goods_total, settings=None):
    """Record the tax on a Marketplace Order and return what to ADD to its total.

    Returns 0.0 for an inclusive template — the price already contains the tax,
    so the shopper pays exactly what the cart said — and the tax amount for an
    exclusive one, which the caller must add before charging.
    """
    profile = sales_tax_profile(settings)
    net, tax = split(goods_total, profile)
    order.tax_rate = round(flt(profile["rate"]) * 100, 4)
    order.tax_inclusive = 1 if profile.get("inclusive") else 0
    order.tax_label = profile.get("label") or None
    order.tax_amount = tax
    order.net_total = net
    return 0.0 if profile.get("inclusive") else tax

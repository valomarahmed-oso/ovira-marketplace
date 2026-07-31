"""The arithmetic that decides what a customer is charged.

Lifted out of `checkout.place_order` deliberately. That function resolves
products, prices variants, routes warehouses, screens for fraud and books an
order — and somewhere in the middle of it sat the one line that says how much
money to take. A number that important should be readable, and provable, without
a database and a cart.

Order of operations, which is the whole point:

1. **Discounts come off the goods.** A coupon reduces what is being sold, not the
   shipping and not the tax base afterwards.
2. **Tax is computed on the discounted goods.** Inclusive tax is already inside
   the prices and adds nothing; exclusive tax is added.
3. **Store credit comes off last**, capped at what is still payable. It is a
   payment, not a discount — applying it before tax would have the customer pay
   tax on money they didn't spend.
"""

from frappe.utils import flt


def payable(goods, shipping=0.0, extra_tax=0.0):
    """What the customer owes before any store credit is spent."""
    return flt(goods) + flt(shipping) + flt(extra_tax)


def goods_total(subtotal, discount=0.0, vendor_discount=0.0):
    """Value of the items after both kinds of coupon, floored at zero.

    Operator-funded and vendor-funded discounts both reduce the goods; they
    differ only in who pays for them (see `create_vendor_orders`), which is a
    settlement question, not a pricing one.
    """
    return max(0.0, flt(subtotal) - flt(discount) - flt(vendor_discount))


def wallet_to_spend(balance, due):
    """How much store credit this order can absorb: never more than the balance,
    never more than is owed, never negative."""
    return max(0.0, min(flt(balance), flt(due)))


def order_total(subtotal, shipping=0.0, discount=0.0, vendor_discount=0.0,
                extra_tax=0.0, wallet_applied=0.0):
    """The final charge. Floored at zero — store credit covering the whole order
    means the customer pays nothing, never that the store owes them."""
    goods = goods_total(subtotal, discount, vendor_discount)
    return max(0.0, payable(goods, shipping, extra_tax) - flt(wallet_applied))

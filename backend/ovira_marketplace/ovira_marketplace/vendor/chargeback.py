"""Charge a refund back to the vendor who caused it — the Amazon model.

`settlement.py` credits a vendor's Supplier payable when an order is paid. When
that sale is later refunded because of the *vendor's* fault, this module books
the mirror image: the vendor's payable is debited, so the money comes out of
their next payout instead of the operator's pocket.

The split follows how the large marketplaces do it:

    charged back to vendor = refunded amount − commission returned
    commission returned    = original commission − administration fee
    administration fee     = min(cap, percent% × original commission)

So the vendor bears the product cost and gets their commission back, less a fee
the operator keeps for handling the return. Amazon's classic figure is 20% of
the referral fee capped at a small absolute amount; both are operator-settable
in `Marketplace Settings` because the numbers differ by market and category.

**Fault decides everything.** Only `fault = "Vendor"` charges the seller. A
store error or a goodwill gesture is absorbed by the operator, because charging
a vendor for the operator's own mistake or apology is indefensible — and it is
what drives sellers off a marketplace.

Every booking is **idempotent** (one Journal Entry per return, keyed by remark)
and **best-effort**: a GL hiccup is logged and never blocks the refund the
customer is owed.
"""

import frappe
from frappe.utils import flt, nowdate

from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)

RETURN_DT = "Marketplace Return"


def _remark(return_name):
    return f"Ovira vendor refund chargeback | return {return_name}"


def order_vendor_commission(order_name):
    """(vendor, commission, sales_order) for the order's vendor lines.

    Returns the single vendor when the order has exactly one — a chargeback needs
    an unambiguous party. A multi-vendor order returns (None, ...) and is left to
    the operator, because an order-level refund amount can't be apportioned
    across sellers without item detail.
    """
    rows = frappe.get_all(
        "Marketplace Order Item",
        filters={"parent": order_name},
        fields=["vendor", "commission_amount", "sales_order"],
        ignore_permissions=True,
    )
    vendors = {r.vendor for r in rows if r.vendor}
    if len(vendors) != 1:
        return None, 0.0, None
    vendor = vendors.pop()
    commission = sum(flt(r.commission_amount) for r in rows)
    sales_order = next((r.sales_order for r in rows if r.sales_order), None)
    return vendor, commission, sales_order


def compute_chargeback(refund_amount, commission, settings=None):
    """The three numbers, with no side effects — so the admin screen can preview
    exactly what booking would do before anyone commits."""
    settings = settings or get_settings()
    refund_amount = flt(refund_amount)
    commission = max(0.0, flt(commission))

    percent = flt(settings.get("refund_admin_fee_percent"))
    cap = flt(settings.get("refund_admin_fee_cap"))
    fee = commission * (percent / 100.0) if percent > 0 else 0.0
    if cap > 0:
        fee = min(fee, cap)
    fee = min(fee, commission)  # never keep more than was charged

    commission_returned = commission - fee
    # The vendor keeps nothing of the sale but is handed back their commission,
    # so the net debit is the refund less what we return.
    charged = refund_amount - commission_returned
    if charged < 0:
        # A refund smaller than the returned commission would otherwise *pay* the
        # vendor for a return. Clamp, and keep the difference as fee.
        commission_returned = refund_amount
        fee = commission - commission_returned
        charged = 0.0

    return {
        "charged": round(charged, 2),
        "commission_returned": round(commission_returned, 2),
        "admin_fee": round(fee, 2),
        "commission": round(commission, 2),
    }


def preview(doc):
    """What a chargeback for this return would look like, plus why not if it
    wouldn't happen at all."""
    settings = get_settings()
    refund = flt(doc.get("refund_amount"))
    if refund <= 0:
        return {"applies": False, "reason": "no_refund"}
    # Single Company mode has no third-party seller to charge back — the store
    # would be billing itself for its own refund. See settlement._splits_revenue.
    if (settings.get("mode") or "Multi Vendor") != "Multi Vendor":
        return {"applies": False, "reason": "single_company"}
    if not settings.get("refund_charge_vendor"):
        return {"applies": False, "reason": "disabled"}
    if (doc.get("fault") or "Vendor") != "Vendor":
        return {"applies": False, "reason": "not_vendor_fault"}

    vendor, commission, _so = order_vendor_commission(doc.get("marketplace_order"))
    if not vendor:
        return {"applies": False, "reason": "multi_vendor"}

    numbers = compute_chargeback(refund, commission, settings)
    numbers.update({"applies": True, "vendor": vendor})
    return numbers


def book_chargeback(doc):
    """Debit the vendor's payable for a vendor-fault refund.

    Mirrors `settlement._settle_sub_order`: that credits the Supplier payable and
    debits expense; this does the reverse for the charged-back amount. Returns
    the Journal Entry name, or None when no chargeback applies.
    """
    try:
        info = preview(doc)
        if not info.get("applies") or flt(info.get("charged")) <= 0:
            return None

        remark = _remark(doc.name)
        if frappe.db.exists("Journal Entry", {"user_remark": remark, "docstatus": 1}):
            return None  # already charged back

        vendor = info["vendor"]
        supplier = frappe.db.get_value("Marketplace Vendor", vendor, "supplier")
        if not supplier:
            return None

        _v, _c, sales_order = order_vendor_commission(doc.marketplace_order)
        company = (
            frappe.db.get_value("Sales Order", sales_order, "company") if sales_order else None
        ) or get_settings().get("operator_company")
        if not company:
            return None

        expense = frappe.db.get_value("Company", company, "default_expense_account")
        payable = frappe.db.get_value("Company", company, "default_payable_account")
        cost_center = frappe.db.get_value("Company", company, "cost_center") or frappe.db.get_value(
            "Cost Center", {"company": company, "is_group": 0}, "name"
        )
        if not (expense and payable):
            return None

        charged = flt(info["charged"])
        je = frappe.new_doc("Journal Entry")
        je.company = company
        je.posting_date = nowdate()
        je.user_remark = remark
        # Dr the vendor's payable (reduces what we owe them) …
        je.append(
            "accounts",
            {
                "account": payable,
                "debit_in_account_currency": charged,
                "party_type": "Supplier",
                "party": supplier,
                "cost_center": cost_center,
            },
        )
        # … Cr expense, reversing the payout expense booked at settlement.
        je.append(
            "accounts",
            {"account": expense, "credit_in_account_currency": charged, "cost_center": cost_center},
        )
        je.flags.ignore_permissions = True
        je.insert()
        je.submit()

        frappe.db.set_value(
            RETURN_DT,
            doc.name,
            {
                "vendor_charged": charged,
                "commission_returned": flt(info["commission_returned"]),
                "admin_fee": flt(info["admin_fee"]),
                "chargeback_entry": je.name,
            },
            update_modified=False,
        )
        frappe.db.commit()
        return je.name
    except Exception:
        # The customer keeps their refund either way — that is the point of
        # doing this after the wallet credit. But a chargeback that doesn't book
        # is money the OPERATOR absorbs for a fault that was the vendor's, so it
        # has to stay visible until someone deals with it.
        from ovira_marketplace.failures import DEFERRABLE, guard

        with guard("vendor refund chargeback", DEFERRABLE, ref=getattr(doc, "name", None)):
            raise
        return None

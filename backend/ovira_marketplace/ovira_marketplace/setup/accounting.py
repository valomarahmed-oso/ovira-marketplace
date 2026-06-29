"""Accounting setup helpers for Ovira Marketplace.

Run on the bench with:
    bench --site <site> execute ovira_marketplace.setup.accounting.setup_egypt_vat
"""

import frappe


def setup_egypt_vat(company=None, rate=14.0, inclusive=True):
    """Idempotently create an Egypt VAT output-tax account + an *inclusive*
    Sales Taxes and Charges Template, and point Marketplace Settings at it.

    Inclusive means the listed price already contains the VAT (what the shopper
    sees is what they pay), matching Egyptian retail. Returns a summary.
    """
    settings = frappe.get_single("Marketplace Settings")
    company = company or settings.operator_company
    if not company:
        return {"error": "No operator company configured."}

    abbr = frappe.db.get_value("Company", company, "abbr")
    account = _ensure_vat_account(company, abbr, rate)
    if not account:
        return {"error": "Could not resolve a parent tax group account."}
    template = _ensure_vat_template(company, abbr, account, rate, inclusive)

    if settings.get("sales_tax_template") != template:
        settings.db_set("sales_tax_template", template)
    frappe.db.commit()

    summary = {"company": company, "account": account, "template": template,
               "rate": rate, "inclusive": inclusive}
    print("VAT_SETUP:", frappe.as_json(summary))
    return summary


def _ensure_vat_account(company, abbr, rate):
    name = f"VAT {rate:g}% - {abbr}"
    if frappe.db.exists("Account", name):
        return name

    parent = frappe.db.get_value(
        "Account", {"company": company, "account_name": "Duties and Taxes", "is_group": 1}, "name"
    )
    if not parent:
        # Fall back to the parent group of any existing tax account.
        existing = frappe.db.get_value(
            "Account", {"company": company, "account_type": "Tax", "is_group": 0}, "name"
        )
        parent = frappe.db.get_value("Account", existing, "parent_account") if existing else None
    if not parent:
        return None

    acc = frappe.new_doc("Account")
    acc.account_name = f"VAT {rate:g}%"
    acc.company = company
    acc.parent_account = parent
    acc.account_type = "Tax"
    acc.root_type = "Liability"
    acc.tax_rate = rate
    acc.insert(ignore_permissions=True)
    return acc.name


def _ensure_vat_template(company, abbr, account, rate, inclusive):
    title = f"Ovira VAT {rate:g}%"
    name = f"{title} - {abbr}"
    if frappe.db.exists("Sales Taxes and Charges Template", name):
        return name

    template = frappe.new_doc("Sales Taxes and Charges Template")
    template.title = title
    template.company = company
    template.append(
        "taxes",
        {
            "charge_type": "On Net Total",
            "account_head": account,
            "rate": rate,
            "included_in_print_rate": 1 if inclusive else 0,
            "description": f"VAT {rate:g}%",
        },
    )
    template.insert(ignore_permissions=True)
    return template.name

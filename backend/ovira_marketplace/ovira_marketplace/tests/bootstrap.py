"""Prepare a Frappe site for the integration suite — reproducibly, as code.

The alternative is a wiki page of `bench` incantations that rots, and a test run
that fails on a fresh site for reasons nobody can reconstruct. This is the
environment, versioned next to the tests that need it.

Run once against a throwaway site::

    bench --site <test-site> execute \\
        ovira_marketplace.tests.bootstrap.prepare_test_site

Idempotent: every step checks whether it has already happened, so re-running it
after a `migrate` costs nothing and repairs anything that was lost.

**Never point this at a real site.** It writes Marketplace Settings and creates a
company. `prepare_test_site` refuses to run on a site whose name doesn't look
like a test site, because the one thing worse than no test environment is a test
that reconfigures production.
"""

import frappe

COMPANY = "Ovira Test"
ABBR = "OT"
CURRENCY = "EGP"
TAX_TEMPLATE = "Ovira Test VAT 14%"
VAT_RATE = 14.0


def _is_test_site():
    name = (frappe.local.site or "").lower()
    return "test" in name or name.endswith(".local") or name.endswith(".localhost")


def prepare_test_site(force=False):
    """Bring a bare site up to the state the integration tests assume."""
    if not (force or _is_test_site()):
        frappe.throw(
            "Refusing to bootstrap %r — this rewrites Marketplace Settings and creates a "
            "company. Point it at a throwaway site whose name contains 'test'." % frappe.local.site
        )
    steps = [
        ("company", _ensure_company),
        ("tax template", _ensure_tax_template),
        ("marketplace settings", _ensure_settings),
    ]
    done = {}
    for label, step in steps:
        done[label] = step()
        frappe.db.commit()
    return done


def _ensure_company():
    """Run ERPNext's setup wizard once, for the accounts/warehouses/groups the
    marketplace books against."""
    if frappe.db.exists("Company", COMPANY):
        return "already present"
    from erpnext.setup.setup_wizard.setup_wizard import setup_complete

    # A plain dict is not enough: install_fixtures reads `args.fy_start_date`
    # attribute-style, so the wizard needs frappe's dotted dict.
    setup_complete(
        frappe._dict(
            {
                "currency": CURRENCY,
                "full_name": "Test Admin",
                "email": "admin@ovira.test",
                "company_name": COMPANY,
                "company_abbr": ABBR,
                "company_tagline": "integration tests",
                "chart_of_accounts": "Standard",
                "country": "Egypt",
                "timezone": "Africa/Cairo",
                "language": "English",
                "fy_start_date": "2026-01-01",
                "fy_end_date": "2026-12-31",
            }
        )
    )
    return "created"


def _ensure_tax_template():
    """An INCLUSIVE VAT template, because that is what the live store runs and
    the inclusive/exclusive distinction is the one the tax tests are about."""
    name = "%s - %s" % (TAX_TEMPLATE, ABBR)
    if frappe.db.exists("Sales Taxes and Charges Template", name):
        return "already present"
    account = _ensure_vat_account()
    if not account:
        return "skipped: no VAT account"
    doc = frappe.new_doc("Sales Taxes and Charges Template")
    doc.title = TAX_TEMPLATE
    doc.company = COMPANY
    doc.append(
        "taxes",
        {
            "charge_type": "On Net Total",
            "account_head": account,
            "description": "VAT %g%%" % VAT_RATE,
            "rate": VAT_RATE,
            "included_in_print_rate": 1,
        },
    )
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    return "created"


def _ensure_vat_account():
    name = "VAT %g%% - %s" % (VAT_RATE, ABBR)
    if frappe.db.exists("Account", name):
        return name
    parent = frappe.db.get_value(
        "Account", {"company": COMPANY, "account_type": "Tax", "is_group": 1}, "name"
    ) or frappe.db.get_value(
        "Account", {"company": COMPANY, "root_type": "Liability", "is_group": 1}, "name"
    )
    if not parent:
        return None
    doc = frappe.new_doc("Account")
    doc.account_name = "VAT %g%%" % VAT_RATE
    doc.company = COMPANY
    doc.parent_account = parent
    doc.account_type = "Tax"
    doc.root_type = "Liability"
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    return doc.name


def _ensure_settings():
    """Point the marketplace at the test company. Written through the Singles
    row + a cache clear, since `get_settings` reads a cached doc."""
    warehouse = frappe.db.get_value(
        "Warehouse", {"company": COMPANY, "is_group": 0}, "name"
    )
    values = {
        "mode": "Multi Vendor",
        "operator_company": COMPANY,
        "default_currency": CURRENCY,
        "default_language": "ar",
        "default_commission_rate": 10,
        "sales_tax_template": "%s - %s" % (TAX_TEMPLATE, ABBR),
        "default_warehouse": warehouse,
        "auto_approve_products": 1,
        "auto_approve_vendors": 1,
        # Sane loyalty economics, so the guard doesn't reject a test save.
        "loyalty_enabled": 1,
        "loyalty_earn_rate": 1,
        "loyalty_redeem_value": 0.01,
    }
    for field, value in values.items():
        if value is not None:
            frappe.db.set_single_value("Marketplace Settings", field, value)
    frappe.clear_cache(doctype="Marketplace Settings")
    return values

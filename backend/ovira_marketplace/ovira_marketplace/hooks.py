app_name = "ovira_marketplace"
app_title = "Ovira Marketplace"
app_publisher = "Ovira"
app_description = "Multi-vendor marketplace for ERPNext, with single-company mode."
app_email = "gamalabaualsaad29@gmail.com"
app_license = "MIT"
required_apps = ["erpnext"]

# ---------------------------------------------------------------------------
# Installation
# ---------------------------------------------------------------------------
before_install = "ovira_marketplace.setup.install.before_install"
after_install = "ovira_marketplace.setup.install.after_install"

# Seed/repair settings after the schema sync (DocTypes don't exist yet at
# after_install time on a fresh install). Idempotent.
after_migrate = "ovira_marketplace.setup.install.after_migrate"

# ---------------------------------------------------------------------------
# Fixtures (roles, custom fields, default settings) shipped with the app
# ---------------------------------------------------------------------------
# fixtures = ["Role", "Custom Field", "Workflow"]

# ---------------------------------------------------------------------------
# Document events: keep marketplace records in sync with ERPNext core
# ---------------------------------------------------------------------------
# doc_events = {
#     "Item": {
#         "on_update": "ovira_marketplace.marketplace.sync.on_item_update",
#     },
#     "Sales Invoice": {
#         "on_submit": "ovira_marketplace.vendor.settlement.on_invoice_submit",
#     },
# }

# ---------------------------------------------------------------------------
# Scheduled jobs: settlements, payout runs, search reindex
# ---------------------------------------------------------------------------
# scheduler_events = {
#     "daily": ["ovira_marketplace.vendor.settlement.run_due_payouts"],
#     "cron": {"*/15 * * * *": ["ovira_marketplace.marketplace.search.reindex_dirty"]},
# }

# ---------------------------------------------------------------------------
# Multi-vendor isolation: a vendor only sees their own store and products
# ---------------------------------------------------------------------------
permission_query_conditions = {
    "Marketplace Product": "ovira_marketplace.permissions.product_query",
    "Marketplace Vendor": "ovira_marketplace.permissions.vendor_query",
    "Marketplace Vendor Expense": "ovira_marketplace.permissions.expense_query",
}

has_permission = {
    "Marketplace Product": "ovira_marketplace.permissions.product_has_permission",
}

# ---------------------------------------------------------------------------
# Storefront REST API namespace: ovira_marketplace.api.*
# ---------------------------------------------------------------------------
# override_whitelisted_methods = {}

# ---------------------------------------------------------------------------
# Website / storefront routing (server-rendered fallback; Next.js is primary)
# ---------------------------------------------------------------------------
# website_route_rules = []

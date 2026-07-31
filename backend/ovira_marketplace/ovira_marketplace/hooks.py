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
scheduler_events = {
    # Every 15 minutes: retry notifications whose backoff has elapsed, and pick up
    # any queued row whose worker was lost to a restart (see notifications/).
    "cron": {
        "*/15 * * * *": [
            "ovira_marketplace.notifications.dispatch.retry_pending",
        ],
    },
    "hourly": [
        "ovira_marketplace.api.abandoned_cart.sweep_abandoned_carts",
    ],
    "daily": [
        "ovira_marketplace.api.trust.recompute_all_vendor_trust",
        "ovira_marketplace.api.stock_alerts.sweep_back_in_stock",
        # Push any product whose ERPNext quantity has drifted from the shop back
        # into line. Posts nothing when everything already agrees.
        "ovira_marketplace.inventory.reconcile_all_products",
        # Time-triggered notifications: a review request is caused by days
        # passing, and low stock is a condition worth one digest a day.
        "ovira_marketplace.notifications.sweeps.request_reviews",
        "ovira_marketplace.notifications.sweeps.warn_low_stock",
        "ovira_marketplace.notifications.sweeps.watch_price_drops",
        "ovira_marketplace.notifications.sweeps.warn_expiring_points",
        "ovira_marketplace.notifications.sweeps.remind_reorders",
    ],
    "weekly": [
        "ovira_marketplace.api.reports.email_operator_report",
    ],
}

# ---------------------------------------------------------------------------
# Inbound messaging: answer customers who reply on WhatsApp (order status,
# cash-on-delivery confirmation, a shared location pinning the address).
# ---------------------------------------------------------------------------
ovira_messaging_inbound = ["ovira_marketplace.api.whatsapp_inbound.handle"]

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

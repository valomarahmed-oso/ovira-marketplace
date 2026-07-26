import frappe

MARKETPLACE_ROLES = [
    "Marketplace Operator",
    "Marketplace Content Editor",
    "Marketplace Vendor",
    "Marketplace Vendor Staff",
    "Marketplace Buyer",
]


def before_install():
    """Create roles before DocTypes sync, so their permissions resolve."""
    _create_roles()
    frappe.db.commit()


def after_install():
    """Run once when the app is installed into a site.

    NOTE: in Frappe v16 `after_install` runs BEFORE this app's DocTypes are
    synced into the site DB, so anything that needs "Marketplace Settings"
    must wait for `after_migrate` (which runs right after the schema sync).
    """
    _create_roles()
    _seed_settings_if_ready()
    frappe.db.commit()


def after_migrate():
    """Runs after every `bench migrate` once the DocTypes exist. Idempotent —
    safe to run on every migrate; seeds settings only on first run."""
    _create_roles()
    _seed_settings_if_ready()
    _seed_cms_if_empty()
    _backfill_singleton_defaults()
    frappe.db.commit()


# Fields added to an EXISTING single doctype whose declared default never fires.
# Frappe applies a field default when a document is created; Marketplace Settings
# already exists, so a newly-migrated column lands as NULL instead. Only NULL is
# backfilled — a deliberate 0 chosen by the operator must survive.
SINGLETON_DEFAULTS = {
    "Marketplace Settings": {
        "refund_charge_vendor": 1,
        "refund_admin_fee_percent": 20,
    },
}


def _backfill_singleton_defaults():
    for doctype, defaults in SINGLETON_DEFAULTS.items():
        if not frappe.db.exists("DocType", doctype):
            continue
        # `frappe.get_meta` can still be serving a cache built BEFORE this
        # migrate synced the doctype, in which case has_field() reports False for
        # a field that now exists and the backfill silently skips. Ask the
        # DocField table instead — it's authoritative and uncached.
        frappe.clear_cache(doctype=doctype)
        present = set(
            frappe.get_all(
                "DocField",
                filters={"parent": doctype, "fieldname": ["in", list(defaults)]},
                pluck="fieldname",
            )
        )
        for field, value in defaults.items():
            if field not in present:
                continue
            try:
                if frappe.db.get_single_value(doctype, field) is None:
                    frappe.db.set_single_value(doctype, field, value)
                    frappe.db.commit()
            except Exception:
                frappe.log_error(title=f"Ovira: backfill {doctype}.{field} failed")


def _seed_cms_if_empty():
    """Populate default homepage content so the storefront isn't blank. Only
    seeds when the CMS doctypes exist and have no rows yet."""
    if not frappe.db.exists("DocType", "Marketplace Banner"):
        return
    from ovira_marketplace.setup.cms import seed_cms

    seed_cms()


def _create_roles():
    for role_name in MARKETPLACE_ROLES:
        if frappe.db.exists("Role", role_name):
            continue
        role = frappe.new_doc("Role")
        role.role_name = role_name
        role.desk_access = role_name in (
            "Marketplace Operator",
            "Marketplace Content Editor",
            "Marketplace Vendor",
        )
        role.insert(ignore_permissions=True)


def _seed_settings_if_ready():
    """Seed Marketplace Settings with sensible defaults from the site.

    Returns early if the DocType has not been synced yet (during install-app)
    or if settings were already configured."""
    if not frappe.db.exists("DocType", "Marketplace Settings"):
        return
    settings = frappe.get_single("Marketplace Settings")
    if settings.operator_company:
        return
    settings.mode = "Multi Vendor"
    settings.operator_company = frappe.defaults.get_global_default("company") or frappe.db.get_value(
        "Company", {}, "name"
    )
    settings.default_currency = frappe.db.get_default("currency") or frappe.db.get_value(
        "Currency", {"enabled": 1}, "name"
    )
    settings.default_commission_rate = 10
    settings.flags.ignore_mandatory = True
    settings.save(ignore_permissions=True)

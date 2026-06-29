import frappe

MARKETPLACE_ROLES = [
    "Marketplace Operator",
    "Marketplace Vendor",
    "Marketplace Vendor Staff",
    "Marketplace Buyer",
]


def before_install():
    """Create roles before DocTypes sync, so their permissions resolve."""
    _create_roles()
    frappe.db.commit()


def after_install():
    """Run once when the app is installed into a site."""
    _create_roles()
    _init_settings()
    frappe.db.commit()


def _create_roles():
    for role_name in MARKETPLACE_ROLES:
        if frappe.db.exists("Role", role_name):
            continue
        role = frappe.new_doc("Role")
        role.role_name = role_name
        role.desk_access = role_name in ("Marketplace Operator", "Marketplace Vendor")
        role.insert(ignore_permissions=True)


def _init_settings():
    """Seed Marketplace Settings with sensible defaults from the site."""
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

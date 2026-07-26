"""Issue and revoke API access keys from the store's own admin.

Every whitelisted method in this app is already a REST endpoint — that part is
automatic, and needs no configuration. What still required the ERPNext Desk was
minting a credential for an external caller (a mobile app, a warehouse sync, a
partner integration). This module moves that into the operator console.

Design:

* **One dedicated service user per key.** A key is never attached to a person's
  account, so revoking it can't lock a human out and one integration's key can't
  be reused as another's.
* **Scope is an allowlist, never free-form.** `SCOPE_ROLES` maps the three
  offered scopes to marketplace roles. `System Manager` is deliberately absent —
  an operator must not be able to mint a site-admin credential from a web form.
* **The secret is shown exactly once.** Frappe stores `api_secret` encrypted and
  we never read it back; if it's lost, the key is rotated, not recovered.

Callers authenticate with the standard Frappe header:

    Authorization: token <api_key>:<api_secret>
"""

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint, now_datetime

from ovira_marketplace.api.admin import _require_operator

DT = "Marketplace API Key"

SCOPE_ROLES = {
    # Guest + own-account endpoints only. Enough for a read-only catalogue feed.
    "Read Only": [],
    "Content Editor": ["Marketplace Content Editor"],
    "Operator": ["Marketplace Operator"],
}

# Never assignable through this screen, whatever the caller sends.
FORBIDDEN_ROLES = {"System Manager", "Administrator"}

SERVICE_DOMAIN = "api.ovira.local"
"""Service accounts get a non-routable address — they must never receive mail
or be usable as a login."""


def _service_email(label):
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in (label or "key"))
    slug = "-".join(p for p in slug.split("-") if p)[:24] or "key"
    return "svc-{0}-{1}@{2}".format(slug, frappe.generate_hash(length=6), SERVICE_DOMAIN)


def disable_service_user(user):
    """Kill a key at its source: clear the credential and disable the account.
    Safe to call repeatedly."""
    if not user or not frappe.db.exists("User", user):
        return
    try:
        doc = frappe.get_doc("User", user)
        doc.api_key = None
        doc.api_secret = None
        doc.enabled = 0
        doc.flags.ignore_permissions = True
        doc.save(ignore_permissions=True)
    except Exception:
        frappe.log_error(title="Ovira: could not disable service user")


def _shape(row):
    last_active = None
    if row.get("user"):
        last_active = frappe.db.get_value("User", row["user"], "last_active")
    return {
        "name": row.get("name"),
        "label": row.get("label"),
        "scope": row.get("scope"),
        "enabled": cint(row.get("enabled")),
        "user": row.get("user"),
        "key_prefix": row.get("key_prefix"),
        "note": row.get("note"),
        "created": str(row.get("creation")) if row.get("creation") else None,
        "revoked_on": str(row.get("revoked_on")) if row.get("revoked_on") else None,
        "last_used": str(last_active) if last_active else None,
    }


@frappe.whitelist()
def list_keys():
    """Issued keys with their scope and last use. Secrets are never included —
    they are not readable even server-side once stored."""
    _require_operator()
    rows = frappe.get_all(
        DT,
        fields=["name", "label", "scope", "enabled", "user", "key_prefix", "note", "creation", "revoked_on"],
        order_by="creation desc",
        limit_page_length=0,
        ignore_permissions=True,
    )
    return [_shape(r) for r in rows]


@frappe.whitelist()
@rate_limit(limit=20, seconds=60 * 60, methods="POST")
def create_key(label, scope="Read Only", note=None):
    """Mint a new key and return it ONCE.

    The response is the only time the secret exists in readable form — the
    screen tells the operator to copy it now, and offers rotation rather than
    recovery if it's lost.
    """
    _require_operator()

    label = (label or "").strip()
    if not label:
        frappe.throw(_("أدخل اسمًا للمفتاح."))
    if scope not in SCOPE_ROLES:
        frappe.throw(_("نطاق غير معروف."))

    roles = [r for r in SCOPE_ROLES[scope] if r not in FORBIDDEN_ROLES]

    email = _service_email(label)
    user = frappe.new_doc("User")
    user.email = email
    user.first_name = "API · {0}".format(label)[:120]
    # A System User can hold marketplace roles; the account is disabled for
    # interactive login by having no password and a non-routable address.
    user.user_type = "System User"
    user.send_welcome_email = 0
    user.flags.ignore_permissions = True
    user.flags.no_welcome_mail = True
    user.insert(ignore_permissions=True)

    if roles:
        user.add_roles(*roles)

    # Same generation Frappe itself uses for Desk-issued keys.
    api_key = frappe.generate_hash(length=15)
    api_secret = frappe.generate_hash(length=15)
    user.api_key = api_key
    user.api_secret = api_secret
    user.flags.ignore_permissions = True
    user.save(ignore_permissions=True)

    row = frappe.new_doc(DT)
    row.label = label
    row.scope = scope
    row.enabled = 1
    row.user = email
    row.key_prefix = api_key[:6]
    row.note = note or None
    row.flags.ignore_permissions = True
    row.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "created": _shape(
            frappe.db.get_value(
                DT, row.name,
                ["name", "label", "scope", "enabled", "user", "key_prefix", "note", "creation", "revoked_on"],
                as_dict=True,
            )
        ),
        # Shown once. Not retrievable afterwards.
        "api_key": api_key,
        "api_secret": api_secret,
    }


@frappe.whitelist()
def revoke_key(name):
    """Disable a key immediately. The registry row stays for the audit trail."""
    _require_operator()
    row = frappe.db.get_value(DT, name, ["name", "user", "enabled"], as_dict=True)
    if not row:
        frappe.throw(_("المفتاح غير موجود."), frappe.DoesNotExistError)

    disable_service_user(row.user)
    frappe.db.set_value(DT, name, {"enabled": 0, "revoked_on": now_datetime()})
    frappe.db.commit()
    return list_keys()


@frappe.whitelist()
@rate_limit(limit=20, seconds=60 * 60, methods="POST")
def rotate_key(name):
    """Replace the credential on an existing key, keeping its label and scope.
    The old secret stops working immediately."""
    _require_operator()
    row = frappe.db.get_value(DT, name, ["name", "user"], as_dict=True)
    if not row or not row.user:
        frappe.throw(_("المفتاح غير موجود."), frappe.DoesNotExistError)

    user = frappe.get_doc("User", row.user)
    api_key = frappe.generate_hash(length=15)
    api_secret = frappe.generate_hash(length=15)
    user.api_key = api_key
    user.api_secret = api_secret
    user.enabled = 1
    user.flags.ignore_permissions = True
    user.save(ignore_permissions=True)

    frappe.db.set_value(DT, name, {"key_prefix": api_key[:6], "enabled": 1, "revoked_on": None})
    frappe.db.commit()
    return {"api_key": api_key, "api_secret": api_secret}


@frappe.whitelist()
def delete_key(name):
    """Remove the key and its service account entirely."""
    _require_operator()
    if not frappe.db.exists(DT, name):
        frappe.throw(_("المفتاح غير موجود."), frappe.DoesNotExistError)
    # on_trash disables the service user first.
    frappe.delete_doc(DT, name, ignore_permissions=True, force=True)
    frappe.db.commit()
    return list_keys()


@frappe.whitelist()
def api_overview():
    """What an integrator needs to start calling the marketplace: the base URL,
    the auth header shape, and a few representative endpoints.

    Rendered in the console so nobody has to read the source to integrate.
    """
    _require_operator()
    site = frappe.utils.get_url()
    return {
        "base_url": site,
        "method_url": site + "/api/method/<dotted.path>",
        "auth_header": "Authorization: token <api_key>:<api_secret>",
        "guest_note": _("نقاط البيع العامة (الكتالوج والبحث والأقسام) تعمل بدون مفتاح."),
        "examples": [
            {
                "label": _("قائمة المنتجات (عام)"),
                "method": "ovira_marketplace.api.catalog.list_products",
                "auth": False,
            },
            {
                "label": _("تفاصيل منتج (عام)"),
                "method": "ovira_marketplace.api.catalog.get_product",
                "auth": False,
            },
            {
                "label": _("إعدادات المتجر العامة"),
                "method": "ovira_marketplace.api.settings.get_public_config",
                "auth": False,
            },
            {
                "label": _("طلبات المتجر (مشغّل)"),
                "method": "ovira_marketplace.api.operator.list_orders",
                "auth": True,
            },
            {
                "label": _("تقرير شامل (مشغّل)"),
                "method": "ovira_marketplace.api.reports.full_report",
                "auth": True,
            },
        ],
    }

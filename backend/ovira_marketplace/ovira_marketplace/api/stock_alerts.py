"""Back-in-stock alerts — let a signed-in shopper ask to be told (in-app) when
an out-of-stock product is available again.

Delivery rides the existing in-app notification system, so there's no email /
WhatsApp dependency. The 0 -> positive transition is detected in
MarketplaceProduct.refresh_stock (fired on product save) and, for restocks that
happen purely in ERPNext, by a daily sweep — both marketplace-scoped, so no
global ERPNext hooks run for other tenants.
"""

import frappe
from frappe import _

from ovira_marketplace.api.notifications import create_notification


def _session_user():
    user = frappe.session.user
    return None if (not user or user == "Guest") else user


def _product_name(slug):
    return frappe.db.get_value("Marketplace Product", {"slug": slug}, "name")


@frappe.whitelist()
def subscribe(slug):
    """Ask for a back-in-stock alert on a product (login required)."""
    user = _session_user()
    if not user:
        frappe.throw(_("سجّل الدخول ليصلك تنبيه عند التوفّر."), frappe.PermissionError)
    name = _product_name(slug)
    if not name:
        frappe.throw(_("المنتج غير موجود."))

    existing = frappe.db.get_value(
        "Marketplace Stock Alert", {"product": name, "user": user}, "name"
    )
    if existing:
        # Re-arm an old (already-notified) alert so the next restock alerts again.
        frappe.db.set_value("Marketplace Stock Alert", existing, "notified", 0, update_modified=False)
    else:
        frappe.get_doc(
            {"doctype": "Marketplace Stock Alert", "product": name, "user": user, "notified": 0}
        ).insert(ignore_permissions=True)
    frappe.db.commit()
    return {"subscribed": True}


@frappe.whitelist()
def unsubscribe(slug):
    """Cancel a back-in-stock alert (login required)."""
    user = _session_user()
    if not user:
        return {"subscribed": False}
    name = _product_name(slug)
    if name:
        frappe.db.delete("Marketplace Stock Alert", {"product": name, "user": user})
        frappe.db.commit()
    return {"subscribed": False}


@frappe.whitelist()
def alert_status(slug):
    """Whether the signed-in user has a pending alert for this product."""
    user = _session_user()
    if not user:
        return {"authenticated": False, "subscribed": False}
    name = _product_name(slug)
    subscribed = bool(
        name and frappe.db.exists("Marketplace Stock Alert", {"product": name, "user": user, "notified": 0})
    )
    return {"authenticated": True, "subscribed": subscribed}


def notify_back_in_stock(product):
    """Alert every pending subscriber that `product` is back in stock (in-app).
    Trusted backend caller only. Returns the number of shoppers notified."""
    alerts = frappe.get_all(
        "Marketplace Stock Alert",
        filters={"product": product, "notified": 0},
        fields=["name", "user"],
        ignore_permissions=True,
    )
    if not alerts:
        return 0
    info = frappe.db.get_value("Marketplace Product", product, ["title", "slug"], as_dict=True)
    if not info:
        return 0

    for a in alerts:
        try:
            create_notification(
                a.user,
                title=f"{info.title} رجع متوفّر",
                message="المنتج اللي طلبت تنبيه بتوفّره رجع متاح — اطلبه قبل ما يخلص تاني.",
                kind="promo",
                reference_doctype="Marketplace Product",
                reference_name=product,
            )
        except Exception:
            frappe.log_error("back-in-stock notify failed")
        frappe.db.set_value("Marketplace Stock Alert", a.name, "notified", 1, update_modified=False)
    frappe.db.commit()
    return len(alerts)


def sweep_back_in_stock():
    """Daily: refresh stock for every product that has pending alerts, firing
    notifications on any 0 -> positive transition (catches ERPNext-only
    restocks that never re-saved the product). Marketplace-scoped."""
    products = set(
        frappe.get_all(
            "Marketplace Stock Alert", filters={"notified": 0}, pluck="product", ignore_permissions=True
        )
    )
    for name in products:
        try:
            frappe.get_doc("Marketplace Product", name).refresh_stock()
        except Exception:
            frappe.log_error(f"stock sweep failed for {name}", "back-in-stock sweep")
    return {"checked": len(products)}

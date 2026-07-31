import json

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import cint, flt

from ovira_marketplace.customers import (
    customer_for_user,
    get_or_create_customer,
    new_customer,
)
from ovira_marketplace.marketplace.doctype.marketplace_settings.marketplace_settings import (
    get_settings,
)

FREE_SHIPPING_THRESHOLD = 500
FLAT_SHIPPING = 50


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=30, seconds=60 * 60, methods="POST")
def place_order(
    items, customer, payment_method="cod", coupon=None, attribution=None, use_wallet=False,
    payment_method_ref=None, shipping_method=None, preferred_carrier=None,
    idempotency_key=None,
):
    """Create a Marketplace Order from the storefront cart and split it into
    per-vendor ERPNext Sales Orders.

    `items`: [{"slug": "...", "qty": 1}, ...]
    `customer`: {"name", "phone", "email", "gov", "address"}
    `coupon`: optional coupon code — re-validated and priced server-side.
    `attribution`: optional {utm_source, utm_medium, utm_campaign, referrer,
      landing_page} captured by the storefront; the channel is derived here.
    `use_wallet`: when true, spend the signed-in buyer's store credit (capped at
      the payable) — booked as an operator-funded discount, like a coupon.
    `shipping_method`: the delivery option the shopper picked; re-resolved here
      so the surcharge and the promised window come from the server, not the
      client.
    `preferred_carrier`: the courier the shopper would rather have. A request,
      not an instruction — the vendor books the shipment and may not hold an
      account with it — so it costs nothing and blocks nothing.
    `idempotency_key`: one checkout ATTEMPT, minted by the client. Repeating it
      returns the order that already exists instead of creating a second one.
    """
    items = _loads(items)
    customer = _loads(customer)
    if not items:
        frappe.throw(_("Your cart is empty."))

    # A double tap on "confirm", a flaky connection the browser retried, a back
    # button — all of them post the same cart twice, and without this the shopper
    # gets two orders, two stock reservations and two charges. The architecture
    # has called for this since Phase 0; it was never built.
    existing = _order_for_key(idempotency_key)
    if existing:
        return existing

    settings = get_settings()
    order = frappe.new_doc("Marketplace Order")
    order.customer = _ensure_customer(customer)
    order.customer_name = customer.get("name")
    order.phone = customer.get("phone")
    order.email = customer.get("email") or _session_email()
    order.governorate = customer.get("gov")
    order.shipping_address = customer.get("address")
    order.payment_method = payment_method
    order.idempotency_key = _clean_key(idempotency_key)
    if payment_method_ref:
        order.payment_method_ref = payment_method_ref
    order.status = "Pending Payment"
    order.payment_status = "Unpaid"
    order.currency = settings.default_currency
    _apply_attribution(order, attribution)

    from ovira_marketplace.api.deals import active_deal

    subtotal = 0.0
    shortages = []
    deal_redemptions = []
    for line in items:
        product = frappe.db.get_value(
            "Marketplace Product",
            {"slug": line.get("slug"), "approval_status": "Approved", "published": 1},
            ["name", "vendor", "price", "title", "stock_qty", "track_inventory", "has_variants"],
            as_dict=True,
        )
        if not product:
            continue
        # Approved and published is not the same as buyable. A suspended
        # seller's product is hidden from every listing, and in Single Company
        # mode so is every other vendor's — but checkout resolved by slug alone,
        # so an old cart, a stale tab or a direct POST could still buy one. The
        # store would then owe goods on behalf of a seller it has switched off.
        from ovira_marketplace.api.catalog import is_visible_vendor

        if not is_visible_vendor(product.vendor):
            shortages.append(_("{0} is no longer available.").format(product.title))
            continue
        # Never trust the client-supplied quantity: clamp to a positive integer
        # so a negative qty can't be used to drive the order total down.
        try:
            qty = int(line.get("qty") or 1)
        except (TypeError, ValueError):
            qty = 1
        qty = max(1, qty)

        # Resolve the price, stock and label — from the chosen variant when the
        # product has variants (server-side, so the client's price is ignored).
        rate = flt(product.price)
        title = product.title
        available = int(flt(product.stock_qty))
        gate_stock = bool(product.track_inventory)
        variant_sku = None

        if product.has_variants:
            variant = _resolve_variant(product.name, line.get("variant"))
            if not variant:
                shortages.append(_("Please choose an option for {0}.").format(product.title))
                continue
            rate = flt(variant.price) or flt(product.price)
            title = f"{product.title} — {variant.option_value}"
            available = int(flt(variant.stock_qty))
            variant_sku = variant.sku
            gate_stock = True  # variant stock is explicit — always enforce it

        # Bulk/quantity price tiers (single-price products): a lower unit price
        # once the quantity reaches a tier. Applied server-side; the deal below
        # can still win if it's cheaper.
        deal_name = None
        if not product.has_variants:
            from ovira_marketplace.api.pricing import tier_unit_rate

            rate = tier_unit_rate(product.name, qty, rate)
            # A live flash deal replaces the rate server-side. Vendor-funded: the
            # lower rate flows into the SO and settlement, so the vendor is paid
            # on the deal price — no operator absorption.
            deal = active_deal(product.name)
            if deal and flt(deal["deal_price"]) < rate:
                rate = flt(deal["deal_price"])
                deal_name = deal["name"]

        # Multi-warehouse routing: when the product carries per-branch stock,
        # route this line to a single branch (nearest → priority → most stock)
        # and book it under that branch's company + warehouse. Routing itself
        # guarantees availability, so the flat stock gate is skipped.
        fulfil_company = None
        fulfil_warehouse = None
        if not product.has_variants:
            from ovira_marketplace.api.fulfillment import has_stock_locations, route_line

            if has_stock_locations(product.name):
                route = route_line(product.name, qty, customer.get("gov"))
                if not route:
                    shortages.append(_("{0} is out of stock.").format(title))
                    continue
                fulfil_company = route.company
                fulfil_warehouse = route.warehouse
                gate_stock = False

        # Block overselling. Any shortage rejects the whole order (below) rather
        # than silently trimming quantities the buyer didn't agree to.
        if gate_stock:
            if available <= 0:
                shortages.append(_("{0} is out of stock.").format(title))
                continue
            if qty > available:
                shortages.append(_("Only {0} left of {1}.").format(available, title))
                continue

        amount = rate * qty
        subtotal += amount
        order.append(
            "items",
            {
                "marketplace_product": product.name,
                "title": title,
                "variant_sku": variant_sku,
                "vendor": product.vendor,
                "qty": qty,
                "rate": rate,
                "amount": amount,
                "fulfil_company": fulfil_company,
                "fulfil_warehouse": fulfil_warehouse,
            },
        )
        if deal_name:
            deal_redemptions.append((deal_name, qty))

    if shortages:
        frappe.throw("<br>".join(shortages), title=_("Stock unavailable"))

    if not order.get("items"):
        frappe.throw(_("None of the cart items are available."))

    order.subtotal = subtotal
    order.shipping_amount = _order_shipping(order, subtotal, customer.get("gov"), settings)
    _apply_shipping_method(order, customer.get("gov"), shipping_method)

    from ovira_marketplace.api.shipping import resolve_carrier

    order.preferred_carrier = resolve_carrier(preferred_carrier)

    # Coupon discount is always recomputed here — the client's number is never
    # trusted. An invalid/expired code surfaces its reason and stops checkout.
    coupon_doc = None
    discount = 0.0  # operator-funded (platform coupon)
    vendor_discount = 0.0  # vendor-funded (vendor coupon → applied on the vendor's SO)
    if coupon:
        from ovira_marketplace.api.coupons import resolve

        coupon_doc, coupon_discount = resolve(coupon, subtotal, items)
        order.coupon_code = coupon_doc.code
        if coupon_doc.vendor:
            order.coupon_vendor = coupon_doc.vendor
            order.vendor_discount_amount = coupon_discount
            vendor_discount = coupon_discount
        else:
            order.discount_amount = coupon_discount
            discount = coupon_discount

    # Tax, from the same template ERPNext will bill the Sales Order with. An
    # inclusive template (the Egyptian retail norm) only DISCLOSES the tax — the
    # price already contains it, so `extra_tax` is zero and the shopper pays what
    # the cart said. An exclusive one is added here, because ERPNext would
    # otherwise add it downstream and invoice more than the shopper approved.
    from ovira_marketplace.taxes import apply_order_tax
    from ovira_marketplace.totals import goods_total, order_total, payable, wallet_to_spend

    goods = goods_total(subtotal, discount, vendor_discount)
    extra_tax = apply_order_tax(order, goods, settings)

    # Store credit is applied after the coupon(s) and the tax, capped at what's
    # still payable. It's booked as an operator-funded discount (see
    # payment._invoice_and_pay), so vendor settlement stays whole. Debited from
    # the ledger once the order exists (needs the order name as the reference).
    wallet_applied = 0.0
    user = frappe.session.user
    if _truthy(use_wallet) and user and user != "Guest":
        from ovira_marketplace.api.wallet import balance as wallet_balance

        due = payable(goods, order.shipping_amount, extra_tax)
        wallet_applied = wallet_to_spend(wallet_balance(user), due)
    order.wallet_applied = wallet_applied
    order.total = order_total(
        subtotal, order.shipping_amount, discount, vendor_discount, extra_tax, wallet_applied
    )

    # Screen cash-on-delivery before the order exists, so a blocked one is
    # refused rather than created-then-cancelled (which would have already moved
    # stock). Inert until the operator enables it in Marketplace Settings.
    if (payment_method or "").lower() in ("cod", "cash on delivery"):
        from ovira_marketplace.api.cod_risk import screen_order

        screen_order(order, settings)

    order.insert(ignore_permissions=True)
    # Draw the ordered quantities down from the marketplace stock so the numbers
    # shoppers see reflect what's left. Restored if the order is cancelled (see
    # MarketplaceOrder._maybe_restock_on_cancel).
    reserve_order_stock(order)
    order.create_vendor_orders()
    if wallet_applied > 0:
        from ovira_marketplace.api.wallet import debit as wallet_debit

        wallet_debit(
            user,
            wallet_applied,
            reason="Order payment",
            reference_doctype="Marketplace Order",
            reference_name=order.name,
            note=order.name,
        )
    if coupon_doc:
        _redeem_coupon(coupon_doc.name)
    if deal_redemptions:
        from ovira_marketplace.api.deals import redeem_deal

        for deal_name, deal_qty in deal_redemptions:
            redeem_deal(deal_name, deal_qty)

    # The shopper converted → close any abandoned-cart snapshot (best-effort).
    try:
        from ovira_marketplace.api.abandoned_cart import mark_recovered

        mark_recovered(email=order.email, user=frappe.session.user if frappe.session.user != "Guest" else None)
    except Exception:
        frappe.log_error(title="Ovira: abandoned-cart recover failed")

    frappe.db.commit()

    # One announcement; the engine fans it out to the buyer (every channel they
    # have) and to each vendor with lines on this order, with retries + an audit
    # row per message. It never raises back into checkout.
    from ovira_marketplace.notifications.dispatch import emit

    emit("order.placed", order.notification_context(), doc=order)
    emit("vendor.new_order", order.notification_context(), doc=order)

    # A cash-on-delivery order the risk screen wants a human to look at. Raised
    # here rather than inside the screening itself, which runs before the order
    # has a name to point at.
    if order.get("cod_risk_review"):
        ctx = order.notification_context()
        ctx["reason"] = order.get("cod_risk_flags") or ""
        emit("operator.cod_flagged", ctx, doc=order)

        # And ask the buyer to confirm before anything ships. A refused delivery
        # sends the goods on two paid journeys and collects nothing; one question
        # answered with one character is the cheapest insurance there is. Only
        # flagged orders are asked, so ordinary customers are never interrogated.
        try:
            from ovira_marketplace.api.whatsapp_inbound import request_cod_confirmation

            request_cod_confirmation(order)
        except Exception:
            frappe.log_error(title="Ovira: COD confirmation request failed")

    # `token` lets the storefront start payment for this specific order without
    # exposing every order to any guest who can guess an id.
    return {
        "name": order.name,
        "total": order.total,
        "status": order.status,
        "token": order.access_token,
    }


def _clean_key(value):
    """A client-supplied key, bounded. `None` when absent, so the unique index
    treats every keyless order as distinct rather than colliding on empty."""
    key = (str(value).strip() if value else "")[:64]
    return key or None


def _order_for_key(idempotency_key):
    """The order this key already created, in the shape `place_order` returns.

    Deliberately returns the SAME payload as a fresh call — including the access
    token — so the client cannot tell a retry from the original and doesn't need
    to. Scoped to the caller for a logged-in shopper, so a guessed key can never
    hand someone else's order (and its payment token) to a stranger.
    """
    key = _clean_key(idempotency_key)
    if not key:
        return None
    row = frappe.db.get_value(
        "Marketplace Order", {"idempotency_key": key},
        ["name", "total", "status", "access_token", "owner"], as_dict=True,
    )
    if not row:
        return None
    # Scoped by the record's OWNER — the login that created it — not by the
    # `email` field, which the client supplies and can therefore be anything. A
    # replay is only a replay when the same session is asking; otherwise a
    # guessed key would hand over an order and its payment token.
    if row.owner != frappe.session.user:
        return None
    return {
        "name": row.name, "total": row.total, "status": row.status,
        "token": row.access_token, "idempotent_replay": True,
    }


def reserve_order_stock(order):
    """Decrement marketplace stock for each line when an order is placed."""
    for it in order.items:
        _adjust_stock(it.marketplace_product, it.get("variant_sku"), -(it.qty or 0), it.get("fulfil_warehouse"))


def restock_order(order):
    """Return each line's quantity to stock (used when an order is cancelled)."""
    for it in order.items:
        _adjust_stock(it.marketplace_product, it.get("variant_sku"), it.qty or 0, it.get("fulfil_warehouse"))


def _adjust_stock(product_name, variant_sku, delta, fulfil_warehouse=None):
    """Shift a product's marketplace stock by ``delta`` (negative = sold,
    positive = restocked), floored at zero. For a variant line the specific
    variant row moves and the product's base stock is re-summed from its
    variants; otherwise the base stock moves directly.

    **Failure here is critical, not best-effort.** This used to swallow its own
    exception, which meant an order could be created, confirmed and paid for
    while the quantity it consumed was never taken off the shelf — the store then
    sells the same unit again, and the second customer is the one who finds out.
    Better to refuse the order than to promise stock that isn't there.
    """
    if not product_name or not delta:
        return
    from ovira_marketplace.failures import CRITICAL, guard

    with guard("stock adjustment", CRITICAL, product=product_name, delta=delta):
        # Multi-warehouse line: move the specific branch's stock (which re-sums
        # the product's headline stock_qty from all branches).
        if fulfil_warehouse:
            from ovira_marketplace.api.fulfillment import adjust_location_stock

            adjust_location_stock(product_name, fulfil_warehouse, delta)
            return
        doc = frappe.get_doc("Marketplace Product", product_name)
        if variant_sku and doc.has_variants and doc.get("variants"):
            for v in doc.variants:
                if v.sku == variant_sku:
                    v.db_set("stock_qty", max(0.0, flt(v.stock_qty) + delta))
                    break
            doc.db_set("stock_qty", sum(flt(v.stock_qty) for v in doc.variants))
        else:
            doc.db_set("stock_qty", max(0.0, flt(doc.stock_qty) + delta))


def _ensure_customer(info):
    """Resolve the Customer this order belongs to.

    A logged-in shopper is always bound to *their own* account (by login, never
    by the typed name) so orders can't leak across people who share a name. A
    guest gets a fresh Customer per order — we have no authenticated identity to
    safely dedupe against.
    """
    user = frappe.session.user
    if user and user != "Guest":
        existing = customer_for_user(user)
        if existing:
            return existing
        full_name = info.get("name") or frappe.db.get_value("User", user, "full_name") or user
        return get_or_create_customer(full_name, email=user, phone=info.get("phone"))

    customer = new_customer(info.get("name"), info.get("phone"))
    customer.flags.ignore_permissions = True
    customer.insert(ignore_permissions=True)
    return customer.name


_PAID_MEDIA = {"cpc", "ppc", "paid", "paidsearch", "display", "cpm", "banner", "retargeting"}
_EMAIL_MEDIA = {"email", "e-mail", "newsletter"}
_SOCIAL_MEDIA = {"social", "social-media", "social-network", "sm", "paid-social", "paidsocial"}
_SEARCH_HOSTS = ("google.", "bing.", "yahoo.", "duckduckgo.", "yandex.", "baidu.", "ecosia.")
_SOCIAL_HOSTS = (
    "facebook.", "instagram.", "twitter.", "t.co", "x.com", "tiktok.", "linkedin.",
    "youtube.", "youtu.be", "pinterest.", "snapchat.", "reddit.", "whatsapp.", "wa.me", "telegram.", "t.me",
)


def _host_of(url):
    """Bare hostname of a URL, lowercased, without the leading www. Empty on junk."""
    try:
        from urllib.parse import urlparse

        host = (urlparse(url).hostname or "").lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def _derive_source(utm_source, utm_medium, referrer):
    """Collapse raw UTM + referrer into one normalized marketing channel so
    orders group cleanly in reporting. Derived server-side (never client-trusted).
    """
    medium = (utm_medium or "").strip().lower()
    src = (utm_source or "").strip().lower()
    if medium:
        if medium in _PAID_MEDIA:
            return "paid"
        if medium in _EMAIL_MEDIA:
            return "email"
        if medium in _SOCIAL_MEDIA:
            return "social"
        if medium == "organic":
            return "organic"
        if medium == "referral":
            return "referral"
    if src:
        if any(src.startswith(h.rstrip(".")) for h in _SEARCH_HOSTS):
            return "organic"
        if any(s.rstrip(".") in src for s in ("facebook", "instagram", "twitter", "tiktok", "linkedin", "youtube", "pinterest", "snapchat", "reddit", "whatsapp", "telegram")):
            return "social"
        return "referral" if not medium else "other"

    host = _host_of(referrer)
    if host:
        own = _host_of(frappe.utils.get_url())
        if own and host == own:
            return "direct"  # internal navigation, not a real referral
        if any(h in host for h in _SEARCH_HOSTS):
            return "organic"
        if any(h in host for h in _SOCIAL_HOSTS):
            return "social"
        return "referral"
    return "direct"


def _apply_attribution(order, attribution):
    """Store the storefront-captured first-touch attribution on the order and
    stamp the normalized `source` channel. Best-effort — never blocks checkout."""
    try:
        data = _loads(attribution) if attribution else {}
        if not isinstance(data, dict):
            data = {}

        def clip(key, n):
            v = data.get(key)
            return (str(v).strip()[:n]) if v else None

        order.utm_source = clip("utm_source", 140)
        order.utm_medium = clip("utm_medium", 140)
        order.utm_campaign = clip("utm_campaign", 140)
        order.referrer = clip("referrer", 500)
        order.landing_page = clip("landing_page", 500)
        order.source = _derive_source(order.utm_source, order.utm_medium, order.referrer)
    except Exception:
        order.source = "direct"


def _order_shipping(order, subtotal, governorate, settings):
    """Order shipping under the active mode. Per-Vendor sums each vendor's own
    rule over their slice of the cart (from the booked line amounts, so deals and
    variant prices are already reflected); Operator uses the rate table."""
    if (settings.get("shipping_mode") or "Operator") == "Per Vendor":
        from ovira_marketplace.api.shipping import get_rate_for_vendor

        by_vendor = {}
        for it in order.items:
            by_vendor[it.vendor] = by_vendor.get(it.vendor, 0.0) + flt(it.amount)
        total = 0.0
        for vendor, vsub in by_vendor.items():
            try:
                total += flt(get_rate_for_vendor(vendor, vsub))
            except Exception:
                frappe.log_error(title="Ovira: per-vendor shipping failed")
        return total
    return _shipping_amount(subtotal, governorate)


def _apply_shipping_method(order, governorate, method):
    """Charge the picked delivery option and record what it promised.

    The surcharge stays with the operator: `create_vendor_orders` recomputes each
    vendor's shipping from that vendor's own rule, so paying for faster delivery
    never leaks into a vendor payout. Storing the window on the order means the
    promise the shopper saw survives a later rate change."""
    from ovira_marketplace.api.shipping import _gov_extra_days, resolve_method

    row = resolve_method(method)
    if not row:
        return  # no methods configured — the store prices delivery as it always did
    extra = _gov_extra_days(governorate)
    order.shipping_method = row["method_name"]
    order.shipping_method_surcharge = flt(row["surcharge"])
    order.shipping_amount = flt(order.shipping_amount) + flt(row["surcharge"])
    order.shipping_eta_min = cint(row["eta_min_days"]) + extra
    order.shipping_eta_max = max(order.shipping_eta_min, cint(row["eta_max_days"]) + extra)


def _shipping_amount(subtotal, governorate=None):
    """Rate from the configured Shipping Provider; falls back to the flat rule
    (free over the threshold) if no provider is enabled or the lookup fails."""
    try:
        from ovira_marketplace.api.shipping import get_rate

        return flt(get_rate(subtotal, governorate))
    except Exception:
        frappe.log_error(title="Ovira: shipping rate lookup failed")
        return 0 if subtotal >= FREE_SHIPPING_THRESHOLD else FLAT_SHIPPING


def _resolve_variant(product_name, sku):
    """The chosen variant row of a product, matched by SKU or child-row name.
    Returns a dict-like row or None."""
    if not sku:
        return None
    rows = frappe.get_all(
        "Marketplace Product Variant",
        filters={"parent": product_name, "parenttype": "Marketplace Product"},
        fields=["name", "option_value", "sku", "price", "stock_qty"],
        ignore_permissions=True,
    )
    for r in rows:
        if str(sku) in (r.get("sku"), r.get("name")):
            return r
    return None


def _redeem_coupon(name):
    """Bump a coupon's redemption count (best-effort; never blocks the order)."""
    try:
        used = int(frappe.db.get_value("Marketplace Coupon", name, "used_count") or 0)
        frappe.db.set_value("Marketplace Coupon", name, "used_count", used + 1)
    except Exception:
        frappe.log_error(title="Ovira: coupon redeem failed")


def _session_email():
    """The signed-in user's EMAIL, not their login name.

    Frappe names users by their email, so the two match for every ordinary
    account — but Administrator is named "Administrator" with the email
    "admin@example.com". Returning the login name stored "Administrator" in
    `Marketplace Order.email`, and every buyer-side lookup (orders, returns,
    chat) searches by email, so those orders became invisible to their own
    placer. Resolve to the real address.
    """
    user = frappe.session.user
    if not user or user == "Guest":
        return None
    return frappe.db.get_value("User", user, "email") or user


def _loads(value):
    return json.loads(value) if isinstance(value, str) else value


def _truthy(value):
    """A whitelisted flag may arrive as a real bool (JSON body) or a string."""
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)

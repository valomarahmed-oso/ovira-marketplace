# Roadmap

Phased delivery. Each phase is shippable and verifiable before the next begins.

## Phase 0 — Foundation (current)
- Repo structure, architecture/data-model docs, brand direction.
- `ovira_marketplace` Frappe app scaffold (hooks, modules, install hooks).
- Design tokens from the logo (Ovira blue `#0E8BFF`).

## Phase 1 — Core data model & vendor onboarding
- All custom DocTypes from [data-model.md](data-model.md).
- Mode switch (multi-vendor / single-company).
- Vendor signup → Supplier + Customer + User auto-provisioning.
- Product create → ERPNext Item + Website Item sync; approval workflow.
- Roles & permissions (Vendor, Vendor Staff, Buyer, Operator).

## Phase 2 — Storefront MVP
- Next.js app + design system + RTL + i18n (ar/en).
- Home, category, search (Typesense), product page, cart, checkout.
- Checkout creates Marketplace Order → per-vendor Sales Orders.
- Auth (storefront login/register against Frappe).
- Deploy: storefront container + nginx/traefik on the VPS.

## Phase 3 — Payments
- Payment Connector interface; Paymob + Fawry (Egypt) + COD.
- Webhooks, idempotency, Payment Entry on capture.
- Multi-currency display and settlement currency.

## Phase 4 — Shipping
- Shipping Provider interface; Bosta + Aramex.
- Rate-at-checkout, label generation, pickup, live tracking via socket.
- Maps to ERPNext Shipment / Delivery Note.

## Phase 5 — Vendor dashboard & accounting
- Sales, orders, inventory, payouts, commission statements.
- Vendor expenses (Purchase Invoice / Expense Claim) and purchases.
- Automated settlement runs → Vendor Payout → Payment Entry.

## Phase 6 — Buyer dashboard
- Orders, tracking, returns/RMA, wishlist, reviews, addresses, wallet.

## Phase 7 — PWA & responsive polish
- Installable PWA, offline shell, push notifications.
- Responsive down to watch/mini surfaces; performance budget (Lighthouse 95+).

## Phase 8 — Marketplace parity features
- Recommendations, recently viewed, "frequently bought together".
- Promotions, flash deals, coupons, sponsored placements.
- Q&A, seller chat, notifications center, analytics.

## Phase 9 — Hardening & scale
- Security review, rate limiting, secrets management, audit logs.
- Caching strategy, search scaling, load testing, observability.

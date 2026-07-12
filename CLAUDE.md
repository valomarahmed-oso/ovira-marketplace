# CLAUDE.md — orientation for AI sessions

Read this first. It gets any new session productive on the Ovira Marketplace
codebase without re-deriving context. Deeper detail lives in `README.md` and
`docs/` (`architecture.md`, `data-model.md`, `roadmap.md`).

## What this is

A **multi-vendor e-commerce marketplace** (Amazon/Noon-style, Egypt-first, RTL)
built as:

- **`backend/ovira_marketplace/`** — a custom **Frappe/ERPNext v16** app (Python).
  All marketplace logic + doctypes + whitelisted APIs. ERPNext is the system of
  record; this app never forks accounting/stock primitives, it drives them.
- **`storefront/`** — a **Next.js 15** (App Router, TypeScript, Tailwind) PWA.
  Served under **basePath `/shop`**. Talks to Frappe over REST (+ WebSocket).

It runs multi-vendor by default, or as a single-company store, toggled in
`Marketplace Settings.mode`.

## Repo layout

```
backend/ovira_marketplace/ovira_marketplace/
  api/            # whitelisted endpoints (catalog, checkout, orders, vendor, shipping, …)
  marketplace/doctype/   # core doctypes (Marketplace Product / Order / Settings, …)
  vendor/         # vendor onboarding, settlement, statements
  shipping/       # shipment doctype + carrier connectors
storefront/src/
  app/            # routes (products, checkout, account, vendor, admin, …)
  lib/            # api.ts, cart-store, orders-api, vendor.ts, frappe-client, i18n
  components/     # shared UI
docs/             # architecture, data-model, roadmap
```

## Conventions that bite if ignored

- **i18n:** `storefront/src/lib/i18n.ts` has `ar` and `en` dicts; `Dict = typeof ar`.
  Both dicts must stay **key-parallel** — add a key to both or the build breaks.
  UI is Arabic-first, RTL.
- **CSRF:** authenticated storefront writes must go through `writeHeaders()` in
  `lib/frappe-client.ts` (it attaches `X-Frappe-CSRF-Token` from `auth.me`).
  A plain `fetch` POST for a logged-in user will fail "Invalid Request".
- **Server-trust:** prices, stock, coupons, shipping are **always recomputed
  server-side** in `api/checkout.py` / `api/shipping.py`. Never trust the client
  number. Match that pattern in new endpoints.
- **Rate limiting:** `from frappe.rate_limiter import rate_limit` →
  `@rate_limit(limit=, seconds=, methods="POST")`. There is no `frappe.rate_limit`.
- **Gated integrations:** payment (Paymob), shipping carriers (Aramex/Bosta),
  WhatsApp, and email are coded but **no-op until the operator adds credentials**
  in the admin UI. Don't treat "coming soon"/disabled as missing code.

## ERPNext integration model (important mental model)

- Saving a Marketplace Product creates an ERPNext **Item**. `is_stock_item = 1`
  only if the product's `track_inventory` is on (default off → non-stock Item).
- Stock the storefront shows is the **manual `stock_qty`** on the Marketplace
  Product (and per-variant), decremented at order time (`checkout.reserve_order_stock`,
  restored on cancel). ERPNext `Bin` is only pulled *in* (one-way) when an Item
  actually carries positive inventory.
- Checkout is **sell-side only**: a Marketplace Order splits into one **Sales
  Order per vendor** under the single `operator_company`. **No Delivery Note** is
  created, so ERPNext warehouse stock does not move. There is **no per-vendor
  warehouse/company**; a vendor = `Marketplace Vendor` + a linked ERPNext
  **Supplier** (used for payout). Procurement (Purchase Order/Receipt/Invoice) is
  **not wired** — that's standard ERPNext Desk work if ever needed.
- **Settlement** (`vendor/settlement.py`): per paid order, `payout = Sales Order
  net_total − commission (+ per-vendor shipping in Per-Vendor mode)`, booked as a
  Journal Entry crediting the vendor's Supplier payable; paid out via Payment Entry.
- **Shipping** has two modes (`Marketplace Settings.shipping_mode`): *Operator*
  (one per-governorate rate table) or *Per Vendor* (each vendor sets Flat / Free
  Over / Always Free on their store; summed per vendor, booked on each vendor's SO,
  paid into their settlement). `shipping.preview` gives a mode-aware cart quote.

## Verifying a change

- Storefront types: `cd storefront && npx tsc --noEmit -p tsconfig.json`.
- Backend syntax: `python -m py_compile <file.py>`; import smoke test on the
  server: `bench --site <site> execute frappe.get_attr --args "['<dotted.path>']"`.
- Doctype JSON edits are schema changes → require `bench migrate` on deploy.

## Deploy

Deployed to **demo.ovira.cloud** (the marketplace lives on that site only; the
server is multi-tenant — other sites/apps share it, so backend restarts briefly
affect everyone). The backend runs from a **host git checkout bind-mounted** into
the Frappe containers; the storefront is a **separate container** rebuilt from
`origin/main`.

> Operational specifics (server access, exact deploy/patch commands, incident
> playbooks, credential rotation) are intentionally **kept out of this committed
> file** and live in the maintainer's local Claude memory. Ask before touching
> production; never commit secrets (IPs, SSH keys, tokens) here.

## Working style

Work proceeds in small, independently-deployable slices (see `docs/roadmap.md`
for the phase log). Prefer: edit locally → typecheck/compile → deploy → verify
live → summarize. Keep new code idiomatic to the files around it.

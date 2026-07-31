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
packages/core/    # @ovira/core — types, API client, pricing shared by both clients
mobile/           # Expo (React Native) buyer app; expo-router, Arabic/RTL
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

- Money maths: `cd backend/ovira_marketplace && python -m pytest`. No site
  needed — `tests/conftest.py` stubs `frappe` when the real one isn't importable.
  Covers the arithmetic that decides what a customer is charged, what a vendor is
  billed back, what points are worth and what quantity ERPNext is told to hold
  (`totals`, `taxes`, `chargeback`, `trust`, `loyalty` guards, `inventory`
  targets, `slugs`). **If you change any of those, the test goes in the same
  commit.**
- Anything DB-shaped (document hooks, permissions, ERPNext documents, `on_update`
  transitions) runs against a real site:

  ```bash
  docker exec ovira-backend-1 bench --site ovira-test.local run-tests --app ovira_marketplace
  ```

  **`ovira-test.local`** is an isolated site on the same bench — not routed, no
  DNS, nothing else installed on it. Rebuild it from scratch with `bench
  new-site` + `install-app erpnext` + `install-app ovira_marketplace`, then
  `bench --site ovira-test.local execute
  ovira_marketplace.tests.bootstrap.prepare_test_site` (idempotent; creates the
  company, an **inclusive** VAT template and the Marketplace Settings the suite
  assumes). Never point the bootstrap at a real site — it refuses unless the site
  name looks like a test site.
- **These tests must be re-runnable.** The code under test commits, so frappe's
  per-test rollback has nothing to undo and rows survive the run. Isolate by
  identity (`"buyer.%s@ovira.test" % self._testMethodName`) and assert deltas and
  membership, never absolute balances or exact list equality. A test that only
  passes on a fresh database is a test that will be deleted.
- Storefront types: `cd storefront && npx tsc --noEmit -p tsconfig.json`.
- Shared layer: `cd packages/core && npm test` (builds, then runs `node --test`).
  `src/pricing.ts` mirrors `totals.py`/`taxes.py` **function for function** and
  its tests use the same cases — change one, change the other, same commit, or
  the cart shows a total the invoice disagrees with.
- Mobile: `cd mobile && npm run typecheck`. `npm run web` serves the same bundle
  in a browser for a quick look (Metro proxies `/api/*` in dev; a phone needs no
  proxy). Rebuild `packages/core` after editing it — Metro loads its `dist/`.
- Backend syntax: `python -m py_compile <file.py>`; import smoke test on the
  server: `bench --site <site> execute frappe.get_attr --args "['<dotted.path>']"`.
- Doctype JSON edits are schema changes → require `bench migrate` on deploy.

## Where money is decided

Keep these pure and tested; they are the files where a silent arithmetic slip
costs someone real money:

| | |
|---|---|
| `totals.py` | discounts → tax → store credit, in that order |
| `taxes.py` | inclusive tax is disclosed; exclusive tax is ADDED to the order total |
| `vendor/chargeback.py` | who funds a refund, and the clamp that stops a small refund paying the vendor |
| `api/trust.py` | `rates()` / `blend_score()` — the denominators are the easy thing to get wrong |
| `inventory.py` | `reconciliation_targets()` — target = offered **+ reserved**, always |
| `api/pricing.py` | `tier_unit_rate()` — bulk tiers; never below qty 2, cheapest reached tier wins |
| `packages/core/src/pricing.ts` | the clients' copy of all of the above — mirrors it function for function, same test cases |

## How this app is allowed to fail

`failures.py` replaces `except Exception: log_error` as a blanket policy. State
the category at the call site:

```python
with guard("stock adjustment", CRITICAL, product=name):   # raise — money/stock is wrong
with guard("return credit note", DEFERRABLE, ref=so):     # log + record, a sweep retries
with guard("abandoned-cart recovery", IGNORABLE):         # swallow, the user is unaffected
```

`IGNORABLE` is right for messages and counters. It is **wrong** for stock,
refunds and accounting — applying it there is how this store sold 98 units of an
item ERPNext held 1 of, and completed returns that refunded nothing.

On the storefront, `lib/api-errors.ts` does the same job: every module still
degrades a failed read to `null`/`[]`, but calls `reportApiFailure` first. A 500
used to be indistinguishable from an empty result at every call site.

**`/admin/health` (`api/health.py`) is the check-first screen.** Every finding it
reports is a condition that was live here and announced itself to nobody. Add a
check whenever you fix a bug that a store could not have noticed on its own.

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

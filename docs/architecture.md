# Architecture

This is the reference document for Ovira Marketplace. Decisions recorded here are
the contract the rest of the code follows.

## 1. Guiding principles

1. **ERPNext is the single source of truth.** Inventory, accounting, orders,
   invoices, customers, and suppliers live in ERPNext. The marketplace never keeps
   a second copy of financial truth.
2. **Decoupled frontend.** The customer experience is a separate Next.js app so we
   are not limited by Frappe's server-rendered templates. It talks to the backend
   over versioned REST endpoints and a realtime socket.
3. **Marketplace logic lives in one custom app.** All vendor, commission,
   settlement, and shipping logic is in the `ovira_marketplace` Frappe app — never
   patched into ERPNext core, so upgrades stay clean.
4. **Mode switch, not two products.** A single setting toggles `multi_vendor` vs
   `single_company`. The same codebase runs both.
5. **Global-ready, Egypt-first.** Payment and shipping providers sit behind a
   provider-neutral connector interface. We ship Egyptian providers first; adding a
   global provider is a new connector class, not a rewrite.

## 2. Layers

### Clients
- **Storefront (web):** browse, search, product, cart, checkout. SSR for SEO/speed.
- **PWA / mobile:** the same Next.js app installed as an app; offline shell, push.
- **Vendor panel:** onboarding, catalog, orders, payouts, expenses, purchases.
- **Buyer panel:** orders, tracking, returns, wishlist, reviews, addresses.

### Frontend (Next.js 15)
- App Router, React Server Components, TypeScript end to end.
- Acts as a thin BFF: server actions/route handlers call Frappe, never expose
  admin tokens to the browser.
- Design system from `brand/` (Ovira blue `#0E8BFF` + white), Tailwind + shadcn/ui,
  Lucide icons everywhere, full RTL.

### API (Frappe)
- Versioned whitelisted endpoints under `/api/method/ovira_marketplace.api.*`.
- Token/JWT auth for storefront; session auth for desk.
- Webhooks (payment/shipping callbacks) and SocketIO for live order/tracking/chat.

### Core
- **`ovira_marketplace`** — marketplace DocTypes + business logic (see
  [data-model.md](data-model.md)).
- **ERPNext v16** — Selling, Buying, Stock, Accounts, CRM.

### Data + integrations
- **MariaDB** (Frappe's DB), **Redis** (cache/queue/socket), **Typesense** (search).
- **Payment connectors:** Paymob, Fawry first; Stripe/Tap pluggable.
- **Shipping connectors:** Bosta, Aramex first; DHL/SMSA pluggable.

## 3. Multi-vendor model in ERPNext

A vendor is represented by linked ERPNext records so they get real accounting:

| Concept              | ERPNext record(s)                                  |
|----------------------|----------------------------------------------------|
| Vendor identity      | `Supplier` + `Customer` + `User` + `Contact`       |
| Vendor catalog item  | `Item` + `Website Item` (owned/tagged by vendor)    |
| Customer order       | `Sales Order` → `Sales Invoice` → `Delivery Note`   |
| Split per vendor     | one `Marketplace Order`, N vendor sub-orders        |
| Commission           | `Marketplace Commission Rule` + `Journal Entry`     |
| Vendor payout        | `Vendor Payout` → `Payment Entry` / `Journal Entry` |
| Vendor expenses      | `Purchase Invoice` / `Expense Claim`                |
| Vendor purchases     | `Purchase Order` / `Purchase Invoice`               |

In `single_company` mode the vendor split collapses to one seller (the operator),
and the same order pipeline runs without commission/settlement steps.

## 4. Order pipeline (multi-vendor)

```
cart → checkout → Marketplace Order (1)
                    ├─ vendor A sub-order → Sales Order → Invoice → Delivery
                    └─ vendor B sub-order → Sales Order → Invoice → Delivery
payment captured → mark paid → notify vendors
fulfilment + shipping connector → tracking events (socket)
settlement run → commission booked → Vendor Payout
```

## 5. Security & performance posture

- Secrets in env / Frappe site config, never in the repo.
- Storefront never holds an admin key; all privileged calls are server-side.
- Rate limiting + idempotency keys on checkout and payment webhooks.
- Redis caching for catalog reads; Typesense for search; CDN for static/media.
- Background jobs (Frappe queue) for settlements, emails, search indexing.

## 6. Deployment

Everything runs on the existing Ubuntu 24 VPS via Docker Compose: the Frappe bench
stack (already there) plus the Next.js storefront container, fronted by
Nginx/Traefik with TLS. See `deploy/` (added in Phase 2).

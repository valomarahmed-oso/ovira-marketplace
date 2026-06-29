# Data model

Custom DocTypes added by `ovira_marketplace`, and how each links into ERPNext.
DocType names are final; field lists here are the intended shape (built in Phase 1).

## Configuration

### Marketplace Settings (Single)
Global switchboard.
- `mode` — Select: `Multi Vendor` | `Single Company`
- `operator_company` — Link Company (the marketplace owner)
- `default_currency`, `supported_currencies` (Table)
- `default_commission_rate` (Percent)
- `auto_approve_vendors`, `auto_approve_products` (Check)
- `payout_schedule` — Select: Weekly | Biweekly | Monthly
- `default_payment_connector`, `default_shipping_connector` (Link)

## Vendor

### Marketplace Vendor
The seller account; the bridge to ERPNext accounting.
- `vendor_name`, `slug`, `logo`, `banner`, `status` (Draft/Pending/Active/Suspended)
- `user` → Link User · `supplier` → Link Supplier · `customer` → Link Customer
- `commission_rate` (override) · `payout_method`, `bank_details`
- `rating` (read-only, rolled up) · `store_policies` (returns, shipping)

### Marketplace Vendor KYC
- `vendor` → Link · documents table · `verification_status` · `reviewed_by`

## Catalog

### Marketplace Product
Vendor-facing wrapper around an ERPNext `Item` / `Website Item`.
- `item` → Link Item · `website_item` → Link Website Item
- `vendor` → Link Marketplace Vendor
- `approval_status` (Draft/Pending/Approved/Rejected) · `condition`
- `price`, `currency`, `stock_qty` (synced from ERPNext bin)
- `attributes` (Table) · `media` (Table) · SEO fields

### Marketplace Category
- Tree DocType, maps to `Item Group`; icon, banner, display order.

## Orders

### Marketplace Order
Customer-facing order; parent of per-vendor sub-orders.
- `customer` → Link Customer · `status` · `currency` · totals
- `payment_status`, `payment_connector`, `payment_reference`
- `items` (Table: Marketplace Order Item)

### Marketplace Order Item
- `marketplace_product`, `vendor`, `qty`, `rate`, `commission_amount`
- `sales_order` → Link Sales Order (the vendor sub-order)

## Money

### Marketplace Commission Rule
- scope (global / category / vendor) · `rate` · `min_fee` · `effective_from`

### Vendor Payout
- `vendor` · `period` · `gross`, `commission`, `net`
- `payment_entry` → Link Payment Entry · `journal_entry` → Link Journal Entry
- `status` (Draft/Approved/Paid)

## Shipping

### Shipping Provider
Connector configuration (one row per integration).
- `provider` (Bosta/Aramex/...) · credentials (encrypted) · `enabled`
- `services` (Table: service code, name, cod_supported, zones)

### Shipment
- `marketplace_order`, `vendor`, `provider`, `tracking_number`, `label_url`
- `status`, `events` (Table) · links ERPNext `Shipment` / `Delivery Note`

## Payments

### Payment Connector
- `provider` (Paymob/Fawry/...) · credentials (encrypted) · `mode` (test/live)
- `supported_methods` (card, wallet, COD, installments)

## Engagement (Amazon/Noon parity)

- **Product Review** — `marketplace_product`, `customer`, `rating`, `body`, media,
  `verified_purchase`.
- **Vendor Review** — store-level rating.
- **Wishlist** — `customer`, items table.
- **Cart** — server-side draft; converts to Marketplace Order at checkout.
- **Promotion / Coupon** — maps to ERPNext `Pricing Rule` + `Coupon Code`.
- **Return / RMA** — `marketplace_order_item`, reason, `status`, links Return.

## Naming & module map

| Module    | DocTypes                                                        |
|-----------|-----------------------------------------------------------------|
| Marketplace | Marketplace Settings, Order, Order Item, Category, Product, reviews, cart, wishlist, promotions, returns |
| Vendor    | Marketplace Vendor, Vendor KYC, Vendor Payout, Commission Rule  |
| Shipping  | Shipping Provider, Shipment                                     |
| Payments  | Payment Connector                                               |

# ovira_marketplace (Frappe app)

The marketplace brain for Ovira: custom DocTypes and business logic installed into
an ERPNext v16 bench. The customer-facing storefront lives separately (`../storefront`).

## Install

```bash
bench get-app ovira_marketplace <git-url-or-local-path>
bench --site <your-site> install-app ovira_marketplace
bench --site <your-site> migrate
```

`after_install` provisions the marketplace roles
(Operator, Vendor, Vendor Staff, Buyer).

## Modules

- **Marketplace** — settings, orders, catalog, categories, reviews, cart, promotions.
- **Vendor** — vendor accounts, KYC, commission rules, payouts.
- **Shipping** — shipping providers and shipments.
- **Payments** — payment connectors.

See `../docs/data-model.md` for the full DocType design.

## License

MIT

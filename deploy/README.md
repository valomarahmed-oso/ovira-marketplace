# Deploying Ovira

Two parts ship to the VPS: the **Frappe app** (installed into the existing ERPNext
bench) and the **Next.js storefront** (a container behind nginx, same origin as the
Frappe API so auth cookies work).

## 1. Install the Frappe app

Get the `backend/ovira_marketplace` app into the bench (push it to a git repo and
`bench get-app <url>`, or copy the folder into the bench `apps/` directory), then:

```bash
docker compose exec backend bench --site <your-site> install-app ovira_marketplace
docker compose exec backend bench --site <your-site> migrate
docker compose restart backend
```

`before/after_install` create the four roles and seed Marketplace Settings.

## 2. Configure the marketplace

In ERPNext Desk → **Marketplace Settings**: set the mode (Multi Vendor /
Single Company), operator company, default currency, and commission rate. Create a
few **Marketplace Category** records and approve some **Marketplace Product** records
so the storefront has live data.

## 3. Run the storefront + proxy

```bash
cd deploy
cp .env.example .env        # set FRAPPE_URL and FRAPPE_NETWORK
docker network ls           # confirm the Frappe network name for FRAPPE_NETWORK
docker compose up -d --build
```

- `FRAPPE_URL` is the public site URL (e.g. `https://shop.yourdomain.com`). The
  storefront reads it as `NEXT_PUBLIC_FRAPPE_URL`; if empty, the store runs on mock
  data.
- `FRAPPE_NETWORK` is the existing Frappe docker network so nginx can reach `backend`.

nginx (`nginx/ovira.conf`) routes `/api`, `/app`, `/assets`, `/files`, `/socket.io`,
… to Frappe and everything else to the storefront — one origin, so storefront ↔
Frappe auth/session cookies just work.

## 4. Domain + TLS

Point your domain at the VPS, then terminate TLS either by adding certbot to nginx
or by fronting this with your existing Traefik. Make sure the Frappe site responds to
that hostname (`bench setup add-domain` / `host_name` in site config).

## 5. Verify

- `https://shop.yourdomain.com` → storefront home with **live** products.
- Place a test order → a **Marketplace Order** appears in Desk with a **Sales Order**
  per vendor and commission booked on each line.
- Register a vendor → Supplier + Customer auto-provisioned on activation.

## Notes

- The storefront degrades gracefully to mock data when the backend is unreachable, so
  a proxy/API misconfig shows mock products rather than a blank page — check
  `NEXT_PUBLIC_FRAPPE_URL` and the nginx routing if you see mock data in production.
- Payment capture and shipping connectors are the next backend milestone; checkout
  currently creates the order as `Pending Payment`.

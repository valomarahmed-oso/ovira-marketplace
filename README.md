# Ovira Marketplace

منصة ماركت بليس متعددة البائعين (multi-vendor) متكاملة بالكامل مع ERPNext v16، مع
إمكانية التشغيل كمتجر شركة واحدة (single-company). واجهة عصرية بمستوى أمازون/نون،
PWA، عربي/إنجليزي (RTL)، وبنية قابلة للتوسّع عالميًا.

> A multi-vendor marketplace fully integrated with ERPNext v16, switchable to a
> single-company store. Modern storefront, PWA, Arabic/English (RTL), built to scale.

## Architecture at a glance

Decoupled by design. ERPNext is the single source of truth; a custom Frappe app
holds all marketplace logic; a Next.js storefront delivers the customer experience.

```
clients (web · PWA · vendor · buyer)
        │
   Next.js 15 storefront  (SSR · PWA · design system)
        │   REST + WebSocket
   Frappe API
        │
   ovira_marketplace app  ──  ERPNext v16 core
        │
   data (MariaDB · Redis · Typesense) · connectors (payments · shipping)
```

See [docs/architecture.md](docs/architecture.md) for the full picture.

## Repository layout

```
.
├── README.md
├── docs/                     architecture, data model, roadmap (the "book")
├── backend/
│   └── ovira_marketplace/    the custom Frappe app (installed into the bench)
├── storefront/               Next.js 15 app (added in Phase 2)
├── deploy/                   docker-compose, nginx/traefik, env templates
└── brand/                    logo and brand assets
```

## Tech stack

| Layer        | Choice                                              |
|--------------|-----------------------------------------------------|
| ERP / backend| ERPNext v16 + Frappe v16 (Python)                   |
| Custom app   | `ovira_marketplace` Frappe app                      |
| Storefront   | Next.js 15 (App Router) + TypeScript                |
| UI           | Tailwind CSS + shadcn/ui + Lucide icons + Framer Motion |
| Data/state   | TanStack Query + Zustand                            |
| Search       | Typesense (Amazon-style instant, typo-tolerant)     |
| Realtime     | Frappe SocketIO                                     |
| PWA          | Serwist                                             |
| Infra        | Docker Compose · Redis · Nginx/Traefik · CDN        |

## Status

Phase 0 — foundation. See [docs/roadmap.md](docs/roadmap.md).

## Deploying the custom app to the VPS

The app is developed here and installed into your dockerized Frappe bench:

```bash
# inside the backend container / bench
bench get-app ovira_marketplace <git-url-or-path>
bench --site <your-site> install-app ovira_marketplace
bench --site <your-site> migrate
```

# @ovira/core

Domain types, API client and money maths shared by the web storefront and the
mobile app.

**Why this exists.** A second client doubles the work only if you let it. Types,
endpoints and pricing are the same on both platforms; only the UI genuinely
differs. Everything that isn't UI lives here, so a fix to a price calculation or
an endpoint is made once. That is what makes a native app affordable for a single
developer.

```
packages/core     ← types · API client · pricing
      ↓                        ↓
 storefront/                mobile/
 (Next.js, DOM)          (React Native)
```

## Using it

Each host configures the seam once at start-up and then stops caring which
platform it is running on:

```ts
import { configure } from "@ovira/core";

configure({
  baseUrl: process.env.EXPO_PUBLIC_FRAPPE_URL!,
  useCookies: false,                    // true in the browser
  getAuthHeaders: async () => ({ "X-Frappe-CSRF-Token": await csrfToken() }),
  onError: (source, reason) => console.error(`[ovira] ${source}`, reason),
});
```

The seam is there because the two hosts disagree about exactly three things:
where the base URL comes from, how a session travels (a same-origin cookie the
browser attaches itself vs a token the app must send), and what to do when a call
fails. Naming those three in one file keeps them out of fifty call sites.

## The rule about pricing

`src/pricing.ts` mirrors `backend/ovira_marketplace/ovira_marketplace/totals.py`
and `taxes.py` **function for function**, and `src/pricing.test.ts` uses the same
cases as the Python tests — including 90 EGP inclusive → 78.95 + 11.05, the
figures that prompted the whole tax investigation.

**Change one, change the other, in the same commit.** The server is the
authority and recomputes everything; this copy exists only so the cart can show a
total before the order is placed. When they drift, the shopper agrees to one
number and is billed another.

```bash
npm test        # node --test, no build step
npm run typecheck
```

## Not yet used by the storefront — and why

The storefront's Docker build context is `storefront/` alone:

```dockerfile
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
```

Adding `"@ovira/core": "file:../packages/core"` to `storefront/package.json`
would therefore **break the production image**, because `packages/` isn't in the
context. Migrating the storefront onto this package is a deliberate piece of work
that has to include:

1. moving the Docker build context up to the repo root (and the `COPY` paths with
   it), in `storefront/Dockerfile` and `deploy/docker-compose.yml`;
2. an npm workspace at the repo root;
3. replacing `storefront/src/lib/*-api.ts` module by module, verifying each.

Until then the storefront keeps its own copy of this logic. The duplication is
known and bounded — and the pricing tests on both sides are written from the same
cases so a drift shows up as a failing test rather than as a wrong invoice.

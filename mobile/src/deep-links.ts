/**
 * Turning a web URL into a screen.
 *
 * Two things arrive as URLs and both have to end up somewhere sensible:
 *
 * - **A shared link** — `https://demo.ovira.cloud/shop/products/rwakwl` from a
 *   WhatsApp message. The app claims that host, so tapping it must open the
 *   product rather than a browser, or the deep link is worse than no deep link.
 * - **A notification** — the server puts a storefront path in the payload
 *   (`/shop/account/orders/OVR-000097`), written for the website years before
 *   this app existed. Rewriting every send site to speak app routes would mean
 *   the web and the app could drift apart; translating here means one map.
 *
 * Anything unrecognised goes home. A notification that opens a blank screen is
 * worse than one that opens the shop.
 *
 * **`android.intentFilters` in `app.json` is the other half of this file, and
 * the two have to agree.** A path listed there that this router drops opens the
 * app on the home screen; a path this router handles that is missing there
 * never reaches the app at all — Android hands it to the browser instead. When
 * you add a case below, add the prefix there in the same commit.
 *
 * The two that matter most are `/shop/track?order=…` and
 * `/shop/account/notifications`: those are the strings
 * `api/notifications.py` and `notifications/channels.py` put in push payloads,
 * so a gap in either half is a push that opens the wrong screen.
 */

/**
 * Some destinations belong to the website, not the app.
 *
 * The operator console is a desk tool — twelve screens of tables that would be
 * a lie on a phone. Rather than swallow an operator's notification and show
 * them the shop, the app hands the URL to the browser and lets the real console
 * open. "We don't do this here, but here's what does" beats a dead end.
 */
export type ExternalRoute = { external: string };

export type AppRoute =
  | { pathname: "/"; params?: Record<string, string> }
  | { pathname: "/vendor"; params?: Record<string, string> }
  | { pathname: "/vendor/orders"; params?: Record<string, string> }
  | { pathname: "/search"; params?: Record<string, string> }
  | { pathname: "/cart"; params?: Record<string, string> }
  | { pathname: "/account"; params?: Record<string, string> }
  | { pathname: "/account/orders"; params?: Record<string, string> }
  | { pathname: "/account/wallet"; params?: Record<string, string> }
  | { pathname: "/account/points"; params?: Record<string, string> }
  | { pathname: "/product/[slug]"; params: { slug: string } }
  | { pathname: "/category/[slug]"; params: { slug: string } }
  | { pathname: "/order/[name]"; params: { name: string } }
  | { pathname: "/support/[name]"; params: { name: string } }
  | { pathname: "/account/notifications"; params?: Record<string, string> }
  | { pathname: "/account/returns"; params?: Record<string, string> }
  | { pathname: "/account/support"; params?: Record<string, string> }
  | { pathname: "/account/messages"; params?: Record<string, string> }
  | { pathname: "/account/alerts"; params?: Record<string, string> }
  | { pathname: "/wishlist"; params?: Record<string, string> }
  | { pathname: "/products"; params?: Record<string, string> }
  | { pathname: "/deals"; params?: Record<string, string> }
  | { pathname: "/stores"; params?: Record<string, string> }
  | { pathname: "/store/[slug]"; params: { slug: string } }
  | { pathname: "/track"; params?: { order?: string; token?: string } }
  | { pathname: "/about"; params?: Record<string, string> }
  | { pathname: "/careers"; params?: Record<string, string> }
  | { pathname: "/terms"; params?: Record<string, string> }
  | { pathname: "/privacy"; params?: Record<string, string> }
  | { pathname: "/sell"; params?: Record<string, string> }
  | { pathname: "/compare"; params?: Record<string, string> }
  | { pathname: "/vendor/products"; params?: Record<string, string> }
  | { pathname: "/vendor/shipments"; params?: Record<string, string> }
  | { pathname: "/vendor/coupons"; params?: Record<string, string> }
  | { pathname: "/vendor/analytics"; params?: Record<string, string> }
  | { pathname: "/vendor/insights"; params?: Record<string, string> }
  | { pathname: "/vendor/reports"; params?: Record<string, string> }
  | { pathname: "/vendor/messages"; params?: Record<string, string> }
  | { pathname: "/vendor/settings"; params?: Record<string, string> };

const HOME: AppRoute = { pathname: "/" };

/** The seller's screens, by the path segment the web uses for each. */
const VENDOR_ROUTES: Record<string, AppRoute> = {
  orders: { pathname: "/vendor/orders" },
  products: { pathname: "/vendor/products" },
  shipments: { pathname: "/vendor/shipments" },
  coupons: { pathname: "/vendor/coupons" },
  analytics: { pathname: "/vendor/analytics" },
  insights: { pathname: "/vendor/insights" },
  reports: { pathname: "/vendor/reports" },
  messages: { pathname: "/vendor/messages" },
  settings: { pathname: "/vendor/settings" },
};

/** Where an app-less destination opens. Same origin the API talks to. */
const STOREFRONT = (process.env.EXPO_PUBLIC_FRAPPE_URL ?? "https://demo.ovira.cloud").replace(
  /\/+$/,
  "",
);

/** Everything the storefront serves lives under `/shop`; the app does not. */
function stripBase(path: string): string[] {
  const clean = path.split("?")[0]?.split("#")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  if (parts[0] === "shop") parts.shift();
  return parts;
}

/**
 * The query string, which most routes do not need and one route cannot work
 * without.
 *
 * `/shop/track?order=OVR-1&token=…` carries its whole identity in the query:
 * the order id says *which*, the token is the only proof a signed-out shopper
 * has. Dropping either turns the confirmation link into an empty form.
 */
function queryOf(path: string): Record<string, string> {
  const raw = path.split("#")[0]?.split("?")[1];
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split("&")) {
    const [key, value] = pair.split("=");
    if (!key) continue;
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
    } catch {
      out[key] = value ?? "";
    }
  }
  return out;
}

/**
 * `ovira://product/x`, `https://demo.ovira.cloud/shop/products/x`, or a bare
 * `/shop/products/x` — all resolve the same way.
 */
export function isExternal(route: AppRoute | ExternalRoute): route is ExternalRoute {
  return "external" in route;
}

export function routeFor(url?: string | null): AppRoute | ExternalRoute {
  if (!url) return HOME;

  let path = url;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      const parsed = new URL(url);
      // For `https://demo.ovira.cloud/shop/...` the host is a real host and the
      // path is everything. For `ovira://product/rwakwl` there is no host at
      // all — the URL parser just calls the first segment one, and dropping it
      // would turn a product link into a home link.
      const custom = !/^https?:$/i.test(parsed.protocol);
      // `parsed.search` is kept: `/shop/track?order=…&token=…` is the one
      // destination whose query IS its identity.
      path = (custom ? `/${parsed.host}${parsed.pathname}` : parsed.pathname) + parsed.search;
    }
  } catch {
    /* not a URL — treat the whole string as a path */
  }

  const parts = stripBase(path);
  const query = queryOf(path);
  const [head, tail] = parts;
  if (!head) return HOME;

  const decode = (value?: string) => {
    if (!value) return "";
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  switch (head) {
    case "products":
    case "product":
      return tail
        ? { pathname: "/product/[slug]", params: { slug: decode(tail) } }
        : // `/shop/products` with no slug is the full listing, which now exists.
          // It used to fall through to home, which quietly lost the click.
          { pathname: "/products" };
    /**
     * Public tracking. Every "your order shipped" push the backend sends is
     * `/shop/track?order=…`, so losing the query here would land a shopper on
     * an empty lookup form and make the notification useless.
     */
    case "track":
      return {
        pathname: "/track",
        params: { order: query.order ?? tail ?? "", token: query.token ?? "" },
      };
    case "deals":
      return { pathname: "/deals" };
    case "wishlist":
      return { pathname: "/wishlist" };
    case "stores":
      return { pathname: "/stores" };
    case "store":
      return tail ? { pathname: "/store/[slug]", params: { slug: decode(tail) } } : { pathname: "/stores" };
    case "category":
    case "categories":
      return tail ? { pathname: "/category/[slug]", params: { slug: decode(tail) } } : HOME;
    case "orders":
    case "order":
      return tail
        ? { pathname: "/order/[name]", params: { name: decode(tail) } }
        : { pathname: "/account/orders" };
    case "search":
      return { pathname: "/search" };
    case "cart":
    case "checkout":
      return { pathname: "/cart" };
    case "wallet":
      return { pathname: "/account/wallet" };
    case "points":
    case "loyalty":
      return { pathname: "/account/points" };
    case "account":
      // `/account/orders/OVR-1` — the order id is one level deeper here.
      if (tail === "orders") {
        return parts[2]
          ? { pathname: "/order/[name]", params: { name: decode(parts[2]) } }
          : { pathname: "/account/orders" };
      }
      if (tail === "wallet") return { pathname: "/account/wallet" };
      if (tail === "points" || tail === "loyalty") return { pathname: "/account/points" };
      // `/shop/account/notifications` is the single most common push
      // destination the backend produces. It landed on the account tab until
      // the notification centre existed to send it to.
      if (tail === "notifications") return { pathname: "/account/notifications" };
      if (tail === "returns") return { pathname: "/account/returns" };
      if (tail === "support") return { pathname: "/account/support" };
      if (tail === "messages") return { pathname: "/account/messages" };
      if (tail === "alerts") return { pathname: "/account/alerts" };
      return { pathname: "/account" };
    // The content pages exist here now, so a shared link opens in the app
    // rather than bouncing someone to the browser mid-session.
    case "about":
      return { pathname: "/about" };
    case "careers":
      return { pathname: "/careers" };
    case "terms":
      return { pathname: "/terms" };
    case "privacy":
      return { pathname: "/privacy" };
    case "sell":
      return { pathname: "/sell" };
    case "compare":
      return { pathname: "/compare" };
    // The seller area is now as complete here as it is on the web, so a
    // vendor's link lands on the screen it names. Anything unrecognised still
    // stops at their own home rather than the shop front they were not
    // looking at.
    case "vendor":
      return VENDOR_ROUTES[tail ?? ""] ?? { pathname: "/vendor" };
    case "admin":
      // The console is a desk tool. Hand it to the browser rather than
      // swallowing an operator's alert.
      return { external: `${STOREFRONT}${path.startsWith("/") ? path : `/${path}`}` };
    default:
      return HOME;
  }
}

/**
 * Where a notification's subject lives in the app.
 *
 * Notifications carry a Frappe doctype + name rather than a URL, because the
 * server raising one does not know which client will read it. Mapping them here
 * keeps that knowledge in the same file as the URL routing, so a destination
 * added to one is not quietly missing from the other.
 *
 * `null` means "no useful destination" — the notification is still worth
 * showing, it just isn't worth a navigation. Returning home instead would take
 * someone away from the list they were reading for no reason.
 */
export function routeForNotification(
  doctype?: string | null,
  name?: string | null,
): AppRoute | null {
  if (!doctype || !name) return null;
  switch (doctype) {
    case "Marketplace Order":
      return { pathname: "/order/[name]", params: { name } };
    case "Marketplace Support Ticket":
      return { pathname: "/support/[name]", params: { name } };
    case "Marketplace Product":
      // The reference is the product's id, and the route wants its slug. The
      // product screen resolves either, so this is not the mismatch it looks.
      return { pathname: "/product/[slug]", params: { slug: name } };
    case "Marketplace Return Request":
      return { pathname: "/account" };
    default:
      return null;
  }
}

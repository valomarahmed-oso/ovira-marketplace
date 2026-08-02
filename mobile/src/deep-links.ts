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
  | { pathname: "/support/[name]"; params: { name: string } };

const HOME: AppRoute = { pathname: "/" };

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
      path = custom ? `/${parsed.host}${parsed.pathname}` : parsed.pathname;
    }
  } catch {
    /* not a URL — treat the whole string as a path */
  }

  const parts = stripBase(path);
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
      return tail ? { pathname: "/product/[slug]", params: { slug: decode(tail) } } : HOME;
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
      return { pathname: "/account" };
    case "vendor":
      return tail === "orders" ? { pathname: "/vendor/orders" } : { pathname: "/vendor" };
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

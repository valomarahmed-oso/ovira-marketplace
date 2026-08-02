/**
 * Where a link lands.
 *
 * This map is the only thing standing between a tapped notification and a blank
 * screen, and it is written against paths the *website* owns — so it breaks
 * silently the day someone renames a storefront route. These cases are the
 * contract.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { routeFor } from "./deep-links.ts";

describe("shared web links", () => {
  it("opens a product from the storefront's real (singular) URL", () => {
    // The route is /shop/product/<slug>. /shop/products is the listing — a
    // distinction that quietly cost the Android intent filter its whole
    // purpose until a deploy surfaced it.
    assert.deepEqual(routeFor("https://demo.ovira.cloud/shop/product/rwakwl"), {
      pathname: "/product/[slug]",
      params: { slug: "rwakwl" },
    });
  });

  it("still understands the plural, in case an old link is shared", () => {
    assert.deepEqual(routeFor("https://demo.ovira.cloud/shop/products/rwakwl"), {
      pathname: "/product/[slug]",
      params: { slug: "rwakwl" },
    });
  });

  it("decodes an Arabic slug", () => {
    // Old shared links still carry the pre-Latinisation form, percent-encoded.
    assert.deepEqual(routeFor("https://demo.ovira.cloud/shop/category/%D8%A3%D9%84%D8%B9%D8%A7%D8%A8"), {
      pathname: "/category/[slug]",
      params: { slug: "ألعاب" },
    });
  });

  it("ignores query strings and fragments", () => {
    assert.deepEqual(routeFor("https://demo.ovira.cloud/shop/products/x?utm_source=wa#reviews"), {
      pathname: "/product/[slug]",
      params: { slug: "x" },
    });
  });
});

describe("notification payloads", () => {
  it("opens the order a shipping update is about", () => {
    assert.deepEqual(routeFor("/shop/account/orders/OVR-000097"), {
      pathname: "/order/[name]",
      params: { name: "OVR-000097" },
    });
  });

  it("falls back to the order list when no order is named", () => {
    assert.deepEqual(routeFor("/shop/account/orders"), { pathname: "/account/orders" });
  });

  it("routes store credit and points to their own screens", () => {
    assert.deepEqual(routeFor("/shop/account/wallet"), { pathname: "/account/wallet" });
    assert.deepEqual(routeFor("/shop/account/points"), { pathname: "/account/points" });
  });

  it("takes the plain /shop payload home", () => {
    assert.deepEqual(routeFor("/shop"), { pathname: "/" });
  });
});

describe("the custom scheme", () => {
  it("works without a host", () => {
    assert.deepEqual(routeFor("ovira://product/rwakwl"), {
      pathname: "/product/[slug]",
      params: { slug: "rwakwl" },
    });
  });
});

describe("seller and operator destinations", () => {
  it("sends a seller to their own order list, not the buyer's page", () => {
    assert.deepEqual(routeFor("/shop/vendor/orders"), { pathname: "/vendor/orders" });
    assert.deepEqual(routeFor("/shop/vendor"), { pathname: "/vendor" });
  });

  it("hands the operator console to the browser instead of swallowing it", () => {
    const route = routeFor("/shop/admin/orders");
    assert.ok("external" in route);
    assert.equal(route.external, "https://demo.ovira.cloud/shop/admin/orders");
  });
});

/**
 * These are not hypothetical URLs. Every one of them is a string the backend
 * actually puts in a push payload — see `api/notifications.py` and
 * `notifications/channels.py` — so a gap here is a notification that opens the
 * wrong screen in production.
 */
describe("the URLs the backend actually sends", () => {
  it("opens the notification centre, not the account tab", () => {
    // `/shop/account/notifications` is the most common push destination there
    // is, and it landed on the account tab until the centre existed.
    assert.deepEqual(routeFor("/shop/account/notifications"), {
      pathname: "/account/notifications",
    });
  });

  it("carries the order and token through to tracking", () => {
    // The whole identity of this link is in its query: the id says which order,
    // the token is the only proof a signed-out shopper has.
    assert.deepEqual(routeFor("/shop/track?order=OVR-000097&token=abc123"), {
      pathname: "/track",
      params: { order: "OVR-000097", token: "abc123" },
    });
  });

  it("still tracks when the push carried only an order", () => {
    assert.deepEqual(routeFor("/shop/track?order=OVR-000097"), {
      pathname: "/track",
      params: { order: "OVR-000097", token: "" },
    });
  });

  it("keeps the query when the link arrives as a full URL", () => {
    assert.deepEqual(routeFor("https://demo.ovira.cloud/shop/track?order=OVR-1&token=t"), {
      pathname: "/track",
      params: { order: "OVR-1", token: "t" },
    });
  });

  it("opens an order from the buyer's own path", () => {
    assert.deepEqual(routeFor("/shop/account/orders/OVR-000097"), {
      pathname: "/order/[name]",
      params: { name: "OVR-000097" },
    });
  });
});

describe("screens that used to be missing now resolve", () => {
  it("routes the listings, saved items and content pages", () => {
    const cases: Array<[string, string]> = [
      ["/shop/products", "/products"],
      ["/shop/deals", "/deals"],
      ["/shop/stores", "/stores"],
      ["/shop/wishlist", "/wishlist"],
      ["/shop/compare", "/compare"],
      ["/shop/careers", "/careers"],
      ["/shop/terms", "/terms"],
      ["/shop/privacy", "/privacy"],
      ["/shop/about", "/about"],
      ["/shop/sell", "/sell"],
      ["/shop/account/returns", "/account/returns"],
      ["/shop/account/support", "/account/support"],
      ["/shop/account/messages", "/account/messages"],
      ["/shop/account/alerts", "/account/alerts"],
    ];
    for (const [url, pathname] of cases) {
      assert.deepEqual(routeFor(url), { pathname }, url);
    }
  });

  it("sends a store link to that store", () => {
    assert.deepEqual(routeFor("/shop/store/test"), {
      pathname: "/store/[slug]",
      params: { slug: "test" },
    });
  });
});

describe("anything else goes home", () => {
  it("never returns a route that does not exist", () => {
    // A blank screen is a worse outcome than the shop front, so unknown paths
    // resolve rather than fail.
    for (const url of ["", null, undefined, "not a url", "/shop/nonsense"]) {
      assert.deepEqual(routeFor(url), { pathname: "/" });
    }
  });

  it("keeps a seller inside the seller area for a screen the app lacks", () => {
    // The app has every seller screen the web has *except* the operator
    // console, so this is now about genuinely unknown segments. Their own home
    // is a far better landing than the shop front they were not looking at.
    assert.deepEqual(routeFor("/shop/vendor/payouts"), { pathname: "/vendor" });
  });

  it("routes every seller screen the app now has", () => {
    // These used to all collapse to /vendor. Each one exists now, and a link a
    // seller was sent should open the thing it names.
    for (const segment of [
      "orders",
      "products",
      "shipments",
      "coupons",
      "analytics",
      "insights",
      "reports",
      "messages",
      "settings",
    ]) {
      assert.deepEqual(
        routeFor(`/shop/vendor/${segment}`),
        { pathname: `/vendor/${segment}` },
        segment,
      );
    }
  });
});

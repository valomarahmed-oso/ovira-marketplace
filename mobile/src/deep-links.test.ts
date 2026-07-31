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
  it("opens a product from a full storefront URL", () => {
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

describe("anything else goes home", () => {
  it("never returns a route that does not exist", () => {
    // A blank screen is a worse outcome than the shop front, so unknown paths
    // resolve rather than fail.
    for (const url of ["", null, undefined, "/shop/vendor/dashboard", "not a url", "/shop/products"]) {
      assert.deepEqual(routeFor(url), { pathname: "/" });
    }
  });
});

/**
 * The rules the HTTP layer exists to enforce, plus one regression.
 *
 * The regression: `get()` used to skip the request whenever `baseUrl` was
 * falsy, as a guard against being called before `configure()`. But an empty
 * base URL is a legitimate setting — it means *same origin*, which is how the
 * storefront is served and how the mobile app reaches Metro's dev proxy. The
 * guard turned that configuration into an app where every read returned `null`
 * and nothing was logged: precisely the silent failure this package was written
 * to end.
 *
 * These tests must stay in declaration order — the first one asserts behaviour
 * before `configure()` has ever been called.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { configure, isConfigured } from "../dist/config.js";
import { get, post } from "../dist/http.js";

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

type Call = { url: string; init?: RequestInit };

function stubFetch(body: unknown, status = 200): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok: status < 400,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("before configure()", () => {
  it("sends nothing and answers null", async () => {
    const calls = stubFetch({ message: "never" });
    assert.equal(isConfigured(), false);
    assert.equal(await get("some.method"), null);
    assert.equal(calls.length, 0);
  });

  it("refuses a write outright instead of pretending it worked", async () => {
    await assert.rejects(() => post("some.method", { a: 1 }));
  });
});

describe("with an empty baseUrl (same origin)", () => {
  const errors: string[] = [];

  it("still makes the request, relative", async () => {
    configure({ baseUrl: "", useCookies: true, onError: (s) => errors.push(s) });
    const calls = stubFetch({ message: [{ name: "PRD-1" }] });

    const rows = await get<{ name: string }[]>("ovira_marketplace.api.catalog.list_products", {
      limit: 2,
    });

    assert.deepEqual(rows, [{ name: "PRD-1" }]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "/api/method/ovira_marketplace.api.catalog.list_products?limit=2");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.deepEqual(errors, []);
  });
});

describe("with an absolute baseUrl", () => {
  const errors: string[] = [];

  it("prefixes the origin and drops empty params", async () => {
    configure({ baseUrl: "https://demo.ovira.cloud", useCookies: false, onError: (s) => errors.push(s) });
    const calls = stubFetch({ message: { currency: "EGP" } });

    await get("ovira_marketplace.api.settings.get_public_config", { search: "", limit: 5 });

    assert.equal(
      calls[0]?.url,
      "https://demo.ovira.cloud/api/method/ovira_marketplace.api.settings.get_public_config?limit=5",
    );
    assert.equal(calls[0]?.init?.credentials, undefined);
  });

  it("degrades a failed read to null, but says so", async () => {
    stubFetch({ exception: "boom" }, 500);
    assert.equal(await get("ovira_marketplace.api.catalog.list_products"), null);
    assert.ok(errors.includes("ovira_marketplace.api.catalog.list_products"));
  });

  it("throws on a failed write, carrying the server's own reason", async () => {
    stubFetch(
      { _server_messages: JSON.stringify([JSON.stringify({ message: "الكمية غير متاحة" })]) },
      417,
    );
    await assert.rejects(() => post("ovira_marketplace.api.checkout.place_order"), {
      message: "الكمية غير متاحة",
    });
  });
});

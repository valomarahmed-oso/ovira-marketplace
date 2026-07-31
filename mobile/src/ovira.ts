/**
 * Wiring `@ovira/core` to a Frappe site — the app's one and only mention of a
 * network detail.
 *
 * Everything else in this app imports `listProducts`, `cartTotals`, `me` and
 * friends and never learns what host it is talking to, whether a session is a
 * cookie or a header, or what happens when a call fails. That is the point of
 * the seam: those three answers differ between web and mobile and are settled
 * here, once.
 */

import { configure } from "@ovira/core";
import { Platform } from "react-native";

/**
 * `EXPO_PUBLIC_*` is inlined into the bundle at build time, so this is a build
 * setting, not a secret — which is right, since it is only ever a public
 * origin. The fallback is the live demo so a fresh clone runs with no `.env`.
 */
const SITE = (process.env.EXPO_PUBLIC_FRAPPE_URL ?? "https://demo.ovira.cloud").replace(/\/+$/, "");

/**
 * On a device this is the site itself: React Native's fetch is a native HTTP
 * client, so there is no origin and no CORS. Under `expo start --web` the same
 * bundle runs in a browser, where a cross-origin call would be refused — so
 * calls go out relative and Metro's dev proxy forwards them (see
 * `metro.config.js`). Nothing about production changes.
 */
export const BASE_URL = Platform.OS === "web" && __DEV__ ? "" : SITE;

/** What the app is actually talking to, for display. */
export const SITE_LABEL = SITE.replace(/^https?:\/\//, "");

/** Set by `auth.me` after sign-in; writes carry it. */
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

let lastFailure: { source: string; at: number } | null = null;

/** What the shell shows when the store cannot be reached. */
export function lastApiFailure(): { source: string; at: number } | null {
  return lastFailure;
}

export function configureOvira(): void {
  configure({
    baseUrl: BASE_URL,
    locale: "ar",
    /**
     * React Native's fetch is backed by a real native cookie store (OkHttp on
     * Android, NSHTTPCookieStorage on iOS), so a Frappe `sid` survives between
     * calls exactly as it does in a browser. The CSRF token still has to be
     * sent by hand — Frappe rejects an authenticated write without it, and
     * that failure reads as "Invalid Request" with no hint of the cause.
     */
    useCookies: true,
    getAuthHeaders: (): Record<string, string> =>
      csrfToken ? { "X-Frappe-CSRF-Token": csrfToken } : {},
    /**
     * Reads still degrade to null so a dead endpoint cannot blank the app, but
     * they are no longer silent about it. Not knowing the difference between a
     * 500 and an empty result is what let real breakage sit unnoticed on the
     * storefront for days.
     */
    onError: (source, reason) => {
      lastFailure = { source, at: Date.now() };
      if (__DEV__) console.warn(`[ovira] ${source}:`, reason);
    },
  });
}

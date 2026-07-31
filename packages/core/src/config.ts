/**
 * The seam that lets one API layer serve two very different hosts.
 *
 * The web storefront and the mobile app disagree about almost everything at this
 * boundary: where the base URL comes from (`NEXT_PUBLIC_*` vs `EXPO_PUBLIC_*`),
 * how a session travels (a same-origin cookie the browser attaches on its own vs
 * a token the app has to put in a header), and what should happen when a call
 * fails (a console line vs a toast).
 *
 * Rather than teach every module about both, each host calls `configure()` once
 * at start-up and the rest of this package stops caring which one it is running
 * in. That is the whole reason a shared core is affordable for one developer:
 * the parts that genuinely differ are named here, in one place, instead of
 * leaking into fifty call sites.
 */

export type AuthHeaders = Record<string, string>;

export type CoreConfig = {
  /** Frappe origin, no trailing slash. */
  baseUrl: string;
  /**
   * Headers that authenticate a write. The browser sends its session cookie by
   * itself and only needs the CSRF token; the mobile app has no cookie jar of
   * its own and sends whatever it holds. Called per request so a token that was
   * refreshed since start-up is the one actually used.
   */
  getAuthHeaders?: () => AuthHeaders | Promise<AuthHeaders>;
  /** True where the platform attaches cookies itself (the browser). */
  useCookies?: boolean;
  /**
   * Told about every failed call. Degrading to null is right for a storefront —
   * being silent about it is not, and that is how a 500 looked identical to an
   * empty result for days.
   */
  onError?: (source: string, reason: unknown) => void;
  /** Locale for endpoints that return bilingual content. */
  locale?: "ar" | "en";
};

let config: CoreConfig = { baseUrl: "", useCookies: false, locale: "ar" };
let configured = false;

export function configure(next: Partial<CoreConfig>): void {
  config = { ...config, ...next };
  configured = true;
}

export function getConfig(): CoreConfig {
  return config;
}

/**
 * Whether a host has wired this package up yet.
 *
 * Tracked as its own flag rather than inferred from a non-empty `baseUrl`,
 * because **an empty base URL is a legitimate configuration**: it means
 * same-origin, which is how the storefront is served (`/shop` sits on the
 * Frappe site itself) and how the mobile app talks to Metro's dev proxy on web.
 * Reading emptiness as "not configured" silently answered `null` to every read
 * in exactly those cases — a whole app of empty screens and nothing in the log.
 */
export function isConfigured(): boolean {
  return configured;
}

/** Absolute URL for a Frappe whitelisted method. */
export function methodUrl(method: string, params?: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const query = qs.toString();
  return `${config.baseUrl}/api/method/${method}${query ? `?${query}` : ""}`;
}

/** Absolute URL for a file Frappe serves (product images live at /files/…). */
export function fileUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${config.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function report(source: string, reason: unknown): void {
  config.onError?.(source, reason);
}

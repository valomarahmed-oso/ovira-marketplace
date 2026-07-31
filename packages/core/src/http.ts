/**
 * One HTTP client for both hosts.
 *
 * Two rules, both learned the hard way on this project:
 *
 * 1. **A read degrades, a write throws.** A product rail that can't load should
 *    render empty rather than blank the page; a checkout that can't post must
 *    NOT pretend it succeeded. Reads return `null`, writes raise with the
 *    server's own message.
 * 2. **Nothing fails silently.** Every failure goes through `report()` before it
 *    degrades. A support queue threw on every request for days and showed a calm
 *    "no tickets" the whole time, because the layer underneath returned `null`
 *    for both "empty" and "broken".
 */

import { getConfig, methodUrl, report } from "./config.js";

/** Frappe wraps every whitelisted response in `{message: ...}`. */
type FrappeEnvelope<T> = { message?: T; exception?: string; _server_messages?: string };

async function headers(write: boolean): Promise<Record<string, string>> {
  const config = getConfig();
  const base: Record<string, string> = { Accept: "application/json" };
  if (write) base["Content-Type"] = "application/json";
  const auth = await config.getAuthHeaders?.();
  return { ...base, ...(auth ?? {}) };
}

function credentials(): RequestCredentials | undefined {
  // Only the browser has a cookie jar worth including. Sending this from React
  // Native does nothing useful and confuses some fetch polyfills.
  return getConfig().useCookies ? "include" : undefined;
}

/**
 * Pull the human-readable reason out of a Frappe error response.
 *
 * Frappe buries the useful sentence inside `_server_messages`, which is a JSON
 * string containing a JSON string. The raw `exception` field is a Python
 * traceback line — never show that to a shopper.
 */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as FrappeEnvelope<unknown>;
    const raw = data?._server_messages && JSON.parse(data._server_messages)[0];
    if (raw) return JSON.parse(raw).message ?? fallback;
    if (data?.exception) return String(data.exception).replace(/^[^:]+:\s*/, "");
  } catch {
    /* a non-JSON body tells us nothing more than the status did */
  }
  return fallback;
}

/** A read. Returns `null` on any failure, after reporting it. */
export async function get<T>(
  method: string,
  params?: Record<string, string | number | undefined>,
  init?: { signal?: AbortSignal },
): Promise<T | null> {
  const config = getConfig();
  if (!config.baseUrl) return null;
  try {
    const res = await fetch(methodUrl(method, params), {
      headers: await headers(false),
      credentials: credentials(),
      signal: init?.signal,
    });
    if (!res.ok) {
      report(method, `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()) as FrappeEnvelope<T>).message ?? null;
  } catch (err) {
    // An aborted request is the caller changing their mind, not a failure —
    // reporting it would fill the log every time someone types in the search box.
    if ((err as Error)?.name !== "AbortError") report(method, err);
    return null;
  }
}

/** A write. Throws with the server's reason — the caller must handle it. */
export async function post<T>(
  method: string,
  body?: unknown,
  fallbackError = "تعذّر تنفيذ العملية.",
): Promise<T> {
  const config = getConfig();
  if (!config.baseUrl) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(methodUrl(method), {
    method: "POST",
    headers: await headers(true),
    credentials: credentials(),
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const reason = await errorMessage(res, fallbackError);
    report(method, reason);
    throw new Error(reason);
  }
  return ((await res.json()) as FrappeEnvelope<T>).message as T;
}

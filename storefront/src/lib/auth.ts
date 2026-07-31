import type { AuthUser } from "@/lib/auth-store";
import { setCsrfToken, writeHeaders } from "@/lib/frappe-client";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/lib/i18n";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

/** The locale this browser is reading the store in. `signUp` runs client-side,
 *  so the cookie is read directly rather than through the server helper. */
function currentLocale(): string {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

const METHOD = "ovira_marketplace.api.auth";

type MeResponse = {
  authenticated: boolean;
  email?: string;
  name?: string;
  roles?: string[];
  is_vendor?: boolean;
  is_operator?: boolean;
  is_content_editor?: boolean;
  vendor?: string | null;
  vendor_status?: string | null;
  csrf_token?: string | null;
};

function toUser(m: MeResponse): AuthUser | null {
  if (!m.authenticated || !m.email) return null;
  return {
    email: m.email,
    name: m.name || m.email.split("@")[0],
    roles: m.roles ?? [],
    isVendor: !!m.is_vendor,
    isOperator: !!m.is_operator,
    isContentEditor: !!m.is_content_editor,
    vendor: m.vendor ?? null,
    vendorStatus: m.vendor_status ?? null,
  };
}

/** Read the Frappe error message out of a non-2xx response, if any. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    const raw =
      data?._server_messages && JSON.parse(data._server_messages)[0];
    if (raw) return JSON.parse(raw).message ?? fallback;
    if (data?.message && typeof data.message === "string") return data.message;
    if (data?.exception) return String(data.exception).replace(/^[^:]+:\s*/, "");
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Fetch the canonical session identity. Returns null for guests/offline. */
export async function fetchMe(): Promise<AuthUser | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/${METHOD}.me`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("auth", `HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const me = (data.message ?? {}) as MeResponse;
    setCsrfToken(me.csrf_token);
    return toUser(me);
  } catch (err) {
    reportApiFailure("auth", err);
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");

  const res = await fetch(`${BASE}/api/method/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ usr: email.trim(), pwd: password }),
    credentials: "include",
  });
  if (!res.ok) {
    // Bad credentials get the friendly Arabic message; anything else (disabled
    // account, too many attempts, …) surfaces the real server reason.
    let msg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    try {
      const data = await res.json();
      if (data?.exc_type && data.exc_type !== "AuthenticationError") {
        msg = (typeof data.message === "string" && data.message) || msg;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const user = await fetchMe();
  if (!user) throw new Error("تعذّر تأكيد الجلسة، حاول مرة أخرى.");
  return user;
}

export async function signUp(
  name: string,
  email: string,
  password: string,
  phone?: string,
): Promise<AuthUser> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");

  const res = await fetch(`${BASE}/api/method/${METHOD}.register_customer`, {
    method: "POST",
    headers: writeHeaders(),
    // The locale they signed up in decides the language of every receipt and
    // delivery code afterwards — Frappe would otherwise stamp the account with
    // the site language and mail an Arabic shopper in English.
    body: JSON.stringify({ full_name: name, email, password, phone, lang: currentLocale() }),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "تعذّر إنشاء الحساب، تأكد من البيانات."));
  }

  // Account created — open the session.
  return signIn(email, password);
}

export async function signOutServer(): Promise<void> {
  if (!BASE) return;
  try {
    // Logout is itself an authenticated write, so it needs the CSRF token too.
    await fetch(`${BASE}/api/method/logout`, {
      method: "POST",
      headers: writeHeaders(),
      credentials: "include",
    });
  } catch {
    /* ignore */
  } finally {
    setCsrfToken(null);
  }
}

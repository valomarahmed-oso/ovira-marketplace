/**
 * Session identity.
 *
 * Login goes through Frappe's own `/api/method/login`, which is form-encoded
 * rather than JSON — the one endpoint in this package that doesn't fit the
 * shared client, so it is written out here rather than bent to fit.
 */

import { getConfig, methodUrl, report } from "./config.js";
import { errorMessage, get, post } from "./http.js";
import type { Locale, SessionUser } from "./types.js";

const NS = "ovira_marketplace.api.auth";

type MeResponse = {
  authenticated: boolean;
  email?: string;
  name?: string;
  roles?: string[];
  is_vendor?: boolean;
  is_operator?: boolean;
  vendor?: string | null;
  vendor_status?: string | null;
  csrf_token?: string | null;
};

export type Session = { user: SessionUser | null; csrfToken?: string | null };

export async function me(): Promise<Session> {
  const raw = await get<MeResponse>(`${NS}.me`);
  if (!raw?.authenticated || !raw.email) return { user: null, csrfToken: raw?.csrf_token ?? null };
  return {
    csrfToken: raw.csrf_token ?? null,
    user: {
      email: raw.email,
      name: raw.name || raw.email.split("@")[0] || raw.email,
      roles: raw.roles ?? [],
      isVendor: !!raw.is_vendor,
      isOperator: !!raw.is_operator,
      vendor: raw.vendor ?? null,
      vendorStatus: raw.vendor_status ?? null,
    },
  };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const config = getConfig();
  const res = await fetch(methodUrl("login"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ usr: email.trim(), pwd: password }).toString(),
    credentials: config.useCookies ? "include" : undefined,
  });
  if (!res.ok) {
    // Bad credentials get the friendly line; anything else (disabled account,
    // too many attempts) deserves the server's real reason.
    const reason = await errorMessage(res, "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    report("login", reason);
    throw new Error(reason);
  }
  const session = await me();
  if (!session.user) throw new Error("تعذّر تأكيد الجلسة، حاول مرة أخرى.");
  return session;
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  locale?: Locale;
}): Promise<Session> {
  await post(
    `${NS}.register_customer`,
    {
      full_name: input.fullName,
      email: input.email,
      password: input.password,
      phone: input.phone,
      // The locale they signed up in decides the language of every receipt and
      // delivery code afterwards — Frappe would otherwise stamp the account with
      // the SITE language and mail an Arabic shopper in English.
      lang: input.locale ?? getConfig().locale ?? "ar",
    },
    "تعذّر إنشاء الحساب، تأكد من البيانات.",
  );
  return signIn(input.email, input.password);
}

export async function signOut(): Promise<void> {
  try {
    await post("logout");
  } catch {
    /* the session is being discarded locally either way */
  }
}

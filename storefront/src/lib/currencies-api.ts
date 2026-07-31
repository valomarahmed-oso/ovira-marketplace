// Operator client for the store-owned currency list.
//
// The marketplace owns these rows outright — nothing is read from ERPNext at
// render time. The two fetch helpers only *propose* a rate for the operator to
// accept; the stored value always wins.

import { writeHeaders } from "@/lib/frappe-client";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const NS = "ovira_marketplace.api.currencies";

export type CurrencyRow = {
  name: string;
  currency_code: string;
  currency_name?: string | null;
  currency_name_ar?: string | null;
  symbol?: string | null;
  rate_to_base: number;
  decimals: number;
  enabled: number;
  is_base: number;
  display_order: number;
  rate_source?: string | null;
  rate_updated_on?: string | null;
};

export type CurrencyList = { base: string; rows: CurrencyRow[] };

export type FetchRateResult = {
  ok: boolean;
  rate?: number;
  source?: string;
  applied?: boolean;
  error?: string;
};

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    const raw = data?._server_messages && JSON.parse(data._server_messages)[0];
    if (raw) return JSON.parse(raw).message ?? fallback;
    if (data?.exception) return String(data.exception).replace(/^[^:]+:\s*/, "");
  } catch {
    /* ignore */
  }
  return fallback;
}

async function post<T>(method: string, body: unknown, fallback: string): Promise<T> {
  if (!BASE) throw new Error(fallback);
  const res = await fetch(`${BASE}/api/method/${NS}.${method}`, {
    method: "POST",
    headers: writeHeaders({ Accept: "application/json" }),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
  return ((await res.json()).message ?? null) as T;
}

export async function listCurrencies(): Promise<CurrencyList | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/${NS}.list_all_currencies`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("currencies-api", `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()).message ?? null) as CurrencyList;
  } catch (err) {
    reportApiFailure("currencies-api", err);
    return null;
  }
}

export type CurrencyInput = {
  name?: string;
  currency_code?: string;
  currency_name?: string;
  currency_name_ar?: string;
  symbol?: string;
  rate_to_base?: number;
  decimals?: number;
  enabled?: number;
  is_base?: number;
  display_order?: number;
  rate_source?: string;
};

export function upsertCurrency(input: CurrencyInput): Promise<CurrencyList> {
  return post<CurrencyList>("upsert_currency", input, "تعذّر الحفظ.");
}

export function deleteCurrency(name: string): Promise<CurrencyList> {
  return post<CurrencyList>("delete_currency", { name }, "تعذّر الحذف.");
}

/** Propose a rate from ERPNext or the public FX API. `apply` stores it. */
export function fetchRate(
  name: string,
  source: "ERPNext" | "API",
  apply = 0
): Promise<FetchRateResult> {
  return post<FetchRateResult>("fetch_rate", { name, source, apply }, "تعذّر جلب السعر.");
}

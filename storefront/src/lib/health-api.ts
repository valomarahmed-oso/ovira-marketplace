// Store health — the configuration problems that don't announce themselves.
//
// Every check behind this endpoint exists because the condition it looks for was
// live on this store and nothing said so.

import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type Severity = "critical" | "warning" | "info";

export type Finding = {
  severity: Severity;
  code: string;
  title: string;
  detail: string;
  /** Where to go to fix it. */
  fix?: string | null;
  count?: number | null;
};

export type StoreHealth = {
  findings: Finding[];
  critical: number;
  warnings: number;
  healthy: boolean;
};

const EMPTY: StoreHealth = { findings: [], critical: 0, warnings: 0, healthy: true };

export async function storeHealth(): Promise<StoreHealth> {
  if (!BASE) return EMPTY;
  try {
    const res = await fetch(
      `${BASE}/api/method/ovira_marketplace.api.health.store_health`,
      { headers: { Accept: "application/json" }, credentials: "include", cache: "no-store" },
    );
    if (!res.ok) {
      reportApiFailure("health-api", `HTTP ${res.status}`);
      return EMPTY;
    }
    return ((await res.json()).message ?? EMPTY) as StoreHealth;
  } catch (err) {
    reportApiFailure("health-api", err);
    return EMPTY;
  }
}

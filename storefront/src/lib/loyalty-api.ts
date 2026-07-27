import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.loyalty";

export type LoyaltyEntry = {
  name: string;
  entry_type: "Earn" | "Redeem";
  points: number;
  reason?: string;
  reference_doctype?: string;
  reference_name?: string;
  note?: string;
  balance_after: number;
  creation: string;
};

export type LoyaltyState = {
  enabled: boolean;
  balance: number;
  earn_rate?: number;
  redeem_value?: number;
  min_redeem?: number;
  currency?: string;
  redeemable_value?: number;
  /** The next batch to lapse — shown so a balance that drops has a reason. */
  next_expiry_on?: string | null;
  next_expiry_points?: number;
  expired_points?: number;
  entries: LoyaltyEntry[];
};

export type RedeemResult = {
  balance: number;
  redeemed_points: number;
  credited_value: number;
  wallet_balance: number;
  currency: string;
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

export async function getMyPoints(): Promise<LoyaltyState | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/${M}.my_points`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as LoyaltyState | null;
  } catch {
    return null;
  }
}

export async function redeemPoints(points: number): Promise<RedeemResult> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${M}.redeem_points`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ points }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر استبدال النقاط."));
  return (await res.json()).message as RedeemResult;
}

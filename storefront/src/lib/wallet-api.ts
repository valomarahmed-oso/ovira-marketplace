import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type WalletEntry = {
  name: string;
  entry_type: "Credit" | "Debit";
  amount: number;
  reason?: string;
  reference_doctype?: string;
  reference_name?: string;
  note?: string;
  balance_after?: number;
  creation?: string;
};

export type Wallet = {
  balance: number;
  currency: string;
  entries: WalletEntry[];
};

/** The signed-in shopper's store-credit balance + recent ledger. */
export async function getWallet(): Promise<Wallet | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.wallet.get_wallet`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as Wallet | null;
  } catch {
    return null;
  }
}

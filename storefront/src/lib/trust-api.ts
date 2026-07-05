const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type VendorTrust = {
  vendor: string;
  vendor_name?: string;
  score: number;
  tier: string;
  rating: number;
  ratings_count: number;
  orders: number;
  delivered: number;
  fulfillment_rate: number | null;
  return_rate: number;
};

/** Live trust breakdown for a vendor (by docname or slug). */
export async function getVendorTrust(vendor: string): Promise<VendorTrust | null> {
  if (!BASE || !vendor) return null;
  const qs = new URLSearchParams({ vendor });
  try {
    const res = await fetch(
      `${BASE}/api/method/ovira_marketplace.api.trust.vendor_trust?${qs}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as VendorTrust | null;
  } catch {
    return null;
  }
}

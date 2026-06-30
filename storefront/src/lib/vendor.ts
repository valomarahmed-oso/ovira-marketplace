const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type VendorStore = {
  name: string;
  vendor_name: string;
  slug?: string;
  status: "Draft" | "Pending" | "Active" | "Suspended";
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

/** The current user's vendor store, or null if they don't have one. */
export async function getMyStore(): Promise<VendorStore | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.vendor.my_store`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()).message ?? null) as VendorStore | null;
  } catch {
    return null;
  }
}

export type VendorApplication = {
  vendor_name: string;
  phone?: string;
  description?: string;
};

export async function registerVendor(
  data: VendorApplication,
): Promise<{ name: string; slug?: string; status: string }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.vendor.register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر إرسال الطلب، حاول مرة أخرى."));
  return (await res.json()).message;
}

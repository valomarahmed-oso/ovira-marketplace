const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type VendorStatus = "Pending" | "Active" | "Suspended" | "Draft";

export type Vendor = {
  name: string;
  vendor_name: string;
  slug?: string;
  status: VendorStatus;
  email?: string;
  phone?: string;
  user?: string;
  supplier?: string;
  customer?: string;
  creation?: string;
};

export type VendorCounts = Record<string, number>;

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

const opUrl = (method: string, qs?: URLSearchParams) =>
  `${BASE}/api/method/ovira_marketplace.api.operator.${method}${qs ? `?${qs}` : ""}`;

export async function listVendors(params: { status?: string; search?: string } = {}): Promise<Vendor[]> {
  if (!BASE) return [];
  const qs = new URLSearchParams();
  if (params.status && params.status !== "All") qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  try {
    const res = await fetch(opUrl("list_vendors", qs), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as Vendor[];
  } catch {
    return [];
  }
}

export async function vendorStatusCounts(): Promise<VendorCounts> {
  if (!BASE) return {};
  try {
    const res = await fetch(opUrl("vendor_status_counts"), {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return {};
    return ((await res.json()).message ?? {}) as VendorCounts;
  } catch {
    return {};
  }
}

export async function setVendorStatus(
  name: string,
  status: VendorStatus,
): Promise<{ name: string; status: VendorStatus }> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(opUrl("set_vendor_status"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, status }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية."));
  return (await res.json()).message;
}

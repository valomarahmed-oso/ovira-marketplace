import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.admin";

export type ManagedRole = "Marketplace Operator" | "Marketplace Content Editor";

export type TeamMember = {
  email: string;
  full_name: string;
  enabled: boolean;
  roles: ManagedRole[];
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

export async function listTeam(): Promise<TeamMember[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}/api/method/${M}.list_team`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as TeamMember[];
  } catch {
    return [];
  }
}

export async function setTeamMember(
  email: string,
  role: ManagedRole,
  grant: boolean,
): Promise<TeamMember> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${M}.set_team_member`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ email, role, grant: grant ? 1 : 0 }),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية."));
  return (await res.json()).message as TeamMember;
}

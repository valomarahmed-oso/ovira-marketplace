import { writeHeaders } from "@/lib/frappe-client";
import { reportApiFailure } from "@/lib/api-errors";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.push";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** The site's VAPID public key, or null when web push isn't configured. */
export async function getVapidPublicKey(): Promise<string | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/method/${M}.vapid_public_key`, {
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      reportApiFailure("push", `HTTP ${res.status}`);
      return null;
    }
    return ((await res.json()).message ?? null) as string | null;
  } catch (err) {
    reportApiFailure("push", err);
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ask permission + subscribe this device. Returns a reason on failure so the
 * UI can explain (disabled / unsupported / denied). */
export async function subscribePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  const key = await getVapidPublicKey();
  if (!key) return { ok: false, reason: "disabled" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
      }));
    const res = await fetch(`${BASE}/api/method/${M}.subscribe`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ subscription: JSON.stringify(sub), user_agent: navigator.userAgent }),
      credentials: "include",
    });
    if (!res.ok) return { ok: false, reason: "save" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch(`${BASE}/api/method/${M}.unsubscribe`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ endpoint: sub.endpoint }),
      credentials: "include",
    });
    await sub.unsubscribe();
  } catch {
    /* best-effort */
  }
}

/** True when this device already has an active push subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

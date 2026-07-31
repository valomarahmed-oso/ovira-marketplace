import { reportApiFailure } from "@/lib/api-errors";
// First-touch attribution capture.
//
// On the shopper's first landing we record where they came from (UTM tags +
// referrer + landing page) into localStorage and never overwrite it, so the
// order is credited to the campaign that actually acquired the visitor rather
// than the last internal page they clicked. The backend re-derives the
// normalized channel from these raw values — this file only collects them.

const KEY = "ovira_attribution";
const MAX_AGE_DAYS = 30;

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing_page?: string;
  ts?: number;
};

function read(): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Attribution;
    // Expire stale first-touch data so a long-dormant visitor isn't credited to
    // an ancient campaign.
    if (data.ts && Date.now() - data.ts > MAX_AGE_DAYS * 864e5) return null;
    return data;
  } catch (err) {
    reportApiFailure("attribution", err);
    return null;
  }
}

/**
 * Capture attribution once, on first landing. Safe to call on every page load —
 * it no-ops if a (non-expired) first-touch record already exists, and ignores
 * purely-internal navigations that carry no UTM tags or external referrer.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    if (read()) return; // first-touch already recorded

    const params = new URLSearchParams(window.location.search);
    const pick = (k: string) => (params.get(k) || "").trim().slice(0, 140) || undefined;

    let utm_source = pick("utm_source");
    let utm_medium = pick("utm_medium");
    const utm_campaign = pick("utm_campaign");

    // Ad-click ids let us attribute paid traffic even without explicit UTMs.
    if (!utm_source && params.get("gclid")) {
      utm_source = "google";
      utm_medium = utm_medium || "cpc";
    }
    if (!utm_source && params.get("fbclid")) {
      utm_source = "facebook";
      utm_medium = utm_medium || "social";
    }

    const ref = document.referrer || "";
    // Drop same-origin referrers so internal clicks don't read as "referral".
    const sameOrigin = ref && ref.startsWith(window.location.origin);
    const referrer = sameOrigin ? undefined : ref.slice(0, 500) || undefined;

    // Only persist when there's a real signal — otherwise leave it unset so a
    // later campaign visit in the same session can still be the first touch.
    if (!utm_source && !utm_medium && !utm_campaign && !referrer) return;

    const data: Attribution = {
      utm_source,
      utm_medium,
      utm_campaign,
      referrer,
      landing_page: (window.location.pathname + window.location.search).slice(0, 500),
      ts: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* attribution is best-effort; never break the page */
  }
}

/** The stored first-touch attribution to attach to a checkout, or null. */
export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  const data = read();
  if (!data) return null;
  // Send only the marketing fields; `ts` is bookkeeping.
  const { utm_source, utm_medium, utm_campaign, referrer, landing_page } = data;
  return { utm_source, utm_medium, utm_campaign, referrer, landing_page };
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number, currency = "EGP") {
  const value = new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${value} ${currency === "EGP" ? "ج.م" : currency}`;
}

/** A delivery window as one readable line, or null when there's nothing to
 *  promise. Arabic counts one and two as their own words — "خلال 1 أيام" is
 *  what a machine says, not a shop — so those get their own phrasings. */
export function deliveryWindowText(
  t: { shipEtaDay: string; shipEtaTwoDays: string; shipEtaHint: string; shipEtaRange: string },
  min?: number,
  max?: number,
): string | null {
  const to = max ?? 0;
  const from = min ?? 0;
  if (!to) return null;
  if (from && from !== to) {
    return t.shipEtaRange.replace("{from}", String(from)).replace("{to}", String(to));
  }
  if (to === 1) return t.shipEtaDay;
  if (to === 2) return t.shipEtaTwoDays;
  return t.shipEtaHint.replace("{days}", String(to));
}

export function discountPercent(price: number, compareAt?: number) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Map an operator-chosen banner tone to its tailwind colour classes. */
const TONES: Record<string, string> = {
  Blue: "bg-blue text-white",
  Coral: "bg-coral-50 text-coral",
  "Light Blue": "bg-blue-50 text-blue-600",
  Mint: "bg-[#e7f8f1] text-mint",
  Gold: "bg-[#fdf2dd] text-[#854f0b]",
};

export function bannerTone(tone?: string) {
  return TONES[tone ?? "Blue"] ?? TONES.Blue;
}

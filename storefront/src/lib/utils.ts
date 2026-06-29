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

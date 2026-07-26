"use client";

// Display-currency selection and formatting.
//
// The store prices, charges and settles in ONE base currency. This module only
// changes how a base amount is RENDERED, so a shopper can browse in their own
// currency without any accounting moving. Nothing here ever reaches the server:
// `checkout.place_order` re-prices in the base currency regardless.
//
// Rate convention: `rate` is the value of one unit of that currency in the base
// currency (1 USD = 48.5 EGP → rate 48.5), so converting is `base / rate`.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAppConfig } from "@/components/app-config-provider";
import { useI18n } from "@/components/i18n-provider";
import type { DisplayCurrency } from "@/lib/api";

type CurrencyState = {
  /** The shopper's chosen currency code, or null to follow the base. */
  code: string | null;
  setCode: (code: string | null) => void;
};

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      code: null,
      setCode: (code) => set({ code }),
    }),
    { name: "ovira-currency" }
  )
);

/** Arabic symbol for the Egyptian pound — the one code we label specially. */
const EGP_AR = "ج.م";

function symbolFor(currency: DisplayCurrency | null, base: string, isArabic: boolean) {
  if (!currency) return base === "EGP" && isArabic ? EGP_AR : base;
  if (currency.symbol) return currency.symbol;
  return currency.code === "EGP" && isArabic ? EGP_AR : currency.code;
}

export type Money = {
  /** Format a BASE-currency amount in the shopper's chosen currency. */
  (amount: number): string;
};

export type MoneyContext = {
  money: Money;
  /** The currency actually being displayed (null when none are configured). */
  active: DisplayCurrency | null;
  /** Every currency the operator enabled. Empty ⇒ hide the switcher. */
  options: DisplayCurrency[];
  base: string;
  /** True when the shopper is viewing something other than the base currency —
   *  checkout uses this to warn that the charge happens in the base currency. */
  converted: boolean;
  setCode: (code: string | null) => void;
};

/**
 * Formatter for shopper-facing prices.
 *
 * Use this for catalog, cart and anything the shopper is deciding to buy. Do
 * NOT use it for money of record — invoices, order history, vendor payouts,
 * reports and analytics stay in the base currency, because those are settled
 * figures, not live prices. Those keep using `formatPrice` from lib/utils.
 */
export function useMoney(): MoneyContext {
  const config = useAppConfig();
  const { locale } = useI18n();
  const code = useCurrencyStore((s) => s.code);
  const setCode = useCurrencyStore((s) => s.setCode);

  const options = config.currencies ?? [];
  const base = config.currency || "EGP";
  const isArabic = locale === "ar";

  const baseOption = options.find((c) => c.is_base) ?? null;
  const chosen = code ? options.find((c) => c.code === code) ?? null : null;
  // An unknown or removed code silently falls back to the base rather than
  // rendering prices at a rate we no longer have.
  const active = chosen ?? baseOption;
  const converted = !!active && !active.is_base;

  const money: Money = (amount: number) => {
    const rate = active && active.rate > 0 ? active.rate : 1;
    const value = converted ? amount / rate : amount;
    const decimals = active ? active.decimals : 2;
    const text = new Intl.NumberFormat(isArabic ? "ar-EG" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.max(0, Math.min(6, decimals)),
    }).format(value);
    return `${text} ${symbolFor(active, base, isArabic)}`;
  };

  return { money, active, options, base, converted, setCode };
}

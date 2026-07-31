/**
 * Shell strings.
 *
 * The storefront's dictionary is ~1,600 keys covering screens this app doesn't
 * have yet, so it isn't imported wholesale. Only what the shell renders lives
 * here; screen strings arrive with their screens. The shape stays
 * key-parallel between `ar` and `en` for the same reason it does on the web —
 * a missing key must be a type error, not a blank label in production.
 */

export type Locale = "ar" | "en";

const ar = {
  tabHome: "الرئيسية",
  tabSearch: "البحث",
  tabCart: "السلة",
  tabAccount: "حسابي",

  brand: "أوفيرا",
  tagline: "سوق مصر الأول",

  soon: "قريبًا",
  soonBody: "الشاشة دي تحت التطوير وهتشتغل في التحديث الجاي.",

  connected: "متصل بالمتجر",
  connecting: "بيتصل بالمتجر…",
  offline: "تعذّر الاتصال بالمتجر",
  retry: "أعد المحاولة",

  notFound: "الصفحة غير موجودة",
  backHome: "ارجع للرئيسية",

  currency: "ج.م",
};

export type Dict = typeof ar;

const en: Dict = {
  tabHome: "Home",
  tabSearch: "Search",
  tabCart: "Cart",
  tabAccount: "Account",

  brand: "Ovira",
  tagline: "Egypt's marketplace",

  soon: "Coming soon",
  soonBody: "This screen is being built and lands in the next update.",

  connected: "Connected to the store",
  connecting: "Connecting to the store…",
  offline: "Could not reach the store",
  retry: "Try again",

  notFound: "Page not found",
  backHome: "Back to home",

  currency: "EGP",
};

const dicts: Record<Locale, Dict> = { ar, en };

export const DEFAULT_LOCALE: Locale = "ar";

export function dict(locale: Locale = DEFAULT_LOCALE): Dict {
  return dicts[locale] ?? ar;
}

/**
 * Arabic-Indic digits are what a customer here expects to read, but the value
 * itself must stay parseable, so this only ever touches display strings.
 *
 * Every number the shopper sees goes through here, not just prices. Formatting
 * the price and leaving the quantity beside it in Latin digits puts two
 * numbering systems in one line, which reads as a bug.
 */
export function num(value: number, locale: Locale = DEFAULT_LOCALE): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function money(amount: number, locale: Locale = DEFAULT_LOCALE): string {
  return `${num(amount, locale)} ${dict(locale).currency}`;
}

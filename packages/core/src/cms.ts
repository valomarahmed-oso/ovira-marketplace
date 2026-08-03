/** Operator-editable site chrome and the four content pages. */

import { fileUrl } from "./config.js";
import { get, post } from "./http.js";
import type { Locale, ProductCard } from "./types.js";

const NS = "ovira_marketplace.api";

/** An operator-scheduled banner. `placement` decides where it is allowed to go. */
export type Banner = {
  name: string;
  title?: string | null;
  title_en?: string | null;
  subtitle?: string | null;
  subtitle_en?: string | null;
  image?: string | null;
  link?: string | null;
  cta_label?: string | null;
  cta_label_en?: string | null;
  tone?: string | null;
  placement?: "Hero" | "Promo" | string;
};

/** A curated rail the operator defined, already resolved to its products. */
export type HomeSection = { heading: string; link?: string | null; products: ProductCard[] };

export type Homepage = {
  hero: Banner[];
  promos: Banner[];
  /** The featured deal, chosen by the operator or auto-picked by deepest markdown. */
  deal: ProductCard | null;
  sections: HomeSection[];
};

const EMPTY_HOME: Homepage = { hero: [], promos: [], deal: null, sections: [] };

/**
 * The whole dynamic homepage in one call.
 *
 * One request rather than four because this is the first screen: four parallel
 * round trips on a phone connection is four chances to render half a page.
 * Every part can legitimately be empty — a store with no banners configured is
 * the normal state, not a failure — so the caller falls back to its own rails.
 */
export async function getHomepage(): Promise<Homepage> {
  const home = await get<Homepage>(`${NS}.cms.get_homepage`);
  if (!home) return EMPTY_HOME;
  const withImage = (b: Banner) => ({ ...b, image: fileUrl(b.image) ?? null });
  const cards = (rows?: ProductCard[]) =>
    (rows ?? []).map((p) => ({ ...p, image: fileUrl(p.image) ?? null }));
  return {
    hero: (home.hero ?? []).map(withImage),
    promos: (home.promos ?? []).map(withImage),
    deal: home.deal ? { ...home.deal, image: fileUrl(home.deal.image) ?? null } : null,
    sections: (home.sections ?? []).map((s) => ({ ...s, products: cards(s.products) })),
  };
}

/** Pick the locale's text off a banner, falling back to the Arabic base. */
export function bannerText(
  banner: Banner,
  locale: Locale,
): { title: string; subtitle: string; cta: string } {
  const pick = (base?: string | null, en?: string | null) =>
    (locale === "en" && en?.trim() ? en : base) ?? "";
  return {
    title: pick(banner.title, banner.title_en),
    subtitle: pick(banner.subtitle, banner.subtitle_en),
    cta: pick(banner.cta_label, banner.cta_label_en),
  };
}

export type SiteContent = {
  brand_name?: string;
  brand_name_en?: string;
  footer_tagline?: string;
  footer_tagline_en?: string;
  support_email?: string;
  hero_badge?: string;
  hero_badge_en?: string;
  about_content?: string;
  about_content_en?: string;
  careers_content?: string;
  careers_content_en?: string;
  terms_content?: string;
  terms_content_en?: string;
  privacy_content?: string;
  privacy_content_en?: string;
};

/**
 * Every field can be empty, and that is the normal state of a new store — the
 * clients fall back to their own defaults rather than showing a blank page.
 */
export async function getSiteContent(): Promise<SiteContent> {
  return (await get<SiteContent>(`${NS}.cms.get_site_content`)) ?? {};
}

/**
 * Collapse the bilingual record to one locale.
 *
 * For `en`, prefer the `_en` variant and fall back to the Arabic base — an
 * operator who has written only Arabic should not leave English visitors with
 * nothing. The result exposes only the base field names.
 */
export function localizeSiteContent(content: SiteContent, locale: Locale): SiteContent {
  if (locale !== "en") return content;
  const pick = (base?: string, en?: string) => (en && en.trim() ? en : base);
  return {
    ...content,
    brand_name: pick(content.brand_name, content.brand_name_en),
    footer_tagline: pick(content.footer_tagline, content.footer_tagline_en),
    hero_badge: pick(content.hero_badge, content.hero_badge_en),
    about_content: pick(content.about_content, content.about_content_en),
    careers_content: pick(content.careers_content, content.careers_content_en),
    terms_content: pick(content.terms_content, content.terms_content_en),
    privacy_content: pick(content.privacy_content, content.privacy_content_en),
  };
}

export type VendorRegistration = { name: string; slug: string; status: string };

/**
 * Open a store. Requires a session — the vendor is attached to the signed-in
 * user, and the server refuses a guest outright.
 */
export function registerVendor(input: {
  vendor_name: string;
  email?: string;
  phone?: string;
  description?: string;
}): Promise<VendorRegistration> {
  return post(`${NS}.vendor.register`, input, "تعذّر إنشاء المتجر.");
}

/** Operator-editable site chrome and the four content pages. */

import { get, post } from "./http.js";
import type { Locale } from "./types.js";

const NS = "ovira_marketplace.api";

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

import type { MetadataRoute } from "next";
import { getCategories, getProducts, getStores } from "@/lib/api";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://demo.ovira.cloud").replace(/\/$/, "");
const BASE = `${SITE}/shop`;

export const revalidate = 3600;

/** Public sitemap: static pages + all published products, categories and stores.
 *  Served at /shop/sitemap.xml. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, stores] = await Promise.all([
    getProducts({ limit: 2000 }).catch(() => []),
    getCategories().catch(() => []),
    getStores().catch(() => []),
  ]);

  const now = new Date();
  const staticPaths = ["", "/products", "/categories", "/stores", "/deals", "/about", "/terms", "/privacy"];

  return [
    ...staticPaths.map((p) => ({
      url: `${BASE}${p}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: p === "" ? 1 : 0.7,
    })),
    ...categories.map((c) => ({
      url: `${BASE}/category/${encodeURIComponent(c.slug)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...stores.map((s) => ({
      url: `${BASE}/store/${encodeURIComponent(s.slug)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...products.map((p) => ({
      url: `${BASE}/product/${encodeURIComponent(p.slug)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

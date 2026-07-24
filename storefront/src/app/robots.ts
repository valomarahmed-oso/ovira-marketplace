import type { MetadataRoute } from "next";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://demo.ovira.cloud").replace(/\/$/, "");

/** Served at /shop/robots.txt. Public catalog is crawlable; private/dashboard
 *  and transactional routes are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/shop/",
      disallow: ["/shop/admin", "/shop/vendor", "/shop/account", "/shop/checkout", "/shop/cart", "/shop/login", "/shop/register"],
    },
    sitemap: `${SITE}/shop/sitemap.xml`,
  };
}

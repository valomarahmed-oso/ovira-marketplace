import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Hero } from "@/components/hero";
import { CategoryRail } from "@/components/category-rail";
import { ProductGrid } from "@/components/product-grid";
import { SectionHeading } from "@/components/section-heading";
import { getAppConfig, getCategories, getHomepage } from "@/lib/api";
import { bannerTone } from "@/lib/utils";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function HomePage() {
  const [categories, home, locale, config] = await Promise.all([
    getCategories(),
    getHomepage(),
    getLocale(),
    getAppConfig(),
  ]);
  const t = getDict(locale);

  return (
    <div className="container-ovira space-y-12 py-6">
      <Hero hero={home.hero[0] ?? null} deal={home.deal} t={t} multiVendor={config.multiVendor} />

      <section className="animate-fade-up">
        <SectionHeading title={t.allCategories} href="/categories" />
        <CategoryRail categories={categories} />
      </section>

      {home.promos.length > 0 && (
        <section className="grid gap-4 md:grid-cols-3">
          {home.promos.map((promo) => (
            <Link
              key={promo.name ?? promo.title}
              href={promo.link || "/products"}
              className={`group flex items-center justify-between gap-4 rounded-2xl p-6 transition-transform hover:-translate-y-0.5 ${bannerTone(promo.tone)}`}
            >
              <div>
                <div className="text-lg font-medium">{promo.title}</div>
                {promo.subtitle && <div className="text-sm opacity-90">{promo.subtitle}</div>}
              </div>
              <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            </Link>
          ))}
        </section>
      )}

      {home.sections.map((section) => (
        <section key={section.heading}>
          <SectionHeading title={section.heading} href={section.link} />
          <ProductGrid products={section.products} />
        </section>
      ))}
    </div>
  );
}

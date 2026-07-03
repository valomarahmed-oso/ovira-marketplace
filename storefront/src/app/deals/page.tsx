import { Zap } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { ProductGrid } from "@/components/product-grid";
import { getDeals } from "@/lib/api";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "عروض فلاش | أوفيرا" };

// Deals are time-boxed, so don't cache the page for long.
export const revalidate = 30;

export default async function DealsPage() {
  const [deals, locale] = await Promise.all([getDeals(48), getLocale()]);
  const t = getDict(locale);

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb items={[{ label: t.brand, href: "/" }, { label: t.dealsTitle }]} />
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-coral text-white">
          <Zap className="h-6 w-6 fill-white" />
        </span>
        <div>
          <h1 className="text-2xl font-medium text-ink md:text-3xl">{t.dealsTitle}</h1>
          <p className="mt-1 text-sm text-ink-400">{t.dealsSubtitle}</p>
        </div>
      </div>

      {deals.length ? (
        <ProductGrid products={deals} />
      ) : (
        <div className="card p-10 text-center text-ink-400">{t.dealsEmpty}</div>
      )}
    </div>
  );
}

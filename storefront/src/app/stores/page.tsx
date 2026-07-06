import { Store } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { StoreCard } from "@/components/store-card";
import { getStores } from "@/lib/api";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function StoresPage() {
  const [stores, locale] = await Promise.all([getStores(), getLocale()]);
  const t = getDict(locale);

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb items={[{ label: t.brand, href: "/" }, { label: t.storesTitle }]} />
      <div>
        <h1 className="text-2xl font-medium text-ink md:text-3xl">{t.storesTitle}</h1>
        <p className="mt-1 text-sm text-ink-400">{t.storesSubtitle}</p>
      </div>

      {stores.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <StoreCard key={s.name} store={s} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <Store className="h-8 w-8" />
          <p>{t.storesEmpty}</p>
        </div>
      )}
    </div>
  );
}

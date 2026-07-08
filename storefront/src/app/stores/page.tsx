import { Breadcrumb } from "@/components/breadcrumb";
import { StoresBrowser } from "@/components/stores-browser";
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

      <StoresBrowser initialStores={stores} locale={locale} />
    </div>
  );
}

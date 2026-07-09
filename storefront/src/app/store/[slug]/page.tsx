import { Package, ShoppingBag, Store } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { StoreProducts } from "@/components/store-products";
import { Rating } from "@/components/rating";
import { TrustBadge } from "@/components/trust-badge";
import { getProducts, getVendorStore } from "@/lib/api";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

const FRAPPE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const abs = (p?: string | null) =>
  !p ? undefined : /^https?:\/\//.test(p) ? p : `${FRAPPE}${p.startsWith("/") ? "" : "/"}${p}`;

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, locale] = await Promise.all([getVendorStore(slug), getLocale()]);
  const t = getDict(locale);

  if (!store) {
    return (
      <div className="container-ovira py-20">
        <div className="card mx-auto max-w-md space-y-3 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Store className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">{t.storeNotFoundTitle}</h1>
          <p className="text-sm text-ink-400">{t.storeNotFoundBody}</p>
        </div>
      </div>
    );
  }

  const products = await getProducts({ vendor: store.name, limit: 48 });
  const logo = abs(store.logo);
  const banner = abs(store.banner);
  const year = store.creation ? new Date(store.creation).getFullYear() : null;
  const policies = [
    { label: t.storeReturnPolicy, body: store.return_policy },
    { label: t.storeShippingPolicy, body: store.shipping_policy },
  ].filter((p) => p.body);

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb items={[{ label: t.brand, href: "/" }, { label: store.vendor_name }]} />

      {/* Store header */}
      <div className="card overflow-hidden">
        <div
          className="h-32 bg-gradient-to-l from-blue-100 to-blue-50 sm:h-40"
          style={banner ? { backgroundImage: `url(${banner})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <div className="-mt-16 grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-blue-50 shadow-card sm:-mt-20">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={store.vendor_name} className="h-full w-full object-cover" />
            ) : (
              <Store className="h-9 w-9 text-blue-600" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-medium text-ink">{store.vendor_name}</h1>
              {store.trust_tier && store.trust_tier !== "new" && (
                <TrustBadge tier={store.trust_tier} score={store.trust_score ?? undefined} showScore />
              )}
            </div>
            {typeof store.rating === "number" && store.rating > 0 && (
              <Rating value={store.rating} count={store.ratings_count ?? 0} size={16} />
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-400">
              <span className="inline-flex items-center gap-1.5">
                <Package className="h-4 w-4" /> {t.storeProductsCount.replace("{n}", String(store.product_count))}
              </span>
              {!!store.orders_count && (
                <span className="inline-flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4" />{" "}
                  {t.storeOrdersFulfilled.replace("{n}", String(store.orders_count))}
                </span>
              )}
              {year && <span>{t.storeSince.replace("{year}", String(year))}</span>}
            </div>
          </div>
        </div>
        {store.description && (
          <p className="border-t border-line px-5 py-4 text-sm leading-7 text-ink-600">{store.description}</p>
        )}
      </div>

      {policies.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {policies.map((p) => (
            <div key={p.label} className="card p-5">
              <div className="mb-1 text-sm font-medium text-ink">{p.label}</div>
              <p className="text-sm leading-6 text-ink-600">{p.body}</p>
            </div>
          ))}
        </div>
      )}

      <StoreProducts initialProducts={products} vendor={store.name} locale={locale} />
    </div>
  );
}

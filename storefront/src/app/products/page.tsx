import { Breadcrumb } from "@/components/breadcrumb";
import { ProductFilters } from "@/components/product-filters";
import { ProductGrid } from "@/components/product-grid";
import { getFacets, getProducts, searchParamsToQuery } from "@/lib/api";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "كل المنتجات | أوفيرا" };

type SP = Record<string, string | string[] | undefined>;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const query = searchParamsToQuery(sp);
  const [facets, products, locale] = await Promise.all([
    getFacets({}),
    getProducts({ ...query, limit: 48 }),
    getLocale(),
  ]);
  const t = getDict(locale);

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb items={[{ label: t.brand, href: "/" }, { label: t.allProducts }]} />
      <div>
        <h1 className="text-2xl font-medium text-ink md:text-3xl">{t.allProducts}</h1>
        <p className="mt-1 text-sm text-ink-400">{t.allProductsSub}</p>
      </div>
      <ProductFilters facets={facets} total={products.length}>
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <div className="card p-10 text-center text-ink-400">{t.noMatch}</div>
        )}
      </ProductFilters>
    </div>
  );
}

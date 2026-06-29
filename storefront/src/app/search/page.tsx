import { Breadcrumb } from "@/components/breadcrumb";
import { ProductFilters } from "@/components/product-filters";
import { ProductGrid } from "@/components/product-grid";
import { getFacets, getProducts, searchParamsToQuery } from "@/lib/api";
import { t } from "@/lib/dict";

type SP = { q?: string } & Record<string, string | string[] | undefined>;

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const query = (sp.q ?? "").toString().trim();
  const filters = searchParamsToQuery(sp);

  const [facets, products] = query
    ? await Promise.all([
        getFacets({ search: query }),
        getProducts({ ...filters, search: query, limit: 48 }),
      ])
    : [null, []];

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb items={[{ label: t.brand, href: "/" }, { label: "نتائج البحث" }]} />
      <h1 className="text-2xl font-medium text-ink md:text-3xl">
        {query ? `نتائج البحث عن «${query}»` : "ابحث عن منتجات"}
      </h1>
      {query && facets ? (
        <ProductFilters facets={facets} total={products.length}>
          {products.length ? (
            <ProductGrid products={products} />
          ) : (
            <div className="card p-10 text-center text-ink-400">لا توجد نتائج مطابقة.</div>
          )}
        </ProductFilters>
      ) : (
        <div className="card p-10 text-center text-ink-400">
          اكتب كلمة في شريط البحث بالأعلى لعرض النتائج.
        </div>
      )}
    </div>
  );
}

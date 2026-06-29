import { Breadcrumb } from "@/components/breadcrumb";
import { ProductFilters } from "@/components/product-filters";
import { ProductGrid } from "@/components/product-grid";
import { getFacets, getProducts, searchParamsToQuery } from "@/lib/api";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

type SP = { q?: string } & Record<string, string | string[] | undefined>;

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const query = (sp.q ?? "").toString().trim();
  const filters = searchParamsToQuery(sp);
  const t = getDict(await getLocale());

  const [facets, products] = query
    ? await Promise.all([
        getFacets({ search: query }),
        getProducts({ ...filters, search: query, limit: 48 }),
      ])
    : [null, []];

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb items={[{ label: t.brand, href: "/" }, { label: t.searchResults }]} />
      <h1 className="text-2xl font-medium text-ink md:text-3xl">
        {query ? t.searchResultsFor.replace("{q}", query) : t.searchTitle}
      </h1>
      {query && facets ? (
        <ProductFilters facets={facets} total={products.length}>
          {products.length ? (
            <ProductGrid products={products} />
          ) : (
            <div className="card p-10 text-center text-ink-400">{t.noResults}</div>
          )}
        </ProductFilters>
      ) : (
        <div className="card p-10 text-center text-ink-400">{t.searchPrompt}</div>
      )}
    </div>
  );
}

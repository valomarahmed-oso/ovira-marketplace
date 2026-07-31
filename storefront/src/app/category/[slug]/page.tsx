import { Breadcrumb } from "@/components/breadcrumb";
import { ProductFilters } from "@/components/product-filters";
import { ProductGrid } from "@/components/product-grid";
import { SponsoredStrip } from "@/components/sponsored-strip";
import {
  decodeSlug,
  getCategories,
  getFacets,
  getProducts,
  searchParamsToQuery,
} from "@/lib/api";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

type SP = Record<string, string | string[] | undefined>;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  // Raw from the route — an Arabic slug arrives percent-encoded and matches
  // nothing until it is decoded.
  const slug = decodeSlug((await params).slug);
  const query = searchParamsToQuery(await searchParams);
  const [categories, facets, products, locale] = await Promise.all([
    getCategories(),
    getFacets({ category: slug }),
    getProducts({ ...query, category: slug, limit: 48 }),
    getLocale(),
  ]);
  const t = getDict(locale);
  const name = categories.find((c) => c.slug === slug)?.category_name ?? slug;

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb
        items={[
          { label: t.brand, href: "/" },
          { label: t.allCategories, href: "/categories" },
          { label: name },
        ]}
      />
      <div>
        <h1 className="text-2xl font-medium text-ink md:text-3xl">{name}</h1>
        <p className="mt-1 text-sm text-ink-400">{t.categoryIntro.replace("{name}", name)}</p>
      </div>
      <SponsoredStrip category={slug} />
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

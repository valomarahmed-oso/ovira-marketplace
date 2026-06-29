import { Breadcrumb } from "@/components/breadcrumb";
import { CategoryView } from "@/components/category-view";
import { getProducts } from "@/lib/api";
import { t } from "@/lib/dict";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const products = query ? await getProducts({ search: query, limit: 24 }) : [];

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb items={[{ label: t.brand, href: "/" }, { label: "نتائج البحث" }]} />
      <h1 className="text-2xl font-medium text-ink md:text-3xl">
        {query ? `نتائج البحث عن «${query}»` : "ابحث عن منتجات"}
      </h1>
      {query ? (
        <CategoryView products={products} />
      ) : (
        <div className="card p-10 text-center text-ink-400">
          اكتب كلمة في شريط البحث بالأعلى لعرض النتائج.
        </div>
      )}
    </div>
  );
}

import { Breadcrumb } from "@/components/breadcrumb";
import { CategoryView } from "@/components/category-view";
import { getCategories, getProducts } from "@/lib/api";
import { t } from "@/lib/dict";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ category: slug, limit: 24 }),
  ]);
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
        <p className="mt-1 text-sm text-ink-400">اكتشف أفضل المنتجات في {name} من بائعين موثوقين</p>
      </div>
      <CategoryView products={products} />
    </div>
  );
}

import { Breadcrumb } from "@/components/breadcrumb";
import { CategoryView } from "@/components/category-view";
import { getProducts } from "@/lib/api";
import { t } from "@/lib/dict";

export const metadata = { title: "كل المنتجات | أوفيرا" };

export default async function ProductsPage() {
  const products = await getProducts({ limit: 60 });

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb items={[{ label: t.brand, href: "/" }, { label: "كل المنتجات" }]} />
      <div>
        <h1 className="text-2xl font-medium text-ink md:text-3xl">كل المنتجات</h1>
        <p className="mt-1 text-sm text-ink-400">تصفّح كل منتجات أوفيرا من بائعين موثوقين</p>
      </div>
      <CategoryView products={products} />
    </div>
  );
}

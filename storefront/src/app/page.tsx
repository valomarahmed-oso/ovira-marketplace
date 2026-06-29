import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Hero } from "@/components/hero";
import { CategoryRail } from "@/components/category-rail";
import { ProductGrid } from "@/components/product-grid";
import { SectionHeading } from "@/components/section-heading";
import { getCategories, getProducts } from "@/lib/api";
import { t } from "@/lib/dict";

const promos = [
  { title: "إلكترونيات بأسعار لا تُقاوم", note: "خصومات تصل إلى ٤٠٪", href: "/category/electronics", tone: "bg-blue text-white" },
  { title: "تجهيزات المنزل والمطبخ", note: "كل اللي بيتك محتاجه", href: "/category/home", tone: "bg-coral-50 text-coral" },
  { title: "أزياء الموسم الجديد", note: "وصل حديثًا", href: "/category/fashion", tone: "bg-blue-50 text-blue-600" },
];

export default async function HomePage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts({ limit: 8 })]);
  const bestSellers = [...products].reverse();

  return (
    <div className="container-ovira space-y-12 py-6">
      <Hero />

      <section className="animate-fade-up">
        <SectionHeading title={t.allCategories} href="/categories" />
        <CategoryRail categories={categories} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {promos.map((promo) => (
          <Link
            key={promo.title}
            href={promo.href}
            className={`group flex items-center justify-between gap-4 rounded-2xl p-6 transition-transform hover:-translate-y-0.5 ${promo.tone}`}
          >
            <div>
              <div className="text-lg font-medium">{promo.title}</div>
              <div className="text-sm opacity-90">{promo.note}</div>
            </div>
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
          </Link>
        ))}
      </section>

      <section>
        <SectionHeading title={t.newArrivals} href="/products" />
        <ProductGrid products={products} />
      </section>

      <section>
        <SectionHeading title={t.bestSellers} href="/products" />
        <ProductGrid products={bestSellers} />
      </section>
    </div>
  );
}

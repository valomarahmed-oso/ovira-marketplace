import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RotateCcw, ShieldCheck, Store, Truck } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPurchase } from "@/components/product-purchase";
import { ProductGrid } from "@/components/product-grid";
import { ProductReviews } from "@/components/product-reviews";
import { SectionHeading } from "@/components/section-heading";
import { Rating } from "@/components/rating";
import { getProduct, getProducts } from "@/lib/api";
import { t } from "@/lib/dict";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "منتج غير موجود | أوفيرا" };
  return { title: `${p.title} | أوفيرا`, description: p.short_description ?? p.title };
}

const assurances = [
  { icon: Truck, label: "شحن سريع لكل المحافظات" },
  { icon: ShieldCheck, label: "دفع آمن ومحمي" },
  { icon: RotateCcw, label: "إرجاع مجاني خلال ١٤ يوم" },
];

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  const related = (await getProducts({ limit: 8 })).filter((x) => x.slug !== p.slug).slice(0, 4);
  const images = p.media?.map((m) => m.image) ?? (p.image ? [p.image] : []);

  return (
    <div className="container-ovira space-y-10 py-6">
      <Breadcrumb
        items={[
          { label: t.brand, href: "/" },
          ...(p.category ? [{ label: p.category, href: "/" }] : []),
          { label: p.title },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={images} title={p.title} />

        <div className="space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-600">
            <Store className="h-3.5 w-3.5" /> {p.vendor_name}
          </span>

          <h1 className="text-2xl font-medium leading-snug text-ink md:text-3xl">{p.title}</h1>

          {typeof p.rating === "number" && <Rating value={p.rating} count={p.reviews} size={16} />}

          {p.short_description && <p className="leading-7 text-ink-600">{p.short_description}</p>}

          <ProductPurchase p={p} />

          <div className="grid gap-2 sm:grid-cols-3">
            {assurances.map((a) => (
              <div key={a.label} className="flex items-center gap-2 rounded-xl border border-line p-3 text-xs text-ink-600">
                <a.icon className="h-4 w-4 shrink-0 text-blue-600" />
                {a.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeading title="الوصف" />
          <div
            className="leading-8 text-ink-600"
            dangerouslySetInnerHTML={{ __html: p.description ?? "" }}
          />
        </section>

        {p.attributes && p.attributes.length > 0 && (
          <section>
            <SectionHeading title="المواصفات" />
            <table className="w-full text-sm">
              <tbody>
                {p.attributes.map((a) => (
                  <tr key={a.attribute} className="border-b border-line last:border-0">
                    <td className="py-2.5 pe-4 text-ink-400">{a.attribute}</td>
                    <td className="py-2.5 font-medium text-ink">{a.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <ProductReviews slug={p.slug} />

      {related.length > 0 && (
        <section>
          <SectionHeading title="منتجات مشابهة" />
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}

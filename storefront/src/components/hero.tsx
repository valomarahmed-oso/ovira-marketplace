import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck, Store, Timer, Truck } from "lucide-react";
import type { Banner, Product } from "@/lib/api";
import { OviraBars } from "@/components/ovira-bars";
import { cn, formatPrice, discountPercent } from "@/lib/utils";
import { t } from "@/lib/dict";

export function Hero({ hero, deal }: { hero: Banner | null; deal: Product | null }) {
  const title = hero?.title ?? "تسوّق أذكى، من بائعين تثق فيهم.";
  const subtitle =
    hero?.subtitle ?? "آلاف المنتجات، أسعار تنافسية، وشحن سريع لكل مصر — كل ده في مكان واحد.";
  const ctaLink = hero?.link || "/products";
  const ctaLabel = hero?.cta_label || t.shopNow;

  return (
    <section className={cn("grid gap-4", deal ? "lg:grid-cols-3" : "lg:grid-cols-1")}>
      <div
        className={cn(
          "clip-corner relative overflow-hidden rounded-3xl bg-blue p-8 text-white md:p-12",
          deal && "lg:col-span-2",
        )}
      >
        {hero?.image && (
          <>
            <Image src={hero.image} alt="" fill priority sizes="66vw" className="object-cover" />
            <div className="absolute inset-0 bg-blue/80" aria-hidden="true" />
          </>
        )}
        <div
          className="pointer-events-none absolute -bottom-24 -start-24 h-72 w-72 rounded-full border-[28px] border-white/10"
          aria-hidden="true"
        />
        <div className="relative max-w-xl">
          <div className="mb-5 flex items-center gap-2 text-sm text-white/85">
            <OviraBars tone="white" />
            <span>ماركت بليس متعدد البائعين</span>
          </div>
          <h1 className="text-3xl font-medium leading-snug md:text-5xl md:leading-[1.15]">{title}</h1>
          <p className="mt-4 text-base text-white/85 md:text-lg">{subtitle}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={ctaLink} className="btn bg-white px-6 py-3 text-blue-600 hover:bg-blue-50">
              {ctaLabel}
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link href="/sell" className="btn border border-white/40 px-6 py-3 text-white hover:bg-white/10">
              <Store className="h-4 w-4" />
              {t.becomeVendor}
            </Link>
          </div>

          <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-white/90">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {t.freeShipping}
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t.securePayment}
            </span>
            <span className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              {t.support}
            </span>
          </div>
        </div>
      </div>

      {deal && <DealCard deal={deal} />}
    </section>
  );
}

function DealCard({ deal }: { deal: Product }) {
  const off = discountPercent(deal.price, deal.compare_at_price);
  return (
    <Link
      href={`/product/${deal.slug}`}
      className="group card flex flex-col overflow-hidden transition-shadow hover:shadow-lift"
    >
      <div className="flex items-center justify-between bg-coral-50 px-5 py-3">
        <span className="flex items-center gap-2 font-medium text-coral">
          <Timer className="h-4 w-4" />
          عرض اليوم
        </span>
        {off > 0 && <span className="font-tech text-sm font-medium text-coral">-{off}%</span>}
      </div>
      <div className="relative aspect-[4/3] bg-blue-50">
        {deal.image && (
          <Image
            src={deal.image}
            alt={deal.title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>
      <div className="flex grow flex-col gap-2 p-5">
        <span className="text-xs text-ink-400">{deal.vendor_name}</span>
        <span className="line-clamp-2 text-sm leading-6 text-ink">{deal.title}</span>
        <div className="mt-auto flex items-end justify-between">
          <div>
            <div className="font-tech text-xl font-medium text-ink">{formatPrice(deal.price, deal.currency)}</div>
            {deal.compare_at_price && (
              <div className="font-tech text-xs text-ink-400 line-through">
                {formatPrice(deal.compare_at_price, deal.currency)}
              </div>
            )}
          </div>
          <OviraBars animated />
        </div>
      </div>
    </Link>
  );
}

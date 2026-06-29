import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck, Store, Timer, Truck } from "lucide-react";
import { OviraBars } from "@/components/ovira-bars";
import { MOCK_PRODUCTS } from "@/lib/api";
import { formatPrice, discountPercent } from "@/lib/utils";
import { t } from "@/lib/dict";

const deal = MOCK_PRODUCTS[3];

export function Hero() {
  const off = discountPercent(deal.price, deal.compare_at_price);

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="clip-corner relative overflow-hidden rounded-3xl bg-blue p-8 text-white md:p-12 lg:col-span-2">
        <div
          className="pointer-events-none absolute -bottom-24 -start-24 h-72 w-72 rounded-full border-[28px] border-white/10"
          aria-hidden="true"
        />
        <div className="relative max-w-xl">
          <div className="mb-5 flex items-center gap-2 text-sm text-white/85">
            <OviraBars tone="white" />
            <span>ماركت بليس متعدد البائعين</span>
          </div>
          <h1 className="text-3xl font-medium leading-snug md:text-5xl md:leading-[1.15]">
            تسوّق أذكى،
            <br />
            من بائعين تثق فيهم.
          </h1>
          <p className="mt-4 text-base text-white/85 md:text-lg">
            آلاف المنتجات، أسعار تنافسية، وشحن سريع لكل مصر — كل ده في مكان واحد.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/category/electronics" className="btn bg-white px-6 py-3 text-blue-600 hover:bg-blue-50">
              {t.shopNow}
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

      <Link
        href={`/product/${deal.slug}`}
        className="group card flex flex-col overflow-hidden transition-shadow hover:shadow-lift"
      >
        <div className="flex items-center justify-between bg-coral-50 px-5 py-3">
          <span className="flex items-center gap-2 font-medium text-coral">
            <Timer className="h-4 w-4" />
            عرض اليوم
          </span>
          <span className="font-tech text-sm font-medium text-coral">-{off}%</span>
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
    </section>
  );
}

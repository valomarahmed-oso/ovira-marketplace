import { BarChart3, Boxes, Banknote, Truck } from "lucide-react";
import { OviraBars } from "@/components/ovira-bars";
import { VendorApply } from "@/components/vendor-apply";
import { getAppConfig } from "@/lib/api";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function SellPage() {
  const [locale, config] = await Promise.all([getLocale(), getAppConfig()]);
  const t = getDict(locale);

  if (!config.multiVendor) {
    return (
      <div className="container-ovira py-20">
        <div className="card mx-auto max-w-md p-10 text-center text-ink-400">{t.sellUnavailable}</div>
      </div>
    );
  }

  const benefits = [
    { icon: Boxes, title: t.bAddProducts, note: t.bAddProductsNote },
    { icon: BarChart3, title: t.bTrackSales, note: t.bTrackSalesNote },
    { icon: Truck, title: t.bShipping, note: t.bShippingNote },
    { icon: Banknote, title: t.bPayouts, note: t.bPayoutsNote },
  ];

  return (
    <div className="container-ovira space-y-12 py-8">
      <section className="clip-corner relative overflow-hidden rounded-3xl bg-blue p-8 text-white md:p-14">
        <div
          className="pointer-events-none absolute -bottom-24 -start-24 h-72 w-72 rounded-full border-[28px] border-white/10"
          aria-hidden="true"
        />
        <div className="relative max-w-xl">
          <div className="mb-5 flex items-center gap-2 text-sm text-white/85">
            <OviraBars tone="white" /> {t.sellBadge}
          </div>
          <h1 className="text-3xl font-medium leading-snug md:text-5xl md:leading-[1.15]">
            {t.sellHeadline}
          </h1>
          <p className="mt-4 text-base text-white/85 md:text-lg">{t.sellSub}</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((b) => (
          <div key={b.title} className="card p-5">
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-blue-50">
              <b.icon className="h-5 w-5 text-blue-600" />
            </span>
            <div className="font-medium text-ink">{b.title}</div>
            <div className="mt-1 text-sm text-ink-400">{b.note}</div>
          </div>
        ))}
      </section>

      <section>
        <VendorApply />
      </section>
    </div>
  );
}

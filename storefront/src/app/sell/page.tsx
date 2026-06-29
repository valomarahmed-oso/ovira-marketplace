import Link from "next/link";
import { ArrowLeft, BarChart3, Boxes, Banknote, Truck } from "lucide-react";
import { OviraBars } from "@/components/ovira-bars";

const benefits = [
  { icon: Boxes, title: "أضف منتجاتك بسهولة", note: "ارفع منتجاتك وأدِرها من لوحة واحدة." },
  { icon: BarChart3, title: "تتبّع مبيعاتك", note: "إحصائيات حيّة لطلباتك وأرباحك." },
  { icon: Truck, title: "شحن مدمج", note: "شحن لكل المحافظات عبر شركاء أوفيرا." },
  { icon: Banknote, title: "تحصيل وتسويات", note: "مستحقاتك تتحوّل لك دوريًا وبشفافية." },
];

export default function SellPage() {
  return (
    <div className="container-ovira space-y-12 py-8">
      <section className="clip-corner relative overflow-hidden rounded-3xl bg-blue p-8 text-white md:p-14">
        <div
          className="pointer-events-none absolute -bottom-24 -start-24 h-72 w-72 rounded-full border-[28px] border-white/10"
          aria-hidden="true"
        />
        <div className="relative max-w-xl">
          <div className="mb-5 flex items-center gap-2 text-sm text-white/85">
            <OviraBars tone="white" /> برنامج البائعين
          </div>
          <h1 className="text-3xl font-medium leading-snug md:text-5xl md:leading-[1.15]">
            ابدأ البيع على أوفيرا
            <br />
            ووصّل منتجاتك لآلاف العملاء.
          </h1>
          <p className="mt-4 text-base text-white/85 md:text-lg">
            افتح متجرك في دقائق، أضف منتجاتك، وخلّي أوفيرا تتولّى الباقي — من الشحن للتحصيل.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/vendor" className="btn bg-white px-6 py-3 text-blue-600 hover:bg-blue-50">
              افتح لوحة البائع <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link href="/register" className="btn border border-white/40 px-6 py-3 text-white hover:bg-white/10">
              أنشئ حساب
            </Link>
          </div>
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

      <section className="card flex flex-col items-center gap-3 p-10 text-center">
        <h2 className="text-2xl font-medium text-ink">جاهز تبدأ؟</h2>
        <p className="max-w-md text-sm text-ink-400">
          انضم لمئات البائعين على أوفيرا وابدأ تكسب من النهارده.
        </p>
        <Link href="/vendor" className="btn btn-primary">
          افتح متجرك الآن <ArrowLeft className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}

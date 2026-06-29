import Link from "next/link";
import { CreditCard, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Logo } from "@/components/logo";
import { t } from "@/lib/dict";

const trust = [
  { icon: Truck, label: t.freeShipping, note: "للطلبات فوق ٥٠٠ ج.م" },
  { icon: ShieldCheck, label: t.securePayment, note: "بياناتك محمية" },
  { icon: RotateCcw, label: t.easyReturns, note: "خلال ١٤ يوم" },
  { icon: CreditCard, label: "دفع عند الاستلام", note: "متاح في كل المحافظات" },
];

const columns = [
  { title: "تسوّق", links: ["كل الأقسام", "العروض", "الأكثر مبيعًا", "وصل حديثًا"] },
  { title: "حسابي", links: ["تتبّع طلبي", "المفضلة", "الإرجاع", "المساعدة"] },
  { title: "البائعون", links: ["ابدأ البيع", "لوحة البائع", "سياسة البيع", "العمولات"] },
  { title: "أوفيرا", links: ["من نحن", "الوظائف", "الشروط والأحكام", "الخصوصية"] },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-ovira grid grid-cols-2 gap-4 py-8 md:grid-cols-4">
        {trust.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-line p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50">
              <item.icon className="h-5 w-5 text-blue-600" />
            </span>
            <div>
              <div className="text-sm font-medium text-ink">{item.label}</div>
              <div className="text-xs text-ink-400">{item.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="container-ovira grid grid-cols-2 gap-8 py-10 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-ink-400">{t.footerAbout}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-sm font-medium text-ink">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <Link href="#" className="text-sm text-ink-400 transition-colors hover:text-blue-600">
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-ovira flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-400 md:flex-row">
          <span>© {new Date().getFullYear()} {t.brand} — {t.rights}</span>
          <span className="font-tech">مبني على ERPNext · Next.js</span>
        </div>
      </div>
    </footer>
  );
}

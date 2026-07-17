import Link from "next/link";
import { CheckCircle2, Package, XCircle } from "lucide-react";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; status?: string; token?: string }>;
}) {
  const { order, status, token } = await searchParams;
  const t = getDict(await getLocale());
  const trackHref = order
    ? `/track?order=${encodeURIComponent(order)}${token ? `&token=${encodeURIComponent(token)}` : ""}`
    : "/track";

  if (status === "failed") {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-coral-50">
            <XCircle className="h-8 w-8 text-coral" />
          </div>
          <h1 className="text-xl font-medium text-ink">{t.coFailedTitle}</h1>
          <p className="text-sm text-ink-400">{t.coFailedHint.replace("{order}", order ?? "")}</p>
          <div className="flex justify-center gap-2 pt-2">
            <Link href="/cart" className="btn btn-primary">{t.coBackToCart}</Link>
            <Link href="/" className="btn btn-ghost">{t.coStore}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-ovira py-16">
      <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#e7f8f1]">
          <CheckCircle2 className="h-8 w-8 text-mint" />
        </div>
        <h1 className="text-xl font-medium text-ink">{t.coSuccessTitle}</h1>
        <div>
          <p className="text-sm text-ink-400">{t.coOrderNo}</p>
          <p className="font-tech text-lg font-medium text-ink">{order ?? "OVR-XXXXXX"}</p>
        </div>
        <p className="text-sm text-ink-600">{t.coSuccessHint}</p>
        <div className="flex justify-center gap-2 pt-2">
          <Link href={trackHref} className="btn btn-ghost">
            <Package className="h-4 w-4" /> {t.coTrackOrder}
          </Link>
          <Link href="/" className="btn btn-primary">
            {t.coKeepShopping}
          </Link>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Package, Store } from "lucide-react";
import { TrustBadge } from "@/components/trust-badge";
import { Rating } from "@/components/rating";
import type { StoreCard as StoreCardData } from "@/lib/api";
import { getDict, type Locale } from "@/lib/i18n";

const FRAPPE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const abs = (p?: string | null) =>
  !p ? undefined : /^https?:\/\//.test(p) ? p : `${FRAPPE}${p.startsWith("/") ? "" : "/"}${p}`;

export function StoreCard({ store, locale }: { store: StoreCardData; locale: Locale }) {
  const t = getDict(locale);
  const logo = abs(store.logo);

  return (
    <Link
      href={`/store/${store.slug}`}
      className="group card flex items-center gap-4 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card"
    >
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-blue-50">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={store.vendor_name} className="h-full w-full object-cover" />
        ) : (
          <Store className="h-7 w-7 text-blue-600" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink transition-colors group-hover:text-blue-600">
            {store.vendor_name}
          </span>
          {store.trust_tier && store.trust_tier !== "new" && (
            <TrustBadge tier={store.trust_tier} className="shrink-0" />
          )}
        </div>
        {typeof store.rating === "number" && store.rating > 0 && (
          <Rating value={store.rating} count={store.ratings_count ?? 0} size={13} />
        )}
        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          <Package className="h-3.5 w-3.5" />
          {t.storeProductsCount.replace("{n}", String(store.product_count))}
        </div>
      </div>
    </Link>
  );
}

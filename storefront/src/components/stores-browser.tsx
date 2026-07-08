"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, Store } from "lucide-react";
import { StoreCard } from "@/components/store-card";
import { getStores, type StoreCard as StoreCardType } from "@/lib/api";
import { getDict, type Locale } from "@/lib/i18n";

/** The stores directory with live, debounced search by store name. The initial
 *  list is server-rendered (good for SEO); typing re-queries the backend. */
export function StoresBrowser({
  initialStores,
  locale,
}: {
  initialStores: StoreCardType[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const [query, setQuery] = useState("");
  const [stores, setStores] = useState(initialStores);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // The SSR list already covers the empty query, so skip the mount fetch.
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        setStores(await getStores(q || undefined));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <div className="space-y-5">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.storesSearch}
          aria-label={t.storesSearch}
          className="h-11 w-full rounded-xl border border-line bg-white ps-9 pe-4 text-sm outline-none focus:border-blue"
        />
        {loading && (
          <Loader2 className="absolute inset-y-0 end-3 my-auto h-4 w-4 animate-spin text-blue-600" />
        )}
      </div>

      {stores.length ? (
        <>
          <p className="text-sm text-ink-400">
            {stores.length} {t.storesResults}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => (
              <StoreCard key={s.name} store={s} locale={locale} />
            ))}
          </div>
        </>
      ) : (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <Store className="h-8 w-8" />
          <p>{query.trim() ? t.storesNoMatch : t.storesEmpty}</p>
        </div>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { getSearchSuggestions, type SearchSuggestion } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { formatPrice } from "@/lib/utils";

const EMPTY: SearchSuggestion = { products: [], categories: [] };

/** Search input with a debounced autocomplete dropdown. Used for both the desktop
 * and mobile header search; `className` styles the outer wrapper. */
export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [sug, setSug] = useState<SearchSuggestion>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced suggestion fetch; a stale in-flight response is dropped via `active`.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSug(EMPTY);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const id = setTimeout(async () => {
      const res = await getSearchSuggestions(term);
      if (!active) return;
      setSug(res);
      setLoading(false);
    }, 250);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [q]);

  // Close the dropdown when clicking outside the box.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function goToResults() {
    setOpen(false);
    router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    goToResults();
  }

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const hasResults = sug.products.length > 0 || sug.categories.length > 0;
  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={submit} className="relative">
        <Search className="pointer-events-none absolute end-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className="h-11 w-full rounded-xl border border-line bg-canvas pe-12 ps-4 text-sm text-ink outline-none transition-colors focus:border-blue focus:bg-surface"
        />
      </form>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {loading && !hasResults ? (
            <div className="flex items-center gap-2 p-4 text-sm text-ink-400">
              <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
            </div>
          ) : !hasResults ? (
            <div className="p-4 text-sm text-ink-400">{t.noResults}</div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              {sug.categories.length > 0 && (
                <div className="border-b border-line px-3 py-2.5">
                  <div className="mb-1.5 text-xs text-ink-400">{t.searchInCategories}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {sug.categories.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => go(`/category/${c.slug}`)}
                        className="rounded-full border border-line px-3 py-1 text-xs text-ink-600 transition-colors hover:border-blue hover:text-blue-600"
                      >
                        {c.category_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sug.products.length > 0 && (
                <div className="p-1">
                  <div className="px-2 py-1.5 text-xs text-ink-400">{t.searchInProducts}</div>
                  {sug.products.map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => go(`/product/${p.slug}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors hover:bg-blue-50"
                    >
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-blue-50">
                        {p.image && (
                          <Image src={p.image} alt={p.title} fill sizes="40px" className="object-cover" />
                        )}
                      </span>
                      <span className="line-clamp-1 flex-1 text-sm text-ink">{p.title}</span>
                      <span className="whitespace-nowrap font-tech text-sm text-ink-600">
                        {formatPrice(p.price, p.currency)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={goToResults}
                className="block w-full border-t border-line px-4 py-2.5 text-center text-sm text-blue-600 transition-colors hover:bg-blue-50"
              >
                {t.searchViewAll.replace("{q}", q.trim())}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

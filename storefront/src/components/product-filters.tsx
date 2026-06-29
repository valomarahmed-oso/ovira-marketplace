"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import type { Facets } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const SORTS = [
  { value: "latest", label: "الأحدث" },
  { value: "price_asc", label: "السعر: من الأقل" },
  { value: "price_desc", label: "السعر: من الأعلى" },
];

export function ProductFilters({
  facets,
  total,
  children,
}: {
  facets: Facets;
  total: number;
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [brands, setBrands] = useState<string[]>(
    params.get("brand")?.split(",").filter(Boolean) ?? [],
  );
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  const [inStock, setInStock] = useState(params.get("stock") === "1");

  const sort = params.get("sort") ?? "latest";
  const hasFilters = brands.length > 0 || min !== "" || max !== "" || inStock;

  function push(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function apply(overrides?: { sort?: string }) {
    const next = new URLSearchParams();
    if (brands.length) next.set("brand", brands.join(","));
    if (min) next.set("min", min);
    if (max) next.set("max", max);
    if (inStock) next.set("stock", "1");
    const s = overrides?.sort ?? sort;
    if (s && s !== "latest") next.set("sort", s);
    push(next);
  }

  function clearAll() {
    setBrands([]);
    setMin("");
    setMax("");
    setInStock(false);
    const next = new URLSearchParams();
    if (sort && sort !== "latest") next.set("sort", sort);
    push(next);
  }

  function toggleBrand(b: string) {
    setBrands((s) => (s.includes(b) ? s.filter((x) => x !== b) : [...s, b]));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="card h-fit space-y-6 p-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium text-ink">
            <SlidersHorizontal className="h-4 w-4 text-blue-600" /> تصفية
          </span>
          {hasFilters && (
            <button type="button" onClick={clearAll} className="flex items-center gap-1 text-xs text-ink-400 hover:text-coral">
              <X className="h-3.5 w-3.5" /> مسح
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-ink">نطاق السعر</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder={String(facets.price_min || 0)}
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue"
              aria-label="أقل سعر"
            />
            <span className="text-ink-400">—</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder={String(facets.price_max || 0)}
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue"
              aria-label="أعلى سعر"
            />
          </div>
          <div className="font-tech text-xs text-ink-400">
            من {formatPrice(facets.price_min)} إلى {formatPrice(facets.price_max)}
          </div>
        </div>

        {facets.brands.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-ink">الماركة</div>
            <div className="max-h-56 space-y-2 overflow-y-auto pe-1">
              {facets.brands.map((b) => (
                <label key={b} className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
                  <input type="checkbox" checked={brands.includes(b)} onChange={() => toggleBrand(b)} className="accent-blue" />
                  {b}
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="accent-blue" />
          المتوفر فقط
        </label>

        <button type="button" onClick={() => apply()} disabled={pending} className="btn btn-primary w-full text-sm disabled:opacity-60">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} تطبيق
        </button>
      </aside>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-400">{total} منتج</span>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-400">ترتيب:</span>
            <select
              value={sort}
              onChange={(e) => apply({ sort: e.target.value })}
              className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-blue"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={pending ? "opacity-60 transition-opacity" : ""}>{children}</div>
      </div>
    </div>
  );
}

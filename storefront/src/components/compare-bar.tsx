"use client";

import Image from "next/image";
import Link from "next/link";
import { Scale, X } from "lucide-react";
import { useCompare } from "@/lib/compare-store";
import { useHydrated } from "@/lib/use-hydrated";

/** Floating tray showing the products queued for comparison. Hidden until at
 * least two are picked (one product isn't a comparison). */
export function CompareBar() {
  const items = useCompare((s) => s.items);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);
  const hydrated = useHydrated();

  if (!hydrated || items.length < 2) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur">
      <div className="container-ovira flex items-center gap-3 py-3">
        <div className="hidden items-center gap-1.5 text-sm font-medium text-ink sm:flex">
          <Scale className="h-4 w-4 text-blue-600" /> المقارنة
        </div>
        <div className="flex grow items-center gap-2 overflow-x-auto">
          {items.map((p) => (
            <div key={p.slug} className="relative shrink-0">
              <span className="relative block h-12 w-12 overflow-hidden rounded-lg border border-line bg-blue-50">
                {p.image && <Image src={p.image} alt={p.title} fill sizes="48px" className="object-cover" />}
              </span>
              <button
                type="button"
                onClick={() => remove(p.slug)}
                aria-label="إزالة"
                className="absolute -end-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-ink text-white"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={clear} className="shrink-0 text-xs text-ink-400 hover:text-coral">
          مسح
        </button>
        <Link href="/compare" className="btn btn-primary shrink-0 text-sm">
          قارن ({items.length})
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Coins } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useMoney } from "@/lib/currency";

/** Header control letting any visitor browse prices in their own currency.
 *  Renders nothing until the operator has enabled more than one currency. */
export function CurrencySwitcher({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const { options, active, setCode } = useMoney();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // One currency (or none) means there is nothing to switch between.
  if (options.length < 2 || !active) return null;

  const label = (c: (typeof options)[number]) => (locale === "ar" ? c.name_ar : c.name);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.curSwitcherLabel}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-ink-600 hover:bg-ink-50"
      >
        <Coins className="h-4 w-4" />
        <span className="font-tech">{active.code}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-lg end-0"
        >
          {options.map((c) => {
            const selected = c.code === active.code;
            return (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  // Choosing the base clears the override entirely.
                  setCode(c.is_base ? null : c.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-ink-50 ${
                  selected ? "text-blue-600" : "text-ink-600"
                }`}
              >
                <span className="font-tech w-10 shrink-0" dir="ltr">
                  {c.code}
                </span>
                <span className="flex-1 truncate">{label(c)}</span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
          <p className="border-t border-line px-3 py-2 text-xs text-ink-400">
            {t.curDisplayOnly}
          </p>
        </div>
      )}
    </div>
  );
}

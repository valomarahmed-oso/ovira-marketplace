"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { useVariantImage } from "@/lib/variant-image-store";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const { t } = useI18n();
  const variantImage = useVariantImage((s) => s.image);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);

  // The selected variant's photo rides at the front of the gallery when it
  // isn't already one of the product's images. Null on first render (server +
  // client) so there's no hydration mismatch — it only changes on a click.
  const list = useMemo(() => {
    const base = images.length ? images : [""];
    return variantImage && !base.includes(variantImage) ? [variantImage, ...base] : base;
  }, [images, variantImage]);

  // Jump to the variant's image whenever a variant with a photo is chosen.
  useEffect(() => {
    if (!variantImage) return;
    const idx = list.indexOf(variantImage);
    if (idx >= 0) setActive(idx);
  }, [variantImage, list]);

  const current = Math.min(active, list.length - 1);
  const hasImage = !!list[current];

  const step = useCallback(
    (dir: 1 | -1) => setActive((a) => (a + dir + list.length) % list.length),
    [list.length],
  );

  // Keyboard control while the lightbox is open.
  useEffect(() => {
    if (!zoom) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoom(false);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoom, step]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => hasImage && setZoom(true)}
        aria-label={t.galZoom}
        className="card group relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-blue-50"
      >
        {hasImage && (
          <Image
            src={list[current]}
            alt={title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover"
          />
        )}
        {hasImage && (
          <span className="absolute bottom-2 end-2 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink-600 opacity-0 shadow transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-4 w-4" />
          </span>
        )}
      </button>

      {list.length > 1 && (
        <div className="flex gap-3">
          {list.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${t.galZoom} ${i + 1}`}
              aria-pressed={i === current}
              className={cn(
                "relative h-16 w-16 overflow-hidden rounded-xl border bg-blue-50 transition-all",
                i === current ? "border-blue ring-2 ring-blue/30" : "border-line hover:border-blue",
              )}
            >
              {img && <Image src={img} alt="" fill sizes="64px" className="object-cover" />}
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen lightbox */}
      {zoom && hasImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label={t.galClose}
            className="absolute end-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); step(-1); }}
                aria-label={t.galPrev}
                className="absolute start-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); step(1); }}
                aria-label={t.galNext}
                className="absolute end-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div className="relative h-full max-h-[85vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image src={list[current]} alt={title} fill sizes="90vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

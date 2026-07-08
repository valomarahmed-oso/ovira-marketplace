"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useVariantImage } from "@/lib/variant-image-store";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const variantImage = useVariantImage((s) => s.image);
  const [active, setActive] = useState(0);

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

  return (
    <div className="space-y-3">
      <div className="card relative aspect-square overflow-hidden bg-blue-50">
        {list[current] && (
          <Image
            src={list[current]}
            alt={title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover"
          />
        )}
      </div>

      {list.length > 1 && (
        <div className="flex gap-3">
          {list.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`عرض الصورة ${i + 1}`}
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
    </div>
  );
}

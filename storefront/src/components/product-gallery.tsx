"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const list = images.length ? images : [""];
  const [active, setActive] = useState(0);

  return (
    <div className="space-y-3">
      <div className="card relative aspect-square overflow-hidden bg-blue-50">
        {list[active] && (
          <Image
            src={list[active]}
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
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`عرض الصورة ${i + 1}`}
              aria-pressed={i === active}
              className={cn(
                "relative h-16 w-16 overflow-hidden rounded-xl border bg-blue-50 transition-all",
                i === active ? "border-blue ring-2 ring-blue/30" : "border-line hover:border-blue",
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

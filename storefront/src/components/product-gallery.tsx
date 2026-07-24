"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X, ZoomIn } from "lucide-react";
import { useVariantImage } from "@/lib/variant-image-store";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

type Slide = { kind: "image" | "video"; src: string };

/** Turn a YouTube/Vimeo URL into an embeddable URL, or null for a direct file. */
function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export function ProductGallery({
  images,
  title,
  video,
}: {
  images: string[];
  title: string;
  video?: string | null;
}) {
  const { t } = useI18n();
  const variantImage = useVariantImage((s) => s.image);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);

  const slides: Slide[] = useMemo(() => {
    const imgs = images.length ? images : [""];
    const list: string[] = variantImage && !imgs.includes(variantImage) ? [variantImage, ...imgs] : imgs;
    const imageSlides: Slide[] = list.map((s) => ({ kind: "image", src: s }));
    return video ? [{ kind: "video", src: video }, ...imageSlides] : imageSlides;
  }, [images, variantImage, video]);

  useEffect(() => {
    if (!variantImage) return;
    const idx = slides.findIndex((s) => s.kind === "image" && s.src === variantImage);
    if (idx >= 0) setActive(idx);
  }, [variantImage, slides]);

  const current = Math.min(active, slides.length - 1);
  const slide = slides[current];
  const isVideo = slide?.kind === "video";
  const embed = isVideo ? embedUrl(slide.src) : null;

  const step = useCallback(
    (dir: 1 | -1) => setActive((a) => (a + dir + slides.length) % slides.length),
    [slides.length],
  );

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
      {isVideo ? (
        <div className="card relative aspect-square w-full overflow-hidden bg-black">
          {embed ? (
            <iframe
              src={embed}
              title={title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={slide.src} controls className="h-full w-full object-contain" />
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => slide?.src && setZoom(true)}
          aria-label={t.galZoom}
          className="card group relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-blue-50"
        >
          {slide?.src && (
            <Image src={slide.src} alt={title} fill priority sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" />
          )}
          {slide?.src && (
            <span className="absolute bottom-2 end-2 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink-600 opacity-0 shadow transition-opacity group-hover:opacity-100">
              <ZoomIn className="h-4 w-4" />
            </span>
          )}
        </button>
      )}

      {slides.length > 1 && (
        <div className="flex flex-wrap gap-3">
          {slides.map((s, i) => (
            <button
              key={`${s.src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={s.kind === "video" ? t.galPlayVideo : `${t.galZoom} ${i + 1}`}
              aria-pressed={i === current}
              className={cn(
                "relative grid h-16 w-16 place-items-center overflow-hidden rounded-xl border bg-blue-50 transition-all",
                i === current ? "border-blue ring-2 ring-blue/30" : "border-line hover:border-blue",
              )}
            >
              {s.kind === "video" ? (
                <Play className="h-6 w-6 fill-blue text-blue" />
              ) : (
                s.src && <Image src={s.src} alt="" fill sizes="64px" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {zoom && !isVideo && slide?.src && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(false)}>
          <button type="button" onClick={() => setZoom(false)} aria-label={t.galClose} className="absolute end-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
          {slides.filter((s) => s.kind === "image").length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label={t.galPrev} className="absolute start-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label={t.galNext} className="absolute end-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <div className="relative h-full max-h-[85vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image src={slide.src} alt={title} fill sizes="90vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

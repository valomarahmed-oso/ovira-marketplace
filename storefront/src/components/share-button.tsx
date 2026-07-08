"use client";

import { useState } from "react";
import { Check, Link2, MessageCircle, Share2 } from "lucide-react";

/** Share the current product: WhatsApp (big in Egypt), copy link, and the
 *  native share sheet when the browser supports it. URLs are read at click time
 *  from window.location, so there's no SSR/hydration mismatch. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const link = () => (typeof window !== "undefined" ? window.location.href : "");

  function shareWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${title}\n${link()}`)}`,
      "_blank",
      "noopener",
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  async function shareNative() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: link() });
      } catch {
        /* user cancelled */
      }
    } else {
      void copyLink();
    }
  }

  const btn =
    "grid h-9 w-9 place-items-center rounded-lg border border-line text-ink-600 transition-colors hover:border-blue hover:text-blue-600";

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-ink-400">مشاركة:</span>
      <button
        type="button"
        onClick={shareWhatsApp}
        aria-label="مشاركة على واتساب"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <MessageCircle className="h-4 w-4" /> واتساب
      </button>
      <button type="button" onClick={copyLink} aria-label="نسخ الرابط" className={btn}>
        {copied ? <Check className="h-4 w-4 text-mint" /> : <Link2 className="h-4 w-4" />}
      </button>
      <button type="button" onClick={shareNative} aria-label="مشاركة" className={btn}>
        <Share2 className="h-4 w-4" />
      </button>
    </div>
  );
}

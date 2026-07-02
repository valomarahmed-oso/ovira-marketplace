"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Star } from "lucide-react";
import { Rating } from "@/components/rating";
import { SectionHeading } from "@/components/section-heading";
import { useAuth } from "@/lib/auth-store";
import { addReview, getReviews, type Review } from "@/lib/reviews-api";
import { cn } from "@/lib/utils";

export function ProductReviews({ slug }: { slug: string }) {
  const user = useAuth((s) => s.user);
  const [list, setList] = useState<Review[]>([]);
  const [avg, setAvg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ author: "", rating: 5, body: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReviews(slug)
      .then((r) => {
        if (cancelled) return;
        setList(r.reviews);
        setAvg(r.avg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await addReview({
        product: slug,
        rating: form.rating,
        body: form.body.trim(),
        author: form.author.trim() || undefined,
      });
      // Replace any prior review by this shopper, then prepend the new one.
      const rest = list.filter((r) => r.id !== saved.id);
      const next = [saved, ...rest];
      setList(next);
      setAvg(Math.round((next.reduce((a, r) => a + r.rating, 0) / next.length) * 10) / 10);
      setForm({ author: "", rating: 5, body: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر إرسال التقييم.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionHeading title="التقييمات" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {loading ? (
            <div className="card flex items-center justify-center p-6 text-ink-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="card p-6 text-center text-sm text-ink-400">لسه مفيش تقييمات — كن أول من يقيّم.</div>
          ) : (
            list.map((r) => (
              <div key={r.id} className="card space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    {r.author}
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint/10 px-2 py-0.5 text-[11px] font-medium text-mint">
                        <ShieldCheck className="h-3 w-3" />
                        عملية شراء موثّقة
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-ink-400">{r.date}</span>
                </div>
                <Rating value={r.rating} />
                <p className="text-sm leading-6 text-ink-600">{r.body}</p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          {list.length > 0 && (
            <div className="card p-5 text-center">
              <div className="font-tech text-4xl font-medium text-ink">{avg.toFixed(1)}</div>
              <div className="mt-1 flex justify-center">
                <Rating value={avg} />
              </div>
              <div className="mt-1 text-xs text-ink-400">{list.length} تقييم</div>
            </div>
          )}

          {user ? (
            <form onSubmit={submit} className="card space-y-3 p-5">
              <h3 className="font-medium text-ink">أضف تقييمك</h3>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, rating: n })}
                    aria-label={`${n} نجوم`}
                  >
                    <Star className={cn("h-6 w-6", n <= form.rating ? "fill-gold text-gold" : "fill-line text-line")} />
                  </button>
                ))}
              </div>
              <input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder="اسمك (اختياري)"
                className="h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue"
              />
              <textarea
                required
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="شاركنا رأيك في المنتج"
                className="min-h-24 w-full rounded-xl border border-line bg-white p-4 text-sm outline-none focus:border-blue"
              />
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
                {busy ? "جارٍ الإرسال…" : "إرسال التقييم"}
              </button>
            </form>
          ) : (
            <div className="card space-y-3 p-5 text-center text-sm text-ink-400">
              <p>سجّل دخولك لتضيف تقييمك.</p>
              <Link href="/login" className="btn btn-primary w-full">
                تسجيل الدخول
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

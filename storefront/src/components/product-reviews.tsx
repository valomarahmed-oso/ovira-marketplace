"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Rating } from "@/components/rating";
import { SectionHeading } from "@/components/section-heading";
import { useReviews } from "@/lib/reviews-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

export function ProductReviews({ slug }: { slug: string }) {
  const reviews = useReviews((s) => s.reviews[slug] ?? []);
  const add = useReviews((s) => s.add);
  const hydrated = useHydrated();
  const [form, setForm] = useState({ author: "", rating: 5, body: "" });

  const list = hydrated ? reviews : [];
  const avg = list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.body.trim()) return;
    add(slug, { author: form.author.trim() || "مستخدم أوفيرا", rating: form.rating, body: form.body.trim() });
    setForm({ author: "", rating: 5, body: "" });
  }

  return (
    <section>
      <SectionHeading title="التقييمات" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {list.length === 0 ? (
            <div className="card p-6 text-center text-sm text-ink-400">لسه مفيش تقييمات — كن أول من يقيّم.</div>
          ) : (
            list.map((r) => (
              <div key={r.id} className="card space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{r.author}</span>
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
            <button type="submit" className="btn btn-primary w-full">إرسال التقييم</button>
          </form>
        </div>
      </div>
    </section>
  );
}

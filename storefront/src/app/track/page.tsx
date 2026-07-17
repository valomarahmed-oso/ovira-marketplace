"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Check, Loader2, MapPin, Package, Search, XCircle } from "lucide-react";
import { OviraBars } from "@/components/ovira-bars";
import { ORDER_STEPS } from "@/lib/orders-api";
import { trackOrder, type TrackedOrder } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { cn, formatPrice } from "@/lib/utils";

// How far along the tracker each status sits (mirrors the account view).
const STEP_INDEX: Record<string, number> = {
  "Pending Payment": -1,
  Paid: 0,
  Processing: 1,
  Shipped: 2,
  Completed: 3,
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(new Date(iso));
}

function TrackResult({ order }: { order: TrackedOrder }) {
  const { t } = useI18n();
  const stepIndex = STEP_INDEX[order.status] ?? -1;
  const delivered = !!order.delivery_confirmed || order.status === "Completed";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-tech text-2xl font-medium text-ink">{order.name}</h1>
          <p className="text-sm text-ink-400">{t.trkOrderDate} {formatDate(order.creation)}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            order.payment_status === "Paid"
              ? "bg-[#e7f8f1] text-mint"
              : order.payment_status === "Refunded"
                ? "bg-coral-50 text-coral"
                : "bg-blue-50 text-blue-600",
          )}
        >
          {order.payment_status === "Paid"
            ? t.trkPaid
            : order.payment_status === "Refunded"
              ? t.trkRefunded
              : t.trkPending}
        </span>
      </div>

      {order.status === "Cancelled" ? (
        <div className="card flex items-center gap-3 p-5 text-coral">
          <XCircle className="h-6 w-6 shrink-0" />
          <div>
            <div className="font-medium">{t.trkCancelledTitle}</div>
            <div className="text-sm text-ink-400">{t.trkCancelledHint}</div>
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            {ORDER_STEPS.map((step, i) => {
              const done = i <= stepIndex || (i === ORDER_STEPS.length - 1 && delivered);
              return (
                <div key={step.key} className="flex flex-1 flex-col items-center gap-2 text-center">
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full border",
                      done ? "border-blue bg-blue text-white" : "border-line bg-white text-ink-400",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={cn("text-xs", done ? "text-ink" : "text-ink-400")}>{step.label}</span>
                </div>
              );
            })}
          </div>
          {delivered && order.delivered_on && (
            <p className="mt-4 text-center text-sm text-mint">
              {t.trkDeliveredOn.replace("{date}", formatDate(order.delivered_on))}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {order.items.map((it, idx) => (
            <div key={`${it.title}-${idx}`} className="card flex gap-4 p-3">
              <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-blue-50">
                {it.image && <Image src={it.image} alt={it.title} fill sizes="80px" className="object-cover" />}
              </span>
              <div className="flex grow flex-col">
                <span className="line-clamp-2 text-sm text-ink">{it.title}</span>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm text-ink-400">{t.odtQty} {it.qty}</span>
                  <span className="font-tech font-medium text-ink">{formatPrice(it.amount, order.currency)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {order.governorate && (
            <div className="card space-y-2 p-5">
              <div className="flex items-center gap-2 font-medium text-ink">
                <MapPin className="h-4 w-4 text-blue-600" /> {t.trkDelivery}
              </div>
              <div className="text-sm leading-6 text-ink-600">
                <div className="text-ink">{order.customer_name}</div>
                <div>{order.governorate}</div>
              </div>
            </div>
          )}

          <div className="card space-y-2 p-5">
            <div className="flex items-center gap-2 font-medium text-ink">
              <OviraBars /> {t.odtPaySummary}
            </div>
            <div className="flex justify-between text-sm text-ink-600">
              <span>{t.odtSubtotal}</span>
              <span className="font-tech text-ink">{formatPrice(order.subtotal, order.currency)}</span>
            </div>
            <div className="flex justify-between text-sm text-ink-600">
              <span>{t.odtShipping}</span>
              <span className="font-tech text-ink">
                {order.shipping_amount === 0 ? (
                  <span className="text-mint">{t.odtFree}</span>
                ) : (
                  formatPrice(order.shipping_amount, order.currency)
                )}
              </span>
            </div>
            {!!order.discount_amount && order.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-mint">
                <span>{t.odtDiscount}{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                <span className="font-tech">−{formatPrice(order.discount_amount, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
              <span>{t.odtTotal}</span>
              <span className="font-tech">{formatPrice(order.total, order.currency)}</span>
            </div>
            <div className="pt-1 text-xs text-ink-400">
              {t.odtPayMethod} {order.payment_method === "cod" ? t.odtCod : order.payment_method || "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const urlOrder = params.get("order") ?? "";
  const urlToken = params.get("token") ?? "";

  const [orderNo, setOrderNo] = useState(urlOrder);
  const [proof, setProof] = useState(""); // phone or email
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(name: string, opts: { token?: string; phone?: string; email?: string }) {
    setLoading(true);
    setError(null);
    const found = await trackOrder(name.trim(), opts);
    setOrder(found);
    if (!found) setError(t.trkNotFound);
    setLoading(false);
  }

  // One-click from the confirmation link / email: ?order=…&token=…
  useEffect(() => {
    if (urlOrder && urlToken) void lookup(urlOrder, { token: urlToken });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlOrder, urlToken]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = proof.trim();
    void lookup(orderNo, value.includes("@") ? { email: value } : { phone: value });
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

  return (
    <div className="container-ovira space-y-8 py-8">
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-blue-50">
          <Package className="h-7 w-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-medium text-ink">{t.trkTitle}</h1>
        <p className="mt-1 text-sm text-ink-400">{t.trkSubtitle}</p>
      </div>

      <form onSubmit={onSubmit} className="mx-auto grid max-w-md gap-3">
        <input
          className={field}
          placeholder={t.trkOrderPlaceholder}
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          required
        />
        <input
          className={field}
          placeholder={t.trkProofPlaceholder}
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          required
        />
        <button type="submit" disabled={loading} className="btn btn-primary h-11 justify-center">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {t.trkTrackBtn}
        </button>
        {error && <p className="text-center text-sm text-coral">{error}</p>}
      </form>

      {loading && !order && (
        <div className="flex items-center justify-center gap-2 text-ink-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
        </div>
      )}

      {order && (
        <div className="mx-auto max-w-3xl">
          <TrackResult order={order} />
          <p className="mt-6 text-center text-sm text-ink-400">
            {t.trkHaveAccount}{" "}
            <Link href="/account/orders" className="text-blue-600 hover:underline">
              {t.trkSeeAllOrders}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="container-ovira flex items-center justify-center py-16 text-ink-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      }
    >
      <TrackInner />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Package, Printer } from "lucide-react";
import { getOrder, ORDER_STATUS_LABEL, type BuyerOrder, type BuyerOrderStatus } from "@/lib/orders-api";
import { useI18n } from "@/components/i18n-provider";
import { useBrand } from "@/components/site-content-provider";
import { formatPrice } from "@/lib/utils";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(new Date(iso));
}

export default function OrderInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<BuyerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const brand = useBrand();
  const PAYMENT_LABEL: Record<string, string> = {
    cod: t.odtCod,
    card: t.invPayCard,
    wallet: t.invPayWallet,
  };

  useEffect(() => {
    getOrder(id)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-8">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Package className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">{t.odtNotFound}</h1>
          <Link href="/account/orders" className="btn btn-primary inline-flex">{t.odtAllOrders}</Link>
        </div>
      </div>
    );
  }

  const payLabel = order.payment_method
    ? PAYMENT_LABEL[order.payment_method] ?? order.payment_method
    : "—";

  return (
    <div className="space-y-4">
      {/* Print isolation: hide everything else, show only #invoice on paper. */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #invoice,
          #invoice * {
            visibility: visible !important;
          }
          #invoice {
            position: absolute;
            top: 0;
            right: 0;
            left: 0;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/account/orders/${order.name}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-600 transition-colors hover:text-blue-600"
        >
          <ArrowRight className="h-4 w-4" /> {t.invBack}
        </Link>
        {order.return_status === "Completed" ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-coral-50 px-3 py-1.5 text-sm font-medium text-coral">
            {t.invVoidBadge}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-primary inline-flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4" /> {t.invPrint}
          </button>
        )}
      </div>

      <div id="invoice" className="card space-y-6 p-6 sm:p-8">
        {order.return_status === "Completed" && (
          <div className="rounded-xl border border-coral bg-coral-50 px-4 py-3 text-center text-sm font-bold text-coral">
            {t.invVoidBanner}
          </div>
        )}
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <div className="font-tech text-xl font-bold text-ink">{brand}</div>
            <div className="mt-1 text-xs text-ink-400">demo.ovira.cloud</div>
          </div>
          <div className="text-left">
            <div className="text-lg font-medium text-ink">{t.invTitle}</div>
            <div className="mt-1 font-tech text-sm text-ink-600">{order.name}</div>
            <div className="text-xs text-ink-400">{formatDate(order.creation)}</div>
          </div>
        </div>

        {/* Bill to + status */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-400">{t.invBillTo}</div>
            <div className="text-sm text-ink">{order.customer_name || "—"}</div>
            {order.phone && <div className="text-sm text-ink-600">{order.phone}</div>}
            {order.email && <div className="text-sm text-ink-600">{order.email}</div>}
            {order.shipping_address && (
              <div className="text-sm text-ink-600">
                {order.shipping_address}
                {order.governorate ? `، ${order.governorate}` : ""}
              </div>
            )}
          </div>
          <div className="space-y-1 sm:text-left">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-400">{t.invDetails}</div>
            <div className="text-sm text-ink-600">
              {t.invStatus}{" "}
              <span className="text-ink">
                {ORDER_STATUS_LABEL[order.status as BuyerOrderStatus] ?? order.status}
              </span>
            </div>
            <div className="text-sm text-ink-600">
              {t.invPayStatus} <span className="text-ink">{order.payment_status || "—"}</span>
            </div>
            <div className="text-sm text-ink-600">
              {t.odtPayMethod} <span className="text-ink">{payLabel}</span>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-right text-xs text-ink-400">
                <th className="py-2 font-medium">{t.invColProduct}</th>
                <th className="py-2 text-center font-medium">{t.invColQty}</th>
                <th className="py-2 text-left font-medium">{t.invColUnit}</th>
                <th className="py-2 text-left font-medium">{t.odtTotal}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, idx) => (
                <tr key={`${it.marketplace_product}-${idx}`} className="border-b border-line/60">
                  <td className="py-2.5 pl-2 text-ink">{it.title}</td>
                  <td className="py-2.5 text-center text-ink-600">{it.qty}</td>
                  <td className="py-2.5 text-left font-tech text-ink-600">
                    {formatPrice(it.rate, order.currency)}
                  </td>
                  <td className="py-2.5 text-left font-tech text-ink">
                    {formatPrice(it.amount, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="ml-auto max-w-xs space-y-1.5">
          <div className="flex justify-between text-sm text-ink-600">
            <span>{t.odtSubtotal}</span>
            <span className="font-tech text-ink">{formatPrice(order.subtotal, order.currency)}</span>
          </div>
          <div className="flex justify-between text-sm text-ink-600">
            <span>{t.odtShipping}</span>
            <span className="font-tech text-ink">
              {order.shipping_amount === 0 ? t.odtFree : formatPrice(order.shipping_amount, order.currency)}
            </span>
          </div>
          {!!order.discount_amount && order.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-ink-600">
              <span>{t.odtDiscount}{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
              <span className="font-tech">−{formatPrice(order.discount_amount, order.currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2 text-base font-medium text-ink">
            <span>{t.odtTotal}</span>
            <span className="font-tech">{formatPrice(order.total, order.currency)}</span>
          </div>
        </div>

        <div className="border-t border-line pt-4 text-center text-xs text-ink-400">
          {t.invThanks.replace("{brand}", brand)}
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, FileText, Loader2, MapPin, Package, RefreshCw, XCircle } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { OviraBars } from "@/components/ovira-bars";
import { ShipmentTracking } from "@/components/shipment-tracking";
import { OrderReturn } from "@/components/order-return";
import { OrderContact } from "@/components/order-contact";
import { cancelOrder, getOrder, ORDER_STEPS, reorderItems, type BuyerOrder } from "@/lib/orders-api";
import { getProduct } from "@/lib/api";
import { useCart } from "@/lib/cart-store";
import { cn, formatPrice } from "@/lib/utils";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(new Date(iso));
}

// How far along the tracker each status sits.
const STEP_INDEX: Record<string, number> = {
  "Pending Payment": -1,
  Paid: 0,
  Processing: 1,
  Shipped: 2,
  Completed: 3,
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<BuyerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const router = useRouter();
  const addToCart = useCart((s) => s.add);

  async function onReorder() {
    if (!order) return;
    setReordering(true);
    try {
      const items = await reorderItems(order.name);
      const fetched = await Promise.all(items.map((i) => getProduct(i.slug).then((p) => ({ p, qty: i.qty }))));
      let added = false;
      for (const { p, qty } of fetched) {
        if (p && !p.has_variants) {
          addToCart(p, qty);
          added = true;
        }
      }
      if (added) router.push("/cart");
    } finally {
      setReordering(false);
    }
  }

  useEffect(() => {
    getOrder(id)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [id]);

  const canCancel =
    !!order &&
    order.payment_status !== "Paid" &&
    ["Pending Payment", "Paid", "Processing"].includes(order.status);

  async function onCancel() {
    if (!order || !window.confirm("متأكد إنك عايز تلغي الطلب ده؟")) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelOrder(order.name);
      setOrder(await getOrder(id));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "تعذّر إلغاء الطلب.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> جارٍ التحميل…
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
          <h1 className="text-xl font-medium text-ink">الطلب غير موجود</h1>
          <Link href="/account/orders" className="btn btn-primary inline-flex">كل الطلبات</Link>
        </div>
      </div>
    );
  }

  const stepIndex = STEP_INDEX[order.status] ?? -1;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "حسابي", href: "/account" },
          { label: "طلباتي", href: "/account/orders" },
          { label: order.name },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="font-tech text-2xl font-medium text-ink">{order.name}</h1>
          {order.return_status === "Completed" && (
            <span className="rounded-full bg-coral-50 px-2.5 py-1 text-xs font-medium text-coral">
              مرتجع
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-400">{formatDate(order.creation)}</span>
          <Link
            href={`/account/orders/${order.name}/invoice`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm text-ink-600 transition-colors hover:border-blue hover:text-blue-600"
          >
            <FileText className="h-4 w-4" />
            الفاتورة
          </Link>
          <button
            type="button"
            onClick={onReorder}
            disabled={reordering}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm text-ink-600 transition-colors hover:border-blue hover:text-blue-600 disabled:opacity-50"
          >
            {reordering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            أعد الطلب
          </button>
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm text-coral transition-colors hover:border-coral hover:bg-coral-50 disabled:opacity-50"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              إلغاء الطلب
            </button>
          )}
        </div>
      </div>
      {cancelError && <p className="text-sm text-coral">{cancelError}</p>}

      {order.status !== "Cancelled" && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            {ORDER_STEPS.map((step, i) => {
              const done = i <= stepIndex;
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
        </div>
      )}

      <ShipmentTracking order={order.name} />

      <OrderContact order={order.name} />

      <OrderReturn order={order.name} status={order.status} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {order.items.map((it, idx) => (
            <div key={`${it.marketplace_product}-${idx}`} className="card flex gap-4 p-3">
              <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-blue-50">
                {it.image && <Image src={it.image} alt={it.title} fill sizes="80px" className="object-cover" />}
              </span>
              <div className="flex grow flex-col">
                <span className="line-clamp-2 text-sm text-ink">{it.title}</span>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm text-ink-400">الكمية: {it.qty}</span>
                  <span className="font-tech font-medium text-ink">{formatPrice(it.amount, order.currency)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="card space-y-2 p-5">
            <div className="flex items-center gap-2 font-medium text-ink">
              <MapPin className="h-4 w-4 text-blue-600" /> عنوان التوصيل
            </div>
            <div className="text-sm leading-6 text-ink-600">
              <div className="text-ink">{order.customer_name}</div>
              <div>{order.phone}</div>
              <div>
                {order.shipping_address}
                {order.governorate ? `، ${order.governorate}` : ""}
              </div>
            </div>
          </div>

          <div className="card space-y-2 p-5">
            <div className="flex items-center gap-2 font-medium text-ink">
              <OviraBars /> ملخّص الدفع
            </div>
            <div className="flex justify-between text-sm text-ink-600">
              <span>الإجمالي الفرعي</span>
              <span className="font-tech text-ink">{formatPrice(order.subtotal, order.currency)}</span>
            </div>
            <div className="flex justify-between text-sm text-ink-600">
              <span>الشحن</span>
              <span className="font-tech text-ink">
                {order.shipping_amount === 0 ? <span className="text-mint">مجاني</span> : formatPrice(order.shipping_amount, order.currency)}
              </span>
            </div>
            {!!order.discount_amount && order.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-mint">
                <span>الخصم{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                <span className="font-tech">−{formatPrice(order.discount_amount, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
              <span>الإجمالي</span>
              <span className="font-tech">{formatPrice(order.total, order.currency)}</span>
            </div>
            <div className="pt-1 text-xs text-ink-400">
              طريقة الدفع: {order.payment_method === "cod" ? "الدفع عند الاستلام" : order.payment_method || "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

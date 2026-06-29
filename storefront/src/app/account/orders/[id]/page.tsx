"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, MapPin, Package } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { OviraBars } from "@/components/ovira-bars";
import { ORDER_STEPS, useOrders } from "@/lib/orders-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn, formatPrice } from "@/lib/utils";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(new Date(iso));
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const order = useOrders((s) => s.orders.find((o) => o.id === id));
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="container-ovira py-10">
        <div className="card p-10 text-center text-ink-400">جارٍ التحميل…</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-ovira py-16">
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

  const stepIndex =
    order.status === "delivered" ? 2 : order.status === "shipped" ? 1 : 0;

  return (
    <div className="container-ovira space-y-6 py-6">
      <Breadcrumb
        items={[
          { label: "حسابي", href: "/account" },
          { label: "طلباتي", href: "/account/orders" },
          { label: order.id },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-tech text-2xl font-medium text-ink">{order.id}</h1>
        <span className="text-sm text-ink-400">{formatDate(order.date)}</span>
      </div>

      {order.status !== "cancelled" && (
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {order.items.map(({ product: p, qty }) => (
            <div key={p.slug} className="card flex gap-4 p-3">
              <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-blue-50">
                {p.image && <Image src={p.image} alt={p.title} fill sizes="80px" className="object-cover" />}
              </span>
              <div className="flex grow flex-col">
                <span className="line-clamp-2 text-sm text-ink">{p.title}</span>
                <span className="text-xs text-ink-400">{p.vendor_name}</span>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm text-ink-400">الكمية: {qty}</span>
                  <span className="font-tech font-medium text-ink">{formatPrice(p.price * qty, p.currency)}</span>
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
              <div className="text-ink">{order.address.name}</div>
              <div>{order.address.phone}</div>
              <div>
                {order.address.address}، {order.address.gov}
              </div>
            </div>
          </div>

          <div className="card space-y-2 p-5">
            <div className="flex items-center gap-2 font-medium text-ink">
              <OviraBars /> ملخّص الدفع
            </div>
            <div className="flex justify-between text-sm text-ink-600">
              <span>الإجمالي الفرعي</span>
              <span className="font-tech text-ink">{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-ink-600">
              <span>الشحن</span>
              <span className="font-tech text-ink">
                {order.shipping === 0 ? <span className="text-mint">مجاني</span> : formatPrice(order.shipping)}
              </span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
              <span>الإجمالي</span>
              <span className="font-tech">{formatPrice(order.total)}</span>
            </div>
            <div className="pt-1 text-xs text-ink-400">
              طريقة الدفع: {order.payment === "cod" ? "الدفع عند الاستلام" : "بطاقة ائتمان"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

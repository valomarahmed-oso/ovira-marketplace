"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CreditCard, MapPin, Plus, Truck } from "lucide-react";
import { getShippingRate, initiatePayment, placeOrder as apiPlaceOrder } from "@/lib/api";
import { getMyAddresses, upsertAddress, type BuyerAddress } from "@/lib/addresses-api";
import { cartSubtotal, useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth-store";
import { useHydrated } from "@/lib/use-hydrated";
import { OrderSummary } from "@/components/order-summary";
import { cn } from "@/lib/utils";

const GOVERNORATES = ["القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "القليوبية", "أخرى"];

const PAYMENTS = [
  { id: "cod", icon: Truck, label: "الدفع عند الاستلام", note: "ادفع نقدًا عند وصول الطلب" },
  { id: "card", icon: CreditCard, label: "بطاقة ائتمان", note: "يُفعّل قريبًا عبر بوابة الدفع" },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const user = useAuth((s) => s.user);
  const hydrated = useHydrated();

  const [form, setForm] = useState({ name: "", phone: "", gov: GOVERNORATES[0], address: "" });
  const [pay, setPay] = useState<"cod" | "card">("cod");
  const [submitting, setSubmitting] = useState(false);

  // Saved address book (signed-in shoppers). Selecting a card prefills the form,
  // which stays the single source of truth for the order.
  const [addresses, setAddresses] = useState<BuyerAddress[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [saveAddr, setSaveAddr] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyAddresses().then((list) => {
      if (cancelled || !list.length) return;
      setAddresses(list);
      const pick = list.find((a) => a.is_default) ?? list[0];
      setSelectedAddr(pick.name);
      setForm({ name: pick.full_name, phone: pick.phone ?? "", gov: pick.governorate, address: pick.address });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function chooseAddress(a: BuyerAddress) {
    setSelectedAddr(a.name);
    setManual(false);
    setForm({ name: a.full_name, phone: a.phone ?? "", gov: a.governorate, address: a.address });
  }

  function newAddress() {
    setSelectedAddr(null);
    setManual(true);
    setForm({ name: "", phone: "", gov: GOVERNORATES[0], address: "" });
  }

  // Cart subtotal drives the live shipping quote; both must be read before any
  // early return so the hook order stays stable.
  const subtotal = cartSubtotal(items);
  const [shipRate, setShipRate] = useState<number | null>(null);
  useEffect(() => {
    if (subtotal <= 0) return;
    let cancelled = false;
    getShippingRate(subtotal, form.gov).then((r) => {
      if (!cancelled) setShipRate(r);
    });
    return () => {
      cancelled = true;
    };
  }, [subtotal, form.gov]);

  if (hydrated && !items.length) {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md p-10 text-center text-ink-400">
          سلتك فاضية —{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            ابدأ التسوّق
          </Link>
        </div>
      </div>
    );
  }

  // Show the manual address fields for guests, for shoppers with no saved
  // address yet, or when explicitly adding a new one.
  const showManualFields = !user || addresses.length === 0 || manual;

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    // Persist a freshly-typed address to the buyer's book (best-effort) before
    // the order, so it's there for next time.
    if (user && showManualFields && saveAddr) {
      try {
        await upsertAddress({
          full_name: form.name,
          phone: form.phone,
          governorate: form.gov,
          address: form.address,
          is_default: addresses.length === 0 ? 1 : 0,
        });
      } catch {
        /* non-fatal: the order still goes through */
      }
    }

    // Create the order in ERPNext. The logged-in shopper's email is attached so
    // the order resolves to their account under "my orders". Guests still check
    // out; a local id keeps the success page flowing if the backend is offline.
    const remote = await apiPlaceOrder({
      items: items.map((i) => ({ slug: i.product.slug, qty: i.qty })),
      customer: {
        name: form.name,
        phone: form.phone,
        email: user?.email,
        gov: form.gov,
        address: form.address,
      },
      payment_method: pay,
    });
    const id = remote?.name ?? "OVR-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    // For a real card order, send the shopper to the payment gateway.
    if (remote?.name) {
      const returnUrl = `${window.location.origin}/checkout/success?order=${id}`;
      const payment = await initiatePayment(remote.name, remote.token, returnUrl);
      if (payment?.redirect_url && payment.method !== "cod" && payment.method !== "manual") {
        clear();
        window.location.href = payment.redirect_url;
        return;
      }
    }

    clear();
    router.push(`/checkout/success?order=${id}`);
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

  return (
    <div className="container-ovira space-y-6 py-6">
      <h1 className="text-2xl font-medium text-ink">إتمام الشراء</h1>
      <form onSubmit={placeOrder} className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="font-medium text-ink">عنوان التوصيل</h2>

            {user && addresses.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {addresses.map((a) => (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => chooseAddress(a)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-right transition-colors",
                      selectedAddr === a.name && !manual ? "border-blue bg-blue-50" : "border-line hover:border-blue",
                    )}
                  >
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{a.full_name}</span>
                      <span className="block truncate text-xs text-ink-400">
                        {a.governorate} — {a.address}
                      </span>
                      {a.phone && <span className="block text-xs text-ink-400">{a.phone}</span>}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={newAddress}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-sm transition-colors",
                    manual ? "border-blue bg-blue-50 text-blue-600" : "border-line text-ink-400 hover:border-blue",
                  )}
                >
                  <Plus className="h-4 w-4" />
                  عنوان جديد
                </button>
              </div>
            )}

            {showManualFields && (
              <div className="grid gap-3 sm:grid-cols-2">
                <input required placeholder="الاسم بالكامل" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
                <input required placeholder="رقم الموبايل" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
                <select value={form.gov} onChange={(e) => setForm({ ...form, gov: e.target.value })} className={field}>
                  {GOVERNORATES.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
                <input required placeholder="العنوان بالتفصيل" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`${field} sm:col-span-2`} />
                {user && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600 sm:col-span-2">
                    <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="accent-blue" />
                    احفظ هذا العنوان لطلباتي القادمة
                  </label>
                )}
              </div>
            )}
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-medium text-ink">طريقة الدفع</h2>
            {PAYMENTS.map((opt) => (
              <label
                key={opt.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                  pay === opt.id ? "border-blue bg-blue-50" : "border-line",
                )}
              >
                <input type="radio" name="pay" checked={pay === opt.id} onChange={() => setPay(opt.id)} className="accent-blue" />
                <opt.icon className="h-5 w-5 text-blue-600" />
                <span>
                  <span className="block text-sm font-medium text-ink">{opt.label}</span>
                  <span className="block text-xs text-ink-400">{opt.note}</span>
                </span>
              </label>
            ))}
          </section>
        </div>

        <div className="h-fit">
          <OrderSummary subtotal={subtotal} shipping={shipRate}>
            <button type="submit" disabled={submitting} className="btn btn-primary w-full disabled:opacity-50">
              تأكيد الطلب
            </button>
          </OrderSummary>
        </div>
      </form>
    </div>
  );
}

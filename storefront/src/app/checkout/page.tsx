"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Banknote, CreditCard, Info, Loader2, MapPin, Plus, Tag, Truck, Wallet, X } from "lucide-react";
import { getAppConfig, previewShipping, initiatePayment, placeOrder as apiPlaceOrder, validateCoupon } from "@/lib/api";
import { getMyAddresses, upsertAddress, type BuyerAddress } from "@/lib/addresses-api";
import { getShippingRates } from "@/lib/shipping-rates-api";
import { listPaymentMethods, type PaymentMethod } from "@/lib/payment-methods";
import { saveAbandonedCart } from "@/lib/abandoned-cart";
import { getWallet } from "@/lib/wallet-api";
import { cartSubtotal, useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { useHydrated } from "@/lib/use-hydrated";
import { OrderSummary } from "@/components/order-summary";
import { formatPrice, cn } from "@/lib/utils";

const GOVERNORATES = ["القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "القليوبية", "أخرى"];

type PayOption = {
  id: string;
  kind: "cod" | "manual" | "card";
  ref?: string;
  label: string;
  note: string;
  account?: string | null;
  icon: typeof Truck;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const user = useAuth((s) => s.user);
  const hydrated = useHydrated();

  const [form, setForm] = useState({ name: "", phone: "", gov: GOVERNORATES[0], address: "" });
  const [pay, setPay] = useState<string>("cod");
  const [submitting, setSubmitting] = useState(false);

  // Card payment only shows once an online gateway is actually enabled — no more
  // permanent "coming soon". Falls back to COD-only until then.
  const [onlinePayment, setOnlinePayment] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  useEffect(() => {
    getAppConfig().then((c) => setOnlinePayment(c.onlinePayment));
    listPaymentMethods().then(setMethods);
  }, []);

  // Build the checkout payment list: operator-defined manual methods (dynamic),
  // plus a built-in COD when none is configured, plus the online card gateway
  // when it's enabled. The `kind` decides how the backend collects payment.
  const payOptions: PayOption[] = (() => {
    const opts: PayOption[] = [];
    const hasDynamicCod = methods.some((m) => m.kind === "Cash on Delivery");
    if (!hasDynamicCod) {
      opts.push({ id: "cod", kind: "cod", label: t.odtCod, note: t.coCodNote, icon: Truck });
    }
    for (const m of methods) {
      const isCod = m.kind === "Cash on Delivery";
      opts.push({
        id: m.name,
        kind: isCod ? "cod" : "manual",
        ref: m.name,
        label: (locale === "en" && m.method_name_en) || m.method_name,
        note: (locale === "en" && m.instructions_en) || m.instructions || (isCod ? t.coCodNote : ""),
        account: m.account_details,
        icon: isCod ? Truck : Banknote,
      });
    }
    if (onlinePayment) {
      opts.push({ id: "card", kind: "card", label: t.invPayCard, note: t.coCardNote, icon: CreditCard });
    }
    return opts;
  })();

  // Keep the selected option valid as the async method list arrives.
  useEffect(() => {
    if (payOptions.length && !payOptions.some((o) => o.id === pay)) setPay(payOptions[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods, onlinePayment]);

  const selectedOption = payOptions.find((o) => o.id === pay);

  // Saved address book (signed-in shoppers). Selecting a card prefills the form,
  // which stays the single source of truth for the order.
  const [addresses, setAddresses] = useState<BuyerAddress[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [saveAddr, setSaveAddr] = useState(false);

  // Coupon: the discount is always re-priced server-side at checkout, so this
  // is only a preview to show the shopper before they confirm.
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Store credit: the buyer can spend their wallet balance on this order. The
  // amount actually spent is re-computed and capped server-side at checkout.
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  useEffect(() => {
    if (!user) {
      setWalletBalance(0);
      return;
    }
    let cancelled = false;
    getWallet().then((w) => {
      if (!cancelled && w) setWalletBalance(w.balance || 0);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
  // Cart signature — recompute the quote when contents, options or quantities change.
  const cartKey = items.map((i) => `${i.product.slug}:${i.variant?.sku ?? ""}:${i.qty}`).join("|");
  const [shipRate, setShipRate] = useState<number | null>(null);
  useEffect(() => {
    if (subtotal <= 0) return;
    let cancelled = false;
    const payload = items.map((i) => ({ slug: i.product.slug, qty: i.qty, variant: i.variant?.sku }));
    previewShipping(payload, form.gov).then((r) => {
      if (!cancelled) setShipRate(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, form.gov]);

  // Capture the cart for abandoned-cart recovery (signed-in shoppers we can
  // email). Debounced; the server only emails carts left untouched for a while.
  useEffect(() => {
    if (!user?.email || subtotal <= 0) return;
    const timer = setTimeout(() => {
      saveAbandonedCart({
        items: items.map((i) => ({ slug: i.product.slug, qty: i.qty, variant: i.variant?.sku })),
        email: user.email,
        customer_name: form.name || undefined,
        phone: form.phone || undefined,
        subtotal,
        currency: items[0]?.product.currency,
      });
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, user?.email, form.name, form.phone]);

  // Estimated delivery time per governorate (from the operator's rate table).
  const [etaByGov, setEtaByGov] = useState<Record<string, number>>({});
  useEffect(() => {
    getShippingRates().then((rates) => {
      const map: Record<string, number> = {};
      for (const r of rates) if (r.eta_days) map[r.governorate] = r.eta_days;
      setEtaByGov(map);
    });
  }, []);
  const govEta = etaByGov[form.gov];

  if (hydrated && !items.length) {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md p-10 text-center text-ink-400">
          {t.cartEmptyTitle} —{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            {t.coStartShopping}
          </Link>
        </div>
      </div>
    );
  }

  // Show the manual address fields for guests, for shoppers with no saved
  // address yet, or when explicitly adding a new one.
  const showManualFields = !user || addresses.length === 0 || manual;

  // Store-credit preview: cap the spend at what's payable after the coupon. The
  // server re-computes and caps this again, so this is display-only.
  // Shipping shown is ALWAYS the server quote (the same value the order charges);
  // never the local free-over-500 estimate, which would wrongly read "free" while
  // the operator's rate table actually charges a fee. 0 only while it loads.
  const shippingLoading = shipRate === null;
  const effShipping = shipRate ?? 0;
  const payableBeforeWallet = Math.max(0, subtotal + effShipping - (coupon?.discount ?? 0));
  const walletApplied = useWallet ? Math.min(walletBalance, payableBeforeWallet) : 0;

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || couponBusy) return;
    setCouponBusy(true);
    setCouponError(null);
    const res = await validateCoupon(
      code,
      subtotal,
      items.map((i) => ({ slug: i.product.slug, qty: i.qty, variant: i.variant?.sku })),
    );
    if ("discount" in res && res.discount > 0) {
      setCoupon({ code: code.toUpperCase(), discount: res.discount });
    } else {
      setCoupon(null);
      setCouponError("error" in res ? res.error : t.coCouponInvalid);
    }
    setCouponBusy(false);
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

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
      items: items.map((i) => ({ slug: i.product.slug, qty: i.qty, variant: i.variant?.sku })),
      customer: {
        name: form.name,
        phone: form.phone,
        email: user?.email,
        gov: form.gov,
        address: form.address,
      },
      payment_method: selectedOption?.kind ?? "cod",
      payment_method_ref: selectedOption?.ref,
      coupon: coupon?.code,
      use_wallet: useWallet && walletBalance > 0,
    });
    const id = remote?.name ?? "OVR-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    // The order's capability token lets even a guest track it afterwards via a
    // one-click link on the success page — they have no account to sign into.
    const tokenQs = remote?.token ? `&token=${encodeURIComponent(remote.token)}` : "";
    const successUrl = `/checkout/success?order=${id}${tokenQs}`;

    // For a real card order, send the shopper to the payment gateway.
    if (remote?.name) {
      const returnUrl = `${window.location.origin}${successUrl}`;
      const payment = await initiatePayment(remote.name, remote.token, returnUrl);
      if (payment?.redirect_url && payment.method !== "cod" && payment.method !== "manual") {
        clear();
        window.location.href = payment.redirect_url;
        return;
      }
    }

    clear();
    router.push(successUrl);
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

  return (
    <div className="container-ovira space-y-6 py-6">
      <h1 className="text-2xl font-medium text-ink">{t.cartCheckout}</h1>
      <form onSubmit={placeOrder} className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <h2 className="font-medium text-ink">{t.odtShipAddr}</h2>

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
                  {t.adrNew}
                </button>
              </div>
            )}

            {showManualFields && (
              <div className="grid gap-3 sm:grid-cols-2">
                <input required placeholder={t.coFullName} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
                <input required placeholder={t.adrPhone} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
                <div>
                  <select value={form.gov} onChange={(e) => setForm({ ...form, gov: e.target.value })} className={field}>
                    {GOVERNORATES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                  {govEta ? (
                    <p className="mt-1 text-xs text-mint">{t.shipEtaHint.replace("{days}", String(govEta))}</p>
                  ) : null}
                </div>
                <input required placeholder={t.adrDetail} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`${field} sm:col-span-2`} />
                {user && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600 sm:col-span-2">
                    <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="accent-blue" />
                    {t.coSaveAddr}
                  </label>
                )}
              </div>
            )}
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-medium text-ink">{t.coPayTitle}</h2>
            {payOptions.map((opt) => (
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
                  {opt.note && <span className="block text-xs text-ink-400">{opt.note}</span>}
                </span>
              </label>
            ))}
            {/* Manual-transfer instructions: the buyer pays to this account and
                the order stays pending until the operator confirms. */}
            {selectedOption?.kind === "manual" && selectedOption.account && (
              <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">{t.coManualPayTitle}</div>
                  <div className="mt-0.5 whitespace-pre-line font-tech text-ink" dir="ltr">
                    {selectedOption.account}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="h-fit space-y-4">
          <section className="card space-y-2 p-5">
            <h2 className="flex items-center gap-2 font-medium text-ink">
              <Tag className="h-4 w-4 text-blue-600" /> {t.coCouponTitle}
            </h2>
            {coupon ? (
              <div className="flex items-center justify-between rounded-xl bg-mint/10 px-3 py-2 text-sm">
                <span className="font-tech font-medium text-mint">{coupon.code}</span>
                <button type="button" onClick={removeCoupon} className="text-ink-400 hover:text-coral" aria-label={t.coRemoveCoupon}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void applyCoupon();
                    }
                  }}
                  placeholder={t.coCouponPlaceholder}
                  className="h-11 w-full rounded-xl border border-line bg-white px-4 text-sm uppercase outline-none focus:border-blue"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponBusy || !couponInput.trim()}
                  className="btn btn-ghost shrink-0 disabled:opacity-50"
                >
                  {couponBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.coApply}
                </button>
              </div>
            )}
            {couponError && <p className="text-xs text-coral">{couponError}</p>}
          </section>

          {user && walletBalance > 0 && (
            <section className="card p-5">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(e) => setUseWallet(e.target.checked)}
                  className="accent-blue"
                />
                <Wallet className="h-5 w-5 text-blue-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{t.walletUseAtCheckout}</span>
                  <span className="block text-xs text-ink-400">
                    {t.walletBalance}: {formatPrice(walletBalance)}
                  </span>
                </span>
              </label>
            </section>
          )}

          <OrderSummary
            subtotal={subtotal}
            shipping={effShipping}
            shippingLoading={shippingLoading}
            discount={coupon?.discount ?? 0}
            walletApplied={walletApplied}
            walletLabel={t.walletApplied}
          >
            <button type="submit" disabled={submitting} className="btn btn-primary w-full disabled:opacity-50">
              {t.coConfirmOrder}
            </button>
          </OrderSummary>
        </div>
      </form>
    </div>
  );
}

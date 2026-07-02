"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Banknote, ChevronDown, ClipboardList, Loader2, MapPin, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { AccountingAlerts } from "@/components/accounting-alerts";
import {
  getOrder,
  listOrders,
  markOrderPaid,
  orderStatusCounts,
  setOrderStatus,
  type AdminOrder,
  type AdminOrderDetail,
  type OrderStatus,
  type PaymentStatus,
  type VendorCounts,
} from "@/lib/operator";

const ORDER_STATUSES: OrderStatus[] = [
  "Pending Payment",
  "Paid",
  "Processing",
  "Shipped",
  "Completed",
  "Cancelled",
];
const TABS: (OrderStatus | "All")[] = ["All", ...ORDER_STATUSES];

const PAY_STYLE: Record<PaymentStatus, string> = {
  Unpaid: "text-coral",
  Paid: "text-mint",
  Refunded: "text-ink-400",
};

export default function AdminOrdersPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [counts, setCounts] = useState<VendorCounts>({});
  const [status, setStatus] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, AdminOrderDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, c] = await Promise.all([listOrders({ status, search }), orderStatusCounts()]);
    setOrders(o);
    setCounts(c);
    setLoading(false);
  }, [status, search]);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  async function toggleExpand(name: string) {
    if (expanded === name) {
      setExpanded(null);
      return;
    }
    setExpanded(name);
    if (!details[name]) {
      setDetailLoading(name);
      const detail = await getOrder(name);
      if (detail) setDetails((d) => ({ ...d, [name]: detail }));
      setDetailLoading(null);
    }
  }

  async function changeStatus(order: AdminOrder, to: OrderStatus) {
    if (to === order.status) return;
    setActingOn(order.name);
    setError(null);
    try {
      await setOrderStatus(order.name, to);
      setOrders((prev) =>
        prev.flatMap((x) => {
          if (x.name !== order.name) return [x];
          if (status !== "All" && to !== status) return []; // no longer in this filter
          return [{ ...x, status: to }];
        }),
      );
      setDetails((d) => (d[order.name] ? { ...d, [order.name]: { ...d[order.name], status: to } } : d));
      orderStatusCounts().then(setCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.vActionError);
    } finally {
      setActingOn(null);
    }
  }

  async function recordCollection(order: AdminOrder) {
    setActingOn(order.name);
    setError(null);
    try {
      const res = await markOrderPaid(order.name);
      setOrders((prev) =>
        prev.map((x) => (x.name === order.name ? { ...x, payment_status: res.payment_status } : x)),
      );
      setDetails((d) =>
        d[order.name] ? { ...d, [order.name]: { ...d[order.name], payment_status: res.payment_status } } : d,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t.vActionError);
    } finally {
      setActingOn(null);
    }
  }

  const tabLabel: Record<string, string> = {
    All: t.oStatusAll,
    "Pending Payment": t.oStatusPendingPayment,
    Paid: t.oStatusPaid,
    Processing: t.oStatusProcessing,
    Shipped: t.oStatusShipped,
    Completed: t.oStatusCompleted,
    Cancelled: t.oStatusCancelled,
  };
  const statusLabel = (s: OrderStatus) => tabLabel[s] ?? s;
  const payLabel: Record<PaymentStatus, string> = {
    Unpaid: t.payUnpaid,
    Paid: t.payPaid,
    Refunded: t.payRefunded,
  };

  const money = (v?: number, ccy?: string) =>
    typeof v === "number" ? `${v.toLocaleString()} ${ccy ?? ""}`.trim() : "—";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.ordAdminTitle}</h2>
        <p className="text-sm text-ink-400">{t.ordAdminSubtitle}</p>
      </div>

      <AccountingAlerts />

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = status === tab;
          const count = counts[tab];
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setStatus(tab)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors ${
                active ? "bg-blue text-white" : "border border-line text-ink-600 hover:bg-blue-50"
              }`}
            >
              {tabLabel[tab]}
              {typeof count === "number" && (
                <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20" : "bg-canvas text-ink-400"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          style={{ insetInlineStart: "0.75rem" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.ordSearch}
          className="h-11 w-full rounded-xl border border-line bg-white ps-10 pe-4 text-sm outline-none focus:border-blue"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <ClipboardList className="h-8 w-8" />
          <p>{t.ordEmpty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const open = expanded === o.name;
            const detail = details[o.name];
            return (
              <div key={o.name} className="card overflow-hidden">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => toggleExpand(o.name)}
                    className="flex min-w-0 items-center gap-3 text-start"
                  >
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-tech text-sm text-ink-400">{o.name}</span>
                        <span className="truncate font-medium text-ink">{o.customer_name || "—"}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-400">
                        <span className="text-ink">{money(o.total, o.currency)}</span>
                        {typeof o.item_count === "number" && (
                          <span>
                            {o.item_count} {t.ordItemsCount}
                          </span>
                        )}
                        {o.payment_status && (
                          <span className={PAY_STYLE[o.payment_status]}>{payLabel[o.payment_status]}</span>
                        )}
                        {o.creation && <span>{o.creation.slice(0, 10)}</span>}
                      </div>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {actingOn === o.name && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                    {o.payment_status === "Unpaid" && o.status !== "Cancelled" && (
                      <button
                        type="button"
                        disabled={actingOn === o.name}
                        onClick={() => recordCollection(o)}
                        title={t.ordMarkPaid}
                        className="btn btn-ghost h-9 px-3 text-sm disabled:opacity-50"
                      >
                        <Banknote className="h-4 w-4" />
                        <span className="hidden sm:inline">{t.ordMarkPaid}</span>
                      </button>
                    )}
                    <select
                      value={o.status}
                      disabled={actingOn === o.name}
                      onChange={(e) => changeStatus(o, e.target.value as OrderStatus)}
                      className="h-9 rounded-lg border border-line bg-white px-2 text-sm outline-none focus:border-blue disabled:opacity-50"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-line bg-canvas/50 p-4">
                    {detailLoading === o.name && !detail ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      </div>
                    ) : detail ? (
                      <div className="space-y-4">
                        <div>
                          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-400">
                            {t.ordItems}
                          </div>
                          <div className="divide-y divide-line rounded-xl border border-line bg-surface">
                            {detail.items.map((it, i) => (
                              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                <div className="min-w-0">
                                  <div className="truncate text-ink">{it.title}</div>
                                  {it.vendor_name && (
                                    <div className="text-xs text-ink-400">
                                      {t.byVendor}: {it.vendor_name}
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 text-ink-400">
                                  {it.qty} × {money(it.rate, o.currency)} ={" "}
                                  <span className="text-ink">{money(it.amount, o.currency)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {(detail.shipping_address || detail.governorate || detail.phone) && (
                          <div className="flex items-start gap-2 text-sm text-ink-600">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                            <div>
                              <span className="text-ink-400">{t.ordShipTo}: </span>
                              {[detail.governorate, detail.shipping_address].filter(Boolean).join(" — ")}
                              {detail.phone && <span dir="ltr"> · {detail.phone}</span>}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
                          <span className="text-ink-400">
                            {t.ordSubtotal}: <span className="text-ink">{money(detail.subtotal, o.currency)}</span>
                          </span>
                          <span className="text-ink-400">
                            {t.ordShipping}: <span className="text-ink">{money(detail.shipping_amount, o.currency)}</span>
                          </span>
                          <span className="text-ink-400">
                            {t.ordTotal}: <span className="font-medium text-ink">{money(detail.total, o.currency)}</span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="py-4 text-center text-sm text-ink-400">—</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

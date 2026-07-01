"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Search, Store } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import {
  listVendors,
  setVendorStatus,
  vendorStatusCounts,
  type Vendor,
  type VendorCounts,
  type VendorStatus,
} from "@/lib/operator";

const TABS = ["All", "Pending", "Active", "Suspended"] as const;

const STATUS_STYLE: Record<VendorStatus, { text: string; dot: string }> = {
  Pending: { text: "text-gold", dot: "bg-gold" },
  Active: { text: "text-mint", dot: "bg-mint" },
  Suspended: { text: "text-coral", dot: "bg-coral" },
  Draft: { text: "text-ink-400", dot: "bg-line" },
};

export default function AdminVendorsPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [counts, setCounts] = useState<VendorCounts>({});
  const [status, setStatus] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    const [v, c] = await Promise.all([listVendors({ status, search }), vendorStatusCounts()]);
    setVendors(v);
    setCounts(c);
    setLoading(false);
  }, [status, search]);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  async function act(vendor: Vendor, to: VendorStatus) {
    setActingOn(vendor.name);
    setError(null);
    try {
      await setVendorStatus(vendor.name, to);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.vActionError);
    } finally {
      setActingOn(null);
    }
  }

  const tabLabel: Record<(typeof TABS)[number], string> = {
    All: t.vStatusAll,
    Pending: t.vStatusPending,
    Active: t.vStatusActive,
    Suspended: t.vStatusSuspended,
  };

  const statusLabel: Record<VendorStatus, string> = {
    Pending: t.vStatusPending,
    Active: t.vStatusActive,
    Suspended: t.vStatusSuspended,
    Draft: t.vStatusDraft,
  };

  function actionsFor(v: Vendor): { label: string; to: VendorStatus; variant: "primary" | "ghost" }[] {
    switch (v.status) {
      case "Pending":
        return [
          { label: t.vApprove, to: "Active", variant: "primary" },
          { label: t.vReject, to: "Suspended", variant: "ghost" },
        ];
      case "Active":
        return [{ label: t.vSuspend, to: "Suspended", variant: "ghost" }];
      case "Suspended":
        return [{ label: t.vReactivate, to: "Active", variant: "primary" }];
      default:
        return [{ label: t.vApprove, to: "Active", variant: "primary" }];
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.vendorsTitle}</h2>
        <p className="text-sm text-ink-400">{t.vendorsSubtitle}</p>
      </div>

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
          placeholder={t.vendorSearch}
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
      ) : vendors.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <Store className="h-8 w-8" />
          <p>{t.vEmpty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendors.map((v) => {
            const style = STATUS_STYLE[v.status];
            const acting = actingOn === v.name;
            return (
              <div
                key={v.name}
                className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{v.vendor_name}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium ${style.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {statusLabel[v.status]}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink-400">
                    {v.email && <span className="truncate">{v.email}</span>}
                    {v.phone && <span dir="ltr">{v.phone}</span>}
                    {v.creation && (
                      <span>
                        {t.vApplied}: {v.creation.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {actionsFor(v).map((a) => (
                    <button
                      key={a.to + a.label}
                      type="button"
                      disabled={acting}
                      onClick={() => act(v, a.to)}
                      className={`btn ${a.variant === "primary" ? "btn-primary" : "btn-ghost"} disabled:opacity-50`}
                    >
                      {acting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

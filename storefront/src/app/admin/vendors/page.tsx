"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckSquare, Loader2, Search, Square, Store } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { TrustBadge } from "@/components/trust-badge";
import {
  bulkSetVendorStatus,
  listVendors,
  setVendorCommission,
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set()); // a fresh query invalidates the old selection
    const [v, c] = await Promise.all([listVendors({ status, search }), vendorStatusCounts()]);
    setVendors(v);
    setCounts(c);
    setLoading(false);
  }, [status, search]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const allSelected = vendors.length > 0 && selected.size === vendors.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(vendors.map((v) => v.name)));
  }

  async function bulkAct(to: VendorStatus) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await bulkSetVendorStatus([...selected], to);
      if (res.failed.length) setError(t.pBulkFailed);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.vActionError);
    } finally {
      setBulkBusy(false);
    }
  }

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

  const [commission, setCommission] = useState<Record<string, string>>({});

  async function saveCommission(vendor: Vendor) {
    const raw = commission[vendor.name];
    if (raw === undefined) return; // untouched
    setActingOn(vendor.name);
    setError(null);
    try {
      const res = await setVendorCommission(vendor.name, raw === "" ? null : Number(raw));
      setVendors((prev) =>
        prev.map((v) => (v.name === vendor.name ? { ...v, commission_rate: res.commission_rate } : v)),
      );
      setCommission((c) => {
        const next = { ...c };
        delete next[vendor.name];
        return next;
      });
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

      {/* Bulk actions */}
      {!loading && vendors.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-2 text-sm text-ink-600 transition-colors hover:text-blue-600"
          >
            {allSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
            {t.pSelectAll}
          </button>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-ink-400">
                {selected.size} {t.pSelected}
              </span>
              <button
                type="button"
                onClick={() => bulkAct("Active")}
                disabled={bulkBusy}
                className="btn btn-primary disabled:opacity-50"
              >
                {bulkBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.vBulkActivate}
              </button>
              <button
                type="button"
                onClick={() => bulkAct("Suspended")}
                disabled={bulkBusy}
                className="btn btn-ghost disabled:opacity-50"
              >
                {t.vBulkSuspend}
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-sm text-ink-400 transition-colors hover:text-ink"
              >
                {t.pClearSelection}
              </button>
            </>
          )}
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
                <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggle(v.name)}
                  aria-label={t.pSelectAll}
                  aria-pressed={selected.has(v.name)}
                  className="shrink-0 text-ink-400 transition-colors hover:text-blue-600"
                >
                  {selected.has(v.name) ? (
                    <CheckSquare className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{v.vendor_name}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium ${style.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {statusLabel[v.status]}
                    </span>
                    {v.trust_tier && v.trust_tier !== "new" && (
                      <TrustBadge tier={v.trust_tier} score={v.trust_score} showScore />
                    )}
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
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink-400">{t.vCommission}:</span>
                    <input
                      type="number"
                      dir="ltr"
                      min={0}
                      max={100}
                      step="0.5"
                      value={commission[v.name] ?? (v.commission_rate ? String(v.commission_rate) : "")}
                      placeholder={t.vCommissionDefault}
                      onChange={(e) => setCommission((c) => ({ ...c, [v.name]: e.target.value }))}
                      className="h-8 w-20 rounded-lg border border-line bg-white px-2 text-sm outline-none focus:border-blue"
                    />
                    <span className="text-xs text-ink-400">{t.vCommissionHint}</span>
                    {commission[v.name] !== undefined && (
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => saveCommission(v)}
                        className="btn btn-primary h-8 px-3 text-xs disabled:opacity-50"
                      >
                        {t.paySave}
                      </button>
                    )}
                  </div>
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

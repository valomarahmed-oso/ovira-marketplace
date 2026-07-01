"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Package, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import {
  fileUrl,
  listProducts,
  productStatusCounts,
  setProductStatus,
  type AdminProduct,
  type ProductApprovalStatus,
  type VendorCounts,
} from "@/lib/operator";

const TABS = ["All", "Pending", "Approved", "Rejected"] as const;

const STATUS_STYLE: Record<ProductApprovalStatus, { text: string; dot: string }> = {
  Pending: { text: "text-gold", dot: "bg-gold" },
  Approved: { text: "text-mint", dot: "bg-mint" },
  Rejected: { text: "text-coral", dot: "bg-coral" },
  Draft: { text: "text-ink-400", dot: "bg-line" },
};

export default function AdminProductsPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [counts, setCounts] = useState<VendorCounts>({});
  const [status, setStatus] = useState<string>("Pending");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([listProducts({ status, search }), productStatusCounts()]);
    setProducts(p);
    setCounts(c);
    setLoading(false);
  }, [status, search]);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  async function act(product: AdminProduct, to: ProductApprovalStatus) {
    let reason: string | undefined;
    if (to === "Rejected") {
      const entered = window.prompt(t.rejectReasonPrompt, "");
      if (entered === null) return; // cancelled
      reason = entered || undefined;
    }
    setActingOn(product.name);
    setError(null);
    try {
      await setProductStatus(product.name, to, reason);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.vActionError);
    } finally {
      setActingOn(null);
    }
  }

  const tabLabel: Record<(typeof TABS)[number], string> = {
    All: t.pStatusAll,
    Pending: t.pStatusPending,
    Approved: t.pStatusApproved,
    Rejected: t.pStatusRejected,
  };

  const statusLabel: Record<ProductApprovalStatus, string> = {
    Pending: t.pStatusPending,
    Approved: t.pStatusApproved,
    Rejected: t.pStatusRejected,
    Draft: t.pStatusDraft,
  };

  function actionsFor(p: AdminProduct): { label: string; to: ProductApprovalStatus; variant: "primary" | "ghost" }[] {
    switch (p.approval_status) {
      case "Pending":
        return [
          { label: t.pApprove, to: "Approved", variant: "primary" },
          { label: t.pReject, to: "Rejected", variant: "ghost" },
        ];
      case "Approved":
        return [{ label: t.pReject, to: "Rejected", variant: "ghost" }];
      default:
        return [{ label: t.pApprove, to: "Approved", variant: "primary" }];
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.productsTitle}</h2>
        <p className="text-sm text-ink-400">{t.productsSubtitle}</p>
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
          placeholder={t.productSearch}
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
      ) : products.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
          <Package className="h-8 w-8" />
          <p>{t.pEmpty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const style = STATUS_STYLE[p.approval_status];
            const acting = actingOn === p.name;
            const img = fileUrl(p.image);
            return (
              <div
                key={p.name}
                className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={p.title} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-canvas text-ink-400">
                      <Package className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-ink">{p.title}</span>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium ${style.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {statusLabel[p.approval_status]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink-400">
                      {p.vendor_name && (
                        <span className="truncate">
                          {t.byVendor}: {p.vendor_name}
                        </span>
                      )}
                      {typeof p.price === "number" && (
                        <span className="text-ink">
                          {p.price.toLocaleString()} {p.currency ?? ""}
                        </span>
                      )}
                      {p.stock_qty === 0 && <span className="text-coral">{t.outOfStock}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {actionsFor(p).map((a) => (
                    <button
                      key={a.to + a.label}
                      type="button"
                      disabled={acting}
                      onClick={() => act(p, a.to)}
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

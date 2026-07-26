"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { StatusChip, SupportThread, useCategoryLabels } from "@/components/support-thread";
import { allTickets, type Ticket, type TicketStatus } from "@/lib/support-api";

const FILTERS: { key: string; labelKey: "supFilterOpen" | "supFilterAll" | "supFilterResolved" }[] = [
  { key: "open", labelKey: "supFilterOpen" },
  { key: "Resolved", labelKey: "supFilterResolved" },
  { key: "", labelKey: "supFilterAll" },
];

/** Operator support queue. Open tickets first — the ones a customer is waiting on. */
export default function AdminSupportPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [rows, setRows] = useState<Ticket[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [filter, setFilter] = useState<string>("open");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await allTickets((filter || undefined) as "open" | TicketStatus | undefined);
    setRows(data.tickets);
    setOpenCount(data.open_count);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  const categoryLabel = useCategoryLabels();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-medium text-ink">
            <LifeBuoy className="h-5 w-5 text-blue-600" />
            {t.supAdminTitle}
          </h2>
          <p className="text-sm text-ink-400">
            {t.supOpenCount.replace("{0}", String(openCount))}
          </p>
        </div>
        <button type="button" onClick={load} className="btn btn-ghost h-9 text-sm">
          <RefreshCw className="h-4 w-4" />
          {t.mhRefresh}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key || "all"}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              filter === f.key ? "bg-blue text-white" : "border border-line text-ink-600"
            }`}
          >
            {t[f.labelKey]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-400">{t.supAdminEmpty}</div>
      ) : (
        <div className="space-y-3">
          {rows.map((tk) => (
            <div key={tk.name} className="card p-4">
              <button
                type="button"
                onClick={() => setExpanded(expanded === tk.name ? null : tk.name)}
                className="flex w-full flex-wrap items-center justify-between gap-3 text-start"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{tk.subject}</span>
                    {tk.unread > 0 && (
                      <span className="rounded-full bg-coral px-1.5 py-0.5 text-[11px] font-medium text-white">
                        {tk.unread}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink-400">
                    <span className="font-tech" dir="ltr">
                      {tk.name}
                    </span>
                    <span dir="ltr">{tk.customer_email}</span>
                    <span>{categoryLabel[tk.category] ?? tk.category}</span>
                    {tk.order && (
                      <span className="font-tech" dir="ltr">
                        {tk.order}
                      </span>
                    )}
                    <span>{tk.last_activity.slice(0, 16)}</span>
                  </div>
                </div>
                <StatusChip status={tk.status} />
              </button>

              {expanded === tk.name && (
                <div className="mt-4 border-t border-line pt-4">
                  <SupportThread name={tk.name} onStatusChange={() => void load()} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

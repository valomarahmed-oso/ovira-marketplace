"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  Stethoscope,
  Wrench,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { storeHealth, type Finding, type Severity, type StoreHealth } from "@/lib/health-api";
import { unpublishHiddenVendorProducts } from "@/lib/operator";

/** The screen that answers "why is my store behaving oddly?".
 *
 *  Every check behind it exists because that exact condition was live here and
 *  nothing said so: a loyalty rate returning 10,000% of every sale, returns
 *  completed refunding nothing, stock that disagreed with the ledger, products
 *  no shopper could open. None of them threw. They just quietly did the wrong
 *  thing until somebody noticed a number they couldn't explain. */
export default function AdminHealthPage() {
  const { t } = useI18n();
  const [data, setData] = useState<StoreHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await storeHealth());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-medium text-ink">
            <Stethoscope className="h-6 w-6 text-blue-600" />
            {t.hlthTitle}
          </h1>
          <p className="mt-1 text-sm text-ink-400">{t.hlthSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="btn btn-ghost disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t.hlthRecheck}
        </button>
      </div>

      {loading && !data ? (
        <div className="card flex justify-center p-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : data?.healthy ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <CheckCircle2 className="h-9 w-9 text-mint" />
          <p className="font-medium text-ink">{t.hlthAllGood}</p>
          <p className="text-sm text-ink-400">{t.hlthAllGoodSub}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <Tally
              tone="critical"
              n={data?.critical ?? 0}
              label={t.hlthCriticalCount}
            />
            <Tally tone="warning" n={data?.warnings ?? 0} label={t.hlthWarningCount} />
          </div>
          <div className="space-y-3">
            {(data?.findings ?? []).map((f) => (
              <FindingCard key={f.code + f.title} finding={f} fixLabel={t.hlthWhereToFix} onFixed={load} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const TONE: Record<Severity, { card: string; chip: string; Icon: typeof AlertTriangle }> = {
  critical: {
    card: "border-coral/30 bg-coral-50",
    chip: "bg-coral text-white",
    Icon: AlertTriangle,
  },
  warning: {
    card: "border-[#f0d9a8] bg-[#fdf2dd]",
    chip: "bg-[#854f0b] text-white",
    Icon: AlertTriangle,
  },
  info: { card: "border-line bg-white", chip: "bg-blue-50 text-blue-600", Icon: Info },
};

function Tally({ tone, n, label }: { tone: Severity; n: number; label: string }) {
  if (!n) return null;
  return (
    <span className={`rounded-full px-3 py-1 font-medium ${TONE[tone].chip}`}>
      {n} {label}
    </span>
  );
}

function FindingCard({
  finding,
  fixLabel,
  onFixed,
}: {
  finding: Finding;
  fixLabel: string;
  onFixed?: () => void;
}) {
  const { card, Icon } = TONE[finding.severity] ?? TONE.info;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  /**
   * A finding that can be fixed from here gets a button. Most cannot — they
   * point at a screen — but "products of hidden sellers are still flagged
   * published" is a single mechanical action, and telling an operator to go do
   * it by hand across ten products is how a warning becomes permanent.
   */
  async function unpublish() {
    setBusy(true);
    try {
      const r = await unpublishHiddenVendorProducts();
      setDone(`تم إلغاء نشر ${r.unpublished} منتج${r.failed ? ` · فشل ${r.failed}` : ""}`);
      onFixed?.();
    } catch (e) {
      setDone(e instanceof Error ? e.message : "تعذّر إلغاء النشر.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-2 rounded-2xl border p-4 ${card}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ink-600" />
        <p className="font-medium text-ink">{finding.title}</p>
      </div>
      <p className="text-sm leading-relaxed text-ink-600">{finding.detail}</p>
      {finding.fix && (
        <p className="flex items-center gap-1.5 text-sm text-ink-400">
          <Wrench className="h-3.5 w-3.5 shrink-0" />
          <span>
            {fixLabel} {finding.fix}
          </span>
        </p>
      )}
      {finding.code === "hidden_vendor_products" && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={unpublish}
            disabled={busy}
            className="btn btn-primary h-8 px-3 text-sm disabled:opacity-50"
          >
            {busy ? "…" : "ألغِ نشرها الآن"}
          </button>
          {done && <span className="text-sm text-ink-600">{done}</span>}
        </div>
      )}
    </div>
  );
}

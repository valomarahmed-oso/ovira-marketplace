"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { formatPrice } from "@/lib/utils";
import {
  clearFlag,
  deleteBlocklist,
  flaggedOrders,
  listBlocklist,
  previewAssessment,
  upsertBlocklist,
  type Assessment,
  type BlocklistEntry,
  type FlaggedOrder,
} from "@/lib/cod-risk-api";

const fieldCls =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue";

/** Operator console for cash-on-delivery screening: the review queue, the
 *  blocklist, and a tester for the thresholds. Amounts stay in the base
 *  currency — these are settled figures, not shopper-facing prices. */
export default function AdminCodRiskPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [flagged, setFlagged] = useState<FlaggedOrder[]>([]);
  const [block, setBlock] = useState<BlocklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [f, b] = await Promise.all([flaggedOrders(), listBlocklist()]);
    setFlagged(f);
    setBlock(b);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  async function release(order: string) {
    setError(null);
    try {
      await clearFlag(order);
      setFlagged((prev) => prev.filter((o) => o.name !== order));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.codErr);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-medium text-ink">
          <ShieldAlert className="h-5 w-5 text-blue-600" />
          {t.codTitle}
        </h2>
        <p className="text-sm text-ink-400">{t.codSubtitle}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Review queue */}
          <section className="space-y-3">
            <h3 className="font-medium text-ink">
              {t.codQueue}{" "}
              <span className="text-sm text-ink-400">({flagged.length})</span>
            </h3>
            {flagged.length === 0 ? (
              <div className="card p-6 text-center text-sm text-ink-400">{t.codQueueEmpty}</div>
            ) : (
              <div className="space-y-3">
                {flagged.map((o) => (
                  <div key={o.name} className="card space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-tech text-sm text-ink">{o.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            o.cod_risk_score >= 70
                              ? "bg-coral-50 text-coral"
                              : "bg-[#fdf2dd] text-[#854f0b]"
                          }`}
                        >
                          {t.codScore}: {o.cod_risk_score}
                        </span>
                        <span className="text-xs text-ink-400">{o.status}</span>
                      </div>
                      <span className="font-tech text-sm text-ink">{formatPrice(o.total)}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-ink-400">
                      <span>{o.customer_name ?? "—"}</span>
                      <span dir="ltr">{o.phone ?? "—"}</span>
                      <span>{o.governorate ?? "—"}</span>
                      <span>{o.creation}</span>
                    </div>
                    {o.cod_risk_flags && (
                      <p className="rounded-lg bg-[#fdf2dd] px-3 py-2 text-xs text-[#854f0b]">
                        {o.cod_risk_flags}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => release(o.name)}
                        className="btn btn-ghost h-9 border border-line text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t.codRelease}
                      </button>
                      <BlockButton order={o} onBlocked={setBlock} onError={setError} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Tester />

          {/* Blocklist */}
          <section className="space-y-3">
            <h3 className="font-medium text-ink">
              {t.codBlocklist} <span className="text-sm text-ink-400">({block.length})</span>
            </h3>
            <AddBlock onSaved={setBlock} onError={setError} />
            {block.length === 0 ? (
              <div className="card p-6 text-center text-sm text-ink-400">{t.codBlockEmpty}</div>
            ) : (
              <div className="card divide-y divide-line">
                {block.map((b) => (
                  <div key={b.name} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-tech text-sm text-ink" dir="ltr">
                          {b.identifier}
                        </span>
                        <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
                          {b.kind}
                        </span>
                        {!b.active && (
                          <span className="text-xs text-ink-400">{t.codInactive}</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-400">
                        {b.reason ?? "—"}
                        {b.note ? ` · ${b.note}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(t.codRemoveConfirm)) return;
                        try {
                          setBlock(await deleteBlocklist(b.name));
                        } catch (err) {
                          setError(err instanceof Error ? err.message : t.codErr);
                        }
                      }}
                      className="rounded-lg p-2 text-ink-400 hover:bg-coral-50 hover:text-coral"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function BlockButton({
  order,
  onBlocked,
  onError,
}: {
  order: FlaggedOrder;
  onBlocked: (rows: BlocklistEntry[]) => void;
  onError: (m: string | null) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  if (!order.phone) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(t.codBlockConfirm)) return;
        setBusy(true);
        try {
          onBlocked(
            await upsertBlocklist({
              identifier: order.phone as string,
              kind: "Phone",
              reason: "Repeated refusal",
              note: order.name,
              active: 1,
            })
          );
        } catch (err) {
          onError(err instanceof Error ? err.message : t.codErr);
        } finally {
          setBusy(false);
        }
      }}
      className="btn btn-ghost h-9 border border-line text-sm text-coral disabled:opacity-50"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {t.codBlockCustomer}
    </button>
  );
}

function AddBlock({
  onSaved,
  onError,
}: {
  onSaved: (rows: BlocklistEntry[]) => void;
  onError: (m: string | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [kind, setKind] = useState<"Phone" | "Email">("Phone");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost border border-line">
        <Plus className="h-4 w-4" />
        {t.codAddBlock}
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={kind === "Phone" ? "01012345678" : "name@example.com"}
          dir="ltr"
          className={fieldCls}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "Phone" | "Email")}
          className={fieldCls}
        >
          <option value="Phone">{t.codKindPhone}</option>
          <option value="Email">{t.codKindEmail}</option>
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.codBlockNote}
          className={fieldCls}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy || !identifier.trim()}
          onClick={async () => {
            setBusy(true);
            onError(null);
            try {
              onSaved(
                await upsertBlocklist({ identifier: identifier.trim(), kind, note, active: 1 })
              );
              setIdentifier("");
              setNote("");
              setOpen(false);
            } catch (err) {
              onError(err instanceof Error ? err.message : t.codErr);
            } finally {
              setBusy(false);
            }
          }}
          className="btn btn-primary disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.codAdd}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost text-sm">
          {t.mhCancel}
        </button>
      </div>
    </div>
  );
}

/** Try the current thresholds against a real customer without placing an order. */
function Tester() {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Assessment | null>(null);

  const tone: Record<string, string> = {
    allow: "bg-emerald-50 text-emerald-700",
    review: "bg-[#fdf2dd] text-[#854f0b]",
    block: "bg-coral-50 text-coral",
  };
  const label: Record<string, string> = {
    allow: t.codAllow,
    review: t.codReview,
    block: t.codBlock,
  };

  return (
    <section className="card space-y-3 p-5">
      <div className="font-medium text-ink">{t.codTester}</div>
      <p className="text-xs text-ink-400">{t.codTesterHint}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="01012345678"
          dir="ltr"
          className={fieldCls}
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t.codAmount}
          type="number"
          dir="ltr"
          className={fieldCls}
        />
        <button
          type="button"
          disabled={busy || !phone.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              setResult(
                await previewAssessment({ phone: phone.trim(), amount: Number(amount) || 0 })
              );
            } finally {
              setBusy(false);
            }
          }}
          className="btn btn-primary disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.codRun}
        </button>
      </div>
      {result && (
        <div className="space-y-2 rounded-xl bg-ink-50/60 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[result.decision]}`}>
              {label[result.decision]}
            </span>
            <span className="text-ink-400">
              {t.codScore}: {result.score}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-ink-400">
            <span>
              {t.codOpen}: {result.open_orders}
            </span>
            <span>
              {t.codDelivered}: {result.delivered}
            </span>
            <span>
              {t.codRefused}: {result.refused}
            </span>
          </div>
          {result.reasons.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-xs text-ink-600">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

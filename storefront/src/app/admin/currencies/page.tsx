"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Coins, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import {
  deleteCurrency,
  fetchRate,
  listCurrencies,
  upsertCurrency,
  type CurrencyRow,
} from "@/lib/currencies-api";

const fieldCls =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-blue";

/** Operator screen for the store's own display currencies. Rates are entered
 *  here; ERPNext and the public FX API are optional conveniences that only fill
 *  the input in. Conversion is display-only — see lib/currency.ts. */
export default function AdminCurrenciesPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [base, setBase] = useState("EGP");
  const [rows, setRows] = useState<CurrencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listCurrencies();
    if (data) {
      setBase(data.base);
      setRows(data.rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  function applyList(data: { base: string; rows: CurrencyRow[] }) {
    setBase(data.base);
    setRows(data.rows);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.curTitle}</h2>
        <p className="text-sm text-ink-400">{t.curSubtitle}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-ink-600">
        <Coins className="h-4 w-4 text-blue-600" />
        {t.curBaseIs} <strong className="font-tech text-ink">{base}</strong>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {rows.length === 0 && (
            <div className="card p-6 text-center text-sm text-ink-400">{t.curNoRows}</div>
          )}

          {rows.map((row) => (
            <CurrencyCard
              key={row.name}
              row={row}
              onChanged={applyList}
              onError={setError}
            />
          ))}

          {adding ? (
            <NewCurrencyCard
              onCreated={(d) => {
                applyList(d);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
              onError={setError}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="btn btn-ghost border border-line"
            >
              <Plus className="h-4 w-4" />
              {t.curAdd}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CurrencyCard({
  row,
  onChanged,
  onError,
}: {
  row: CurrencyRow;
  onChanged: (d: { base: string; rows: CurrencyRow[] }) => void;
  onError: (m: string | null) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<CurrencyRow>(row);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isBase = !!draft.is_base;

  function set<K extends keyof CurrencyRow>(key: K, value: CurrencyRow[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    onError(null);
    setSaved(false);
    try {
      onChanged(
        await upsertCurrency({
          name: draft.name,
          currency_name: draft.currency_name ?? "",
          currency_name_ar: draft.currency_name_ar ?? "",
          symbol: draft.symbol ?? "",
          rate_to_base: draft.rate_to_base,
          decimals: draft.decimals,
          enabled: draft.enabled ? 1 : 0,
          is_base: draft.is_base ? 1 : 0,
          display_order: draft.display_order,
        })
      );
      setSaved(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : t.curSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function pull(source: "ERPNext" | "API") {
    setFetching(source);
    setNote(null);
    onError(null);
    try {
      const res = await fetchRate(draft.name, source);
      if (res.ok && res.rate) {
        // Drop it into the input — the operator still presses Save.
        setDraft((d) => ({ ...d, rate_to_base: res.rate as number, rate_source: source }));
        setNote(t.curFetched);
        setSaved(false);
      } else {
        onError(res.error ?? t.curSaveFailed);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : t.curSaveFailed);
    } finally {
      setFetching(null);
    }
  }

  async function remove() {
    if (!window.confirm(t.curDeleteConfirm)) return;
    setBusy(true);
    try {
      onChanged(await deleteCurrency(draft.name));
    } catch (err) {
      onError(err instanceof Error ? err.message : t.curSaveFailed);
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 font-tech text-sm text-blue-600">
            {draft.currency_code}
          </span>
          <div>
            <div className="font-medium text-ink">
              {draft.currency_name_ar || draft.currency_name || draft.currency_code}
            </div>
            <div className="text-xs text-ink-400">
              {draft.rate_source || "Manual"} ·{" "}
              {draft.rate_updated_on ? draft.rate_updated_on.slice(0, 16) : t.curNever}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isBase && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
              {t.curIsBase}
            </span>
          )}
          {!isBase && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              title={t.curDelete}
              className="rounded-lg p-2 text-ink-400 hover:bg-coral-50 hover:text-coral disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curNameAr}</span>
          <input
            value={draft.currency_name_ar ?? ""}
            onChange={(e) => set("currency_name_ar", e.target.value)}
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curNameEn}</span>
          <input
            value={draft.currency_name ?? ""}
            onChange={(e) => set("currency_name", e.target.value)}
            dir="ltr"
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curSymbol}</span>
          <input
            value={draft.symbol ?? ""}
            onChange={(e) => set("symbol", e.target.value)}
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curRate}</span>
          <input
            type="number"
            step="any"
            dir="ltr"
            value={draft.rate_to_base}
            disabled={isBase}
            onChange={(e) => set("rate_to_base", Number(e.target.value))}
            className={`${fieldCls} disabled:bg-ink-50 disabled:text-ink-400`}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curDecimals}</span>
          <input
            type="number"
            dir="ltr"
            value={draft.decimals}
            onChange={(e) => set("decimals", Number(e.target.value))}
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curOrder}</span>
          <input
            type="number"
            dir="ltr"
            value={draft.display_order}
            onChange={(e) => set("display_order", Number(e.target.value))}
            className={fieldCls}
          />
        </label>
      </div>

      <p className="text-xs text-ink-400">{isBase ? t.curBaseLocked : t.curRateHint}</p>

      <div className="flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={!!draft.enabled}
            disabled={isBase}
            onChange={(e) => set("enabled", e.target.checked ? 1 : 0)}
            className="h-4 w-4 accent-blue"
          />
          {t.curEnabled}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={isBase}
            onChange={(e) => set("is_base", e.target.checked ? 1 : 0)}
            className="h-4 w-4 accent-blue"
          />
          {t.curIsBase}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy} className="btn btn-primary disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.curSave}
        </button>
        {!isBase && (
          <>
            <button
              type="button"
              onClick={() => pull("ERPNext")}
              disabled={!!fetching}
              className="btn btn-ghost border border-line text-sm disabled:opacity-50"
            >
              {fetching === "ERPNext" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {fetching === "ERPNext" ? t.curFetching : t.curFetchErp}
            </button>
            <button
              type="button"
              onClick={() => pull("API")}
              disabled={!!fetching}
              className="btn btn-ghost border border-line text-sm disabled:opacity-50"
            >
              {fetching === "API" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {fetching === "API" ? t.curFetching : t.curFetchApi}
            </button>
          </>
        )}
        {note && <span className="text-sm text-blue-600">{note}</span>}
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-mint">
            <CheckCircle2 className="h-4 w-4" /> {t.savedOk}
          </span>
        )}
      </div>
    </div>
  );
}

function NewCurrencyCard({
  onCreated,
  onCancel,
  onError,
}: {
  onCreated: (d: { base: string; rows: CurrencyRow[] }) => void;
  onCancel: () => void;
  onError: (m: string | null) => void;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [symbol, setSymbol] = useState("");
  const [rate, setRate] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!code.trim()) return;
    setBusy(true);
    onError(null);
    try {
      onCreated(
        await upsertCurrency({
          currency_code: code.trim().toUpperCase(),
          currency_name: nameEn,
          currency_name_ar: nameAr,
          symbol,
          rate_to_base: rate,
          decimals: 2,
          enabled: 1,
          display_order: 10,
        })
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : t.curSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="font-medium text-ink">{t.curAdd}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curCode}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="USD"
            dir="ltr"
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curNameAr}</span>
          <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={fieldCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curNameEn}</span>
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            dir="ltr"
            className={fieldCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curSymbol}</span>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} className={fieldCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-400">{t.curRate}</span>
          <input
            type="number"
            step="any"
            dir="ltr"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className={fieldCls}
          />
        </label>
      </div>
      <p className="text-xs text-ink-400">{t.curRateHint}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={create}
          disabled={busy || !code.trim()}
          className="btn btn-primary disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.curAdd}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost text-sm">
          {t.mhCancel}
        </button>
      </div>
    </div>
  );
}

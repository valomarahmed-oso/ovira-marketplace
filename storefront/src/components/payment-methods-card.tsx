"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  deletePaymentMethod,
  listPaymentMethodsAdmin,
  upsertPaymentMethod,
  type PaymentMethodAdmin,
} from "@/lib/payment-methods";

type Draft = {
  name?: string;
  method_name: string;
  method_name_en: string;
  kind: "Cash on Delivery" | "Manual Transfer";
  instructions: string;
  instructions_en: string;
  account_details: string;
  display_order: string;
  enabled: boolean;
};

const blank: Draft = {
  method_name: "",
  method_name_en: "",
  kind: "Manual Transfer",
  instructions: "",
  instructions_en: "",
  account_details: "",
  display_order: "0",
  enabled: true,
};

function toDraft(m: PaymentMethodAdmin): Draft {
  return {
    name: m.name,
    method_name: m.method_name ?? "",
    method_name_en: m.method_name_en ?? "",
    kind: m.kind ?? "Manual Transfer",
    instructions: m.instructions ?? "",
    instructions_en: m.instructions_en ?? "",
    account_details: m.account_details ?? "",
    display_order: String(m.display_order ?? 0),
    enabled: m.enabled !== 0,
  };
}

/** Operator manager for the dynamic manual payment-method directory (COD
 *  variants + bank/wallet transfers) shown to buyers at checkout. */
export function PaymentMethodsCard() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Draft[]>([]);
  const [adding, setAdding] = useState<Draft>({ ...blank });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRows((await listPaymentMethodsAdmin()).map(toDraft));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function set(key: string, i: number, patch: Partial<Draft>) {
    if (key === "new") setAdding((d) => ({ ...d, ...patch }));
    else setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSavedKey(null);
  }

  async function save(d: Draft, key: string) {
    if (!d.method_name.trim()) return;
    setSavingKey(key);
    setError(null);
    setSavedKey(null);
    try {
      await upsertPaymentMethod({
        name: d.name,
        method_name: d.method_name.trim(),
        method_name_en: d.method_name_en.trim(),
        kind: d.kind,
        instructions: d.instructions.trim(),
        instructions_en: d.instructions_en.trim(),
        account_details: d.account_details.trim(),
        display_order: Number(d.display_order) || 0,
        enabled: d.enabled ? 1 : 0,
      });
      setSavedKey(key);
      if (key === "new") setAdding({ ...blank });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.pmSaveErr);
    } finally {
      setSavingKey(null);
    }
  }

  async function remove(d: Draft) {
    if (!d.name || !window.confirm(t.pmDeleteConfirm)) return;
    setSavingKey(d.name);
    try {
      await deletePaymentMethod(d.name);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.pmSaveErr);
    } finally {
      setSavingKey(null);
    }
  }

  const field = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-blue";
  const area = "min-h-16 w-full rounded-lg border border-line bg-white p-3 text-sm outline-none focus:border-blue";
  const lbl = "mb-1 block text-xs font-medium text-ink-600";

  function rowForm(d: Draft, i: number, key: string) {
    return (
      <div className="space-y-3 rounded-xl border border-line p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>{t.pmNameAr}</label>
            <input value={d.method_name} onChange={(e) => set(key, i, { method_name: e.target.value })} placeholder={t.pmNameArPlaceholder} className={field} />
          </div>
          <div>
            <label className={lbl}>{t.pmNameEn}</label>
            <input value={d.method_name_en} onChange={(e) => set(key, i, { method_name_en: e.target.value })} placeholder={t.pmNameEnPlaceholder} className={field} dir="ltr" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>{t.pmKind}</label>
            <select value={d.kind} onChange={(e) => set(key, i, { kind: e.target.value as Draft["kind"] })} className={field}>
              <option value="Manual Transfer">{t.pmKindManual}</option>
              <option value="Cash on Delivery">{t.pmKindCod}</option>
            </select>
          </div>
          <div>
            <label className={lbl}>{t.pmOrder}</label>
            <input value={d.display_order} onChange={(e) => set(key, i, { display_order: e.target.value })} className={field} type="number" inputMode="numeric" />
          </div>
        </div>
        {d.kind === "Manual Transfer" && (
          <div>
            <label className={lbl}>{t.pmAccount}</label>
            <input value={d.account_details} onChange={(e) => set(key, i, { account_details: e.target.value })} className={field} dir="ltr" />
            <p className="mt-1 text-xs text-ink-400">{t.pmAccountHint}</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>{t.pmInstructionsAr}</label>
            <textarea value={d.instructions} onChange={(e) => set(key, i, { instructions: e.target.value })} className={area} />
          </div>
          <div>
            <label className={lbl}>{t.pmInstructionsEn}</label>
            <textarea value={d.instructions_en} onChange={(e) => set(key, i, { instructions_en: e.target.value })} className={area} dir="ltr" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" checked={d.enabled} onChange={(e) => set(key, i, { enabled: e.target.checked })} className="h-4 w-4 rounded border-line" />
            {t.pmEnabled}
          </label>
          <button
            type="button"
            onClick={() => save(d, key)}
            disabled={savingKey === key || !d.method_name.trim()}
            className="btn btn-primary h-9 px-4 text-sm disabled:opacity-50"
          >
            {savingKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : savedKey === key ? <Check className="h-4 w-4" /> : key === "new" ? <Plus className="h-4 w-4" /> : null}
            {key === "new" ? t.pmAdd : savedKey === key ? t.pmSaved : t.pmSave}
          </button>
          {key !== "new" && (
            <button
              type="button"
              onClick={() => remove(d)}
              disabled={savingKey === d.name}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-coral hover:bg-coral-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> {t.pmDelete}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-blue-600" />
        <div>
          <h3 className="font-medium text-ink">{t.pmTitle}</h3>
          <p className="text-sm text-ink-400">{t.pmSubtitle}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> {t.loading}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.length === 0 && <p className="text-sm text-ink-400">{t.pmEmpty}</p>}
          {rows.map((d, i) => (
            <div key={d.name ?? i}>{rowForm(d, i, d.name ?? String(i))}</div>
          ))}
          <div className="border-t border-line pt-3">{rowForm(adding, -1, "new")}</div>
        </div>
      )}
    </div>
  );
}

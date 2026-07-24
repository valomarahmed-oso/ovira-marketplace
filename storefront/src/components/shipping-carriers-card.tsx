"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Plus, Trash2, Truck } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  deleteCarrier,
  listCarriersAdmin,
  upsertCarrier,
  type CarrierAdmin,
} from "@/lib/shipments-api";

type Draft = {
  name?: string;
  carrier_name: string;
  carrier_name_en: string;
  tracking_url_template: string;
  phone: string;
  display_order: string;
  enabled: boolean;
};

const blank: Draft = {
  carrier_name: "",
  carrier_name_en: "",
  tracking_url_template: "",
  phone: "",
  display_order: "0",
  enabled: true,
};

function toDraft(c: CarrierAdmin): Draft {
  return {
    name: c.name,
    carrier_name: c.carrier_name ?? "",
    carrier_name_en: c.carrier_name_en ?? "",
    tracking_url_template: c.tracking_url_template ?? "",
    phone: c.phone ?? "",
    display_order: String(c.display_order ?? 0),
    enabled: c.enabled !== 0,
  };
}

/** Operator manager for the dynamic shipping-carrier directory. Add any courier
 *  company (name AR/EN + tracking-URL template) for vendors to pick when shipping. */
export function ShippingCarriersCard() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Draft[]>([]);
  const [adding, setAdding] = useState<Draft>({ ...blank });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const list = await listCarriersAdmin();
    setRows(list.map(toDraft));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function patchRow(i: number, key: keyof Draft, value: string | boolean) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
    setSavedKey(null);
  }

  async function save(d: Draft, key: string) {
    if (!d.carrier_name.trim()) return;
    setSavingKey(key);
    setError(null);
    setSavedKey(null);
    try {
      await upsertCarrier({
        name: d.name,
        carrier_name: d.carrier_name.trim(),
        carrier_name_en: d.carrier_name_en.trim(),
        tracking_url_template: d.tracking_url_template.trim(),
        phone: d.phone.trim(),
        display_order: Number(d.display_order) || 0,
        enabled: d.enabled ? 1 : 0,
      });
      setSavedKey(key);
      if (key === "new") setAdding({ ...blank });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.carSaveErr);
    } finally {
      setSavingKey(null);
    }
  }

  async function remove(d: Draft) {
    if (!d.name || !window.confirm(t.carDeleteConfirm)) return;
    setSavingKey(d.name);
    try {
      await deleteCarrier(d.name);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.carSaveErr);
    } finally {
      setSavingKey(null);
    }
  }

  const field = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-blue";
  const lbl = "mb-1 block text-xs font-medium text-ink-600";

  function rowForm(d: Draft, i: number, key: string) {
    return (
      <div className="space-y-3 rounded-xl border border-line p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>{t.carNameAr}</label>
            <input
              value={d.carrier_name}
              onChange={(e) => (key === "new" ? setAdding({ ...d, carrier_name: e.target.value }) : patchRow(i, "carrier_name", e.target.value))}
              placeholder={t.carNameArPlaceholder}
              className={field}
            />
          </div>
          <div>
            <label className={lbl}>{t.carNameEn}</label>
            <input
              value={d.carrier_name_en}
              onChange={(e) => (key === "new" ? setAdding({ ...d, carrier_name_en: e.target.value }) : patchRow(i, "carrier_name_en", e.target.value))}
              placeholder={t.carNameEnPlaceholder}
              className={field}
              dir="ltr"
            />
          </div>
        </div>
        <div>
          <label className={lbl}>{t.carTrackingTemplate}</label>
          <input
            value={d.tracking_url_template}
            onChange={(e) => (key === "new" ? setAdding({ ...d, tracking_url_template: e.target.value }) : patchRow(i, "tracking_url_template", e.target.value))}
            placeholder="https://…/{tracking}"
            className={field}
            dir="ltr"
          />
          <p className="mt-1 text-xs text-ink-400">{t.carTrackingHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={lbl}>{t.carPhone}</label>
            <input
              value={d.phone}
              onChange={(e) => (key === "new" ? setAdding({ ...d, phone: e.target.value }) : patchRow(i, "phone", e.target.value))}
              className={field}
              dir="ltr"
            />
          </div>
          <div>
            <label className={lbl}>{t.carOrder}</label>
            <input
              value={d.display_order}
              onChange={(e) => (key === "new" ? setAdding({ ...d, display_order: e.target.value }) : patchRow(i, "display_order", e.target.value))}
              className={field}
              type="number"
              inputMode="numeric"
            />
          </div>
          <label className="flex cursor-pointer items-end gap-2 pb-2 text-sm text-ink-600">
            <input
              type="checkbox"
              checked={d.enabled}
              onChange={(e) => (key === "new" ? setAdding({ ...d, enabled: e.target.checked }) : patchRow(i, "enabled", e.target.checked))}
              className="h-4 w-4 rounded border-line"
            />
            {t.carEnabled}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => save(d, key)}
            disabled={savingKey === key || !d.carrier_name.trim()}
            className="btn btn-primary h-9 px-4 text-sm disabled:opacity-50"
          >
            {savingKey === key ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : savedKey === key ? (
              <Check className="h-4 w-4" />
            ) : key === "new" ? (
              <Plus className="h-4 w-4" />
            ) : null}
            {key === "new" ? t.carAdd : savedKey === key ? t.carSaved : t.carSave}
          </button>
          {key !== "new" && (
            <button
              type="button"
              onClick={() => remove(d)}
              disabled={savingKey === d.name}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-coral hover:bg-coral-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> {t.carDelete}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-blue-600" />
        <div>
          <h3 className="font-medium text-ink">{t.carTitle}</h3>
          <p className="text-sm text-ink-400">{t.carSubtitle}</p>
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
          {rows.length === 0 && <p className="text-sm text-ink-400">{t.carEmpty}</p>}
          {rows.map((d, i) => (
            <div key={d.name ?? i}>{rowForm(d, i, d.name ?? String(i))}</div>
          ))}
          <div className="border-t border-line pt-3">{rowForm(adding, -1, "new")}</div>
        </div>
      )}
    </div>
  );
}

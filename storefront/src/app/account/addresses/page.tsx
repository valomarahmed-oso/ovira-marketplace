"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, Star, Trash2 } from "lucide-react";
import {
  deleteAddress,
  getMyAddresses,
  GOVERNORATES,
  setDefaultAddress,
  upsertAddress,
  type BuyerAddress,
} from "@/lib/addresses-api";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export default function AddressesPage() {
  const { t } = useI18n();
  const [addresses, setAddresses] = useState<BuyerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", gov: GOVERNORATES[0], address: "" });

  function reload() {
    return getMyAddresses().then(setAddresses);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await upsertAddress({
        full_name: form.name,
        phone: form.phone,
        governorate: form.gov,
        address: form.address,
        is_default: addresses.length === 0 ? 1 : 0,
      });
      setForm({ name: "", phone: "", gov: GOVERNORATES[0], address: "" });
      setOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.adrSaveErr);
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(name: string) {
    await setDefaultAddress(name);
    await reload();
  }

  async function remove(name: string) {
    await deleteAddress(name);
    await reload();
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-ink">{t.adrTitle}</h1>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-primary">
          <Plus className="h-4 w-4" /> {t.adrNew}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-coral bg-coral-50 px-4 py-3 text-sm text-coral">{error}</div>
      )}

      {open && (
        <form onSubmit={save} className="card grid gap-3 p-5 sm:grid-cols-2">
          <input required placeholder={t.adrName} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          <input required placeholder={t.adrPhone} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
          <select value={form.gov} onChange={(e) => setForm({ ...form, gov: e.target.value })} className={field}>
            {GOVERNORATES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <input required placeholder={t.adrDetail} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={field} />
          <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-50 sm:col-span-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t.adrSave}
          </button>
        </form>
      )}

      {addresses.length === 0 ? (
        <div className="card space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <MapPin className="h-7 w-7 text-blue-600" />
          </div>
          <p className="text-ink-400">{t.adrEmpty}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.name} className={cn("card space-y-2 p-5", a.is_default && "border-blue")}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">{a.full_name}</span>
                {a.is_default && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{t.adrDefault}</span>
                )}
              </div>
              <div className="text-sm leading-6 text-ink-600">
                <div>{a.phone}</div>
                <div>{a.address}، {a.governorate}</div>
              </div>
              <div className="flex gap-2 pt-1">
                {!a.is_default && (
                  <button type="button" onClick={() => makeDefault(a.name)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <Star className="h-3.5 w-3.5" /> {t.adrSetDefault}
                  </button>
                )}
                <button type="button" onClick={() => remove(a.name)} className="ms-auto inline-flex items-center gap-1 text-sm text-ink-400 hover:text-coral">
                  <Trash2 className="h-3.5 w-3.5" /> {t.adrDelete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

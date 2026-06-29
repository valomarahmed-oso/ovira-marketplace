"use client";

import { useState } from "react";
import { MapPin, Plus, Star, Trash2 } from "lucide-react";
import { GOVERNORATES, useAddresses } from "@/lib/address-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

export default function AddressesPage() {
  const addresses = useAddresses((s) => s.addresses);
  const add = useAddresses((s) => s.add);
  const remove = useAddresses((s) => s.remove);
  const setDefault = useAddresses((s) => s.setDefault);
  const hydrated = useHydrated();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", gov: GOVERNORATES[0], address: "" });

  function save(e: React.FormEvent) {
    e.preventDefault();
    add(form);
    setForm({ name: "", phone: "", gov: GOVERNORATES[0], address: "" });
    setOpen(false);
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";

  if (!hydrated) {
    return (
      <div className="container-ovira py-10">
        <div className="card p-10 text-center text-ink-400">جارٍ التحميل…</div>
      </div>
    );
  }

  return (
    <div className="container-ovira space-y-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-medium text-ink">العناوين</h1>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-primary">
          <Plus className="h-4 w-4" /> عنوان جديد
        </button>
      </div>

      {open && (
        <form onSubmit={save} className="card grid gap-3 p-5 sm:grid-cols-2">
          <input required placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          <input required placeholder="رقم الموبايل" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
          <select value={form.gov} onChange={(e) => setForm({ ...form, gov: e.target.value })} className={field}>
            {GOVERNORATES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <input required placeholder="العنوان بالتفصيل" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={field} />
          <button type="submit" className="btn btn-primary sm:col-span-2">حفظ العنوان</button>
        </form>
      )}

      {addresses.length === 0 ? (
        <div className="card space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <MapPin className="h-7 w-7 text-blue-600" />
          </div>
          <p className="text-ink-400">لا توجد عناوين محفوظة بعد.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className={cn("card space-y-2 p-5", a.isDefault && "border-blue")}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">{a.name}</span>
                {a.isDefault && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">العنوان الافتراضي</span>
                )}
              </div>
              <div className="text-sm leading-6 text-ink-600">
                <div>{a.phone}</div>
                <div>{a.address}، {a.gov}</div>
              </div>
              <div className="flex gap-2 pt-1">
                {!a.isDefault && (
                  <button type="button" onClick={() => setDefault(a.id)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <Star className="h-3.5 w-3.5" /> تعيين كافتراضي
                  </button>
                )}
                <button type="button" onClick={() => remove(a.id)} className="ms-auto inline-flex items-center gap-1 text-sm text-ink-400 hover:text-coral">
                  <Trash2 className="h-3.5 w-3.5" /> حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

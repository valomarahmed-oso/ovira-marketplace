"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import {
  deleteCategory,
  listAllCategories,
  upsertCategory,
  type AdminCategory,
} from "@/lib/categories-admin";
import { uploadImage } from "@/lib/uploads";
import { useI18n } from "@/components/i18n-provider";

const FRAPPE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const abs = (p?: string | null) =>
  !p ? undefined : /^https?:\/\//.test(p) ? p : `${FRAPPE}${p.startsWith("/") ? "" : "/"}${p}`;

const blank = { name: "", category_name: "", parent: "", image: "", display_order: "", description: "" };

export default function AdminCategoriesPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setCats(await listAllCategories());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  const editing = !!form.name;

  function edit(c: AdminCategory) {
    setForm({
      name: c.name,
      category_name: c.category_name ?? "",
      parent: c.parent_marketplace_category ?? "",
      image: c.image ?? "",
      display_order: c.display_order != null ? String(c.display_order) : "",
      description: c.description ?? "",
    });
    setNotice(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setForm((f) => ({ ...f, image: "" }));
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.catUploadErr);
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category_name.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await upsertCategory({
        name: form.name || undefined,
        category_name: form.category_name.trim(),
        parent: form.parent || undefined,
        image: form.image,
        display_order: form.display_order || undefined,
        description: form.description || undefined,
      });
      setForm({ ...blank });
      setNotice(t.catSaved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.catSaveErr);
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: AdminCategory) {
    if (!confirm(t.catDeleteConfirm.replace("{name}", c.category_name))) return;
    setError(null);
    try {
      await deleteCategory(c.name);
      if (form.name === c.name) setForm({ ...blank });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.catDeleteErr);
    }
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";
  const label = "mb-1.5 block text-sm font-medium text-ink";

  if (ready && !isOperator) {
    return <div className="card p-10 text-center text-ink-400">{t.tmNoPermission}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.catTitle}</h2>
        <p className="text-sm text-ink-400">{t.catSubtitle}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-[#e7f8f1] px-4 py-3 text-sm text-mint">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}

      {/* Add / edit form */}
      <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center justify-between">
          <div className="font-medium text-ink">{editing ? t.catEditTitle : t.catAddTitle}</div>
          {editing && (
            <button type="button" onClick={() => setForm({ ...blank })} className="text-xs text-ink-400 hover:text-blue-600">
              {t.catCancelEdit}
            </button>
          )}
        </div>
        <div>
          <label className={label}>{t.catName}</label>
          <input
            required
            value={form.category_name}
            onChange={(e) => setForm({ ...form, category_name: e.target.value })}
            className={field}
            placeholder={t.catNamePlaceholder}
          />
        </div>
        <div>
          <label className={label}>{t.catParent}</label>
          <select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} className={field}>
            <option value="">{t.catParentNone}</option>
            {cats
              .filter((c) => c.name !== form.name)
              .map((c) => (
                <option key={c.name} value={c.name}>{c.category_name}</option>
              ))}
          </select>
        </div>
        <div>
          <label className={label}>{t.bnOrder}</label>
          <input
            type="number"
            value={form.display_order}
            onChange={(e) => setForm({ ...form, display_order: e.target.value })}
            className={field}
            placeholder="0"
          />
        </div>
        <div>
          <label className={label}>{t.catImage}</label>
          <div className="flex items-center gap-3">
            <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-blue-50">
              {form.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={abs(form.image)} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, image: "" })}
                    aria-label={t.bnImgRemove}
                    className="absolute end-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-ink-600 shadow hover:text-coral"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <ImagePlus className="h-5 w-5 text-blue-300" />
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn btn-ghost h-10 px-3 text-sm disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {t.bnUpload}
            </button>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{t.catDescription}</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={field}
            placeholder={t.catDescriptionPlaceholder}
          />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editing ? t.catSaveEdit : t.catAdd}
          </button>
        </div>
      </form>

      {/* Category list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : cats.length === 0 ? (
        <div className="card p-10 text-center text-ink-400">{t.catEmpty}</div>
      ) : (
        <div className="card divide-y divide-line">
          {cats.map((c) => (
            <div key={c.name} className="flex items-center gap-3 p-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-blue-50 text-lg">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={abs(c.image)} alt="" className="h-full w-full object-cover" />
                ) : (
                  c.icon || "🗂️"
                )}
              </span>
              <div className="min-w-0 grow">
                <div className="truncate text-sm font-medium text-ink">{c.category_name}</div>
                <div className="font-tech text-xs text-ink-400">
                  {c.product_count} {t.ordItemsCount}
                  {c.parent_marketplace_category ? ` · ${t.catSubcategory}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => edit(c)}
                aria-label={t.catEditAria}
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(c)}
                aria-label={t.adrDelete}
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

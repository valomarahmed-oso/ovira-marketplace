"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { listBanners, upsertBanner, deleteBanner, type AdminBanner } from "@/lib/banners-admin";
import { getSiteContentAdmin, updateSiteContent } from "@/lib/admin";
import { uploadImage } from "@/lib/uploads";

const FRAPPE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const abs = (p?: string | null) =>
  !p ? undefined : /^https?:\/\//.test(p) ? p : `${FRAPPE}${p.startsWith("/") ? "" : "/"}${p}`;

const TONES = ["Blue", "Coral", "Light Blue", "Mint", "Gold"] as const;

const blank = {
  name: "",
  placement: "Promo",
  title: "",
  title_en: "",
  subtitle: "",
  subtitle_en: "",
  cta_label: "",
  cta_label_en: "",
  link: "",
  tone: "Blue",
  display_order: "",
  is_active: true,
  image: "",
};

export default function AdminBannersPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const canEdit = !!user?.isOperator || !!user?.isContentEditor;

  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hero badge (from Site Content CMS) — bilingual.
  const [badge, setBadge] = useState({ ar: "", en: "" });
  const [badgeSaving, setBadgeSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [rows, site] = await Promise.all([listBanners(), getSiteContentAdmin()]);
    setBanners(rows);
    setBadge({ ar: site.hero_badge ?? "", en: site.hero_badge_en ?? "" });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !canEdit) return;
    void load();
  }, [ready, canEdit, load]);

  const editing = !!form.name;
  const toneLabel: Record<string, string> = {
    Blue: t.bnToneBlue,
    Coral: t.bnToneCoral,
    "Light Blue": t.bnToneLightBlue,
    Mint: t.bnToneMint,
    Gold: t.bnToneGold,
  };

  function edit(b: AdminBanner) {
    setForm({
      name: b.name,
      placement: b.placement || "Promo",
      title: b.title ?? "",
      title_en: b.title_en ?? "",
      subtitle: b.subtitle ?? "",
      subtitle_en: b.subtitle_en ?? "",
      cta_label: b.cta_label ?? "",
      cta_label_en: b.cta_label_en ?? "",
      link: b.link ?? "",
      tone: b.tone || "Blue",
      display_order: b.display_order != null ? String(b.display_order) : "",
      is_active: b.is_active !== 0,
      image: b.image ?? "",
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
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.bnUploadErr);
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await upsertBanner({
        name: form.name || undefined,
        placement: form.placement,
        title: form.title.trim(),
        title_en: form.title_en,
        subtitle: form.subtitle,
        subtitle_en: form.subtitle_en,
        cta_label: form.cta_label,
        cta_label_en: form.cta_label_en,
        link: form.link,
        tone: form.tone,
        display_order: form.display_order || 0,
        is_active: form.is_active ? 1 : 0,
        image: form.image,
      });
      setForm({ ...blank });
      setNotice(t.bnSaved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.bnSaveErr);
    } finally {
      setSaving(false);
    }
  }

  async function remove(b: AdminBanner) {
    if (!confirm(t.bnDeleteConfirm)) return;
    setError(null);
    try {
      await deleteBanner(b.name);
      if (form.name === b.name) setForm({ ...blank });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.bnSaveErr);
    }
  }

  async function saveBadge() {
    setBadgeSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateSiteContent({ hero_badge: badge.ar, hero_badge_en: badge.en });
      setNotice(t.bnBadgeSaved);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.bnSaveErr);
    } finally {
      setBadgeSaving(false);
    }
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";
  const label = "mb-1.5 block text-sm font-medium text-ink";

  if (ready && !canEdit) {
    return <div className="card p-10 text-center text-ink-400">{t.bnNoPermission}</div>;
  }

  const hero = banners.filter((b) => b.placement === "Hero");
  const promo = banners.filter((b) => b.placement !== "Hero");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.bnTitle}</h2>
        <p className="text-sm text-ink-400">{t.bnSubtitle}</p>
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

      {/* Hero badge (top strip text) */}
      <section className="card space-y-3 p-5">
        <div>
          <div className="font-medium text-ink">{t.bnHeroBadge}</div>
          <p className="text-xs text-ink-400">{t.bnHeroBadgeHint}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs text-ink-400">{t.bnBadgeAr}</span>
            <input value={badge.ar} onChange={(e) => setBadge({ ...badge, ar: e.target.value })} className={field} dir="rtl" />
          </div>
          <div>
            <span className="mb-1 block text-xs text-ink-400">{t.bnBadgeEn}</span>
            <input value={badge.en} onChange={(e) => setBadge({ ...badge, en: e.target.value })} className={field} dir="ltr" />
          </div>
        </div>
        <button type="button" onClick={saveBadge} disabled={badgeSaving} className="btn btn-ghost disabled:opacity-50">
          {badgeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t.bnSaveBadge}
        </button>
      </section>

      {/* Add / edit banner */}
      <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center justify-between">
          <div className="font-medium text-ink">{editing ? t.bnEdit : t.bnAdd}</div>
          {editing && (
            <button type="button" onClick={() => setForm({ ...blank })} className="text-xs text-ink-400 hover:text-blue-600">
              {t.bnCancelEdit}
            </button>
          )}
        </div>

        <div>
          <label className={label}>{t.bnPlacement}</label>
          <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} className={field}>
            <option value="Hero">{t.bnPlacementHero}</option>
            <option value="Promo">{t.bnPlacementPromo}</option>
          </select>
        </div>
        <div>
          <label className={label}>{t.bnTone}</label>
          <select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} className={field}>
            {TONES.map((tn) => (
              <option key={tn} value={tn}>{toneLabel[tn]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={label}>{t.bnTitleAr}</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} dir="rtl" />
        </div>
        <div>
          <label className={label}>{t.bnTitleEn}</label>
          <input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} className={field} dir="ltr" />
        </div>

        <div>
          <label className={label}>{t.bnSubtitleAr}</label>
          <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className={field} dir="rtl" />
        </div>
        <div>
          <label className={label}>{t.bnSubtitleEn}</label>
          <input value={form.subtitle_en} onChange={(e) => setForm({ ...form, subtitle_en: e.target.value })} className={field} dir="ltr" />
        </div>

        <div>
          <label className={label}>{t.bnCtaAr}</label>
          <input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} className={field} dir="rtl" />
        </div>
        <div>
          <label className={label}>{t.bnCtaEn}</label>
          <input value={form.cta_label_en} onChange={(e) => setForm({ ...form, cta_label_en: e.target.value })} className={field} dir="ltr" />
        </div>

        <div>
          <label className={label}>{t.bnLink}</label>
          <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className={field} dir="ltr" placeholder={t.bnLinkHint} />
        </div>
        <div>
          <label className={label}>{t.bnOrder}</label>
          <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} className={field} placeholder="0" />
        </div>

        <div className="sm:col-span-2">
          <label className={label}>{t.bnImage}</label>
          <p className="mb-2 text-xs text-ink-400">{t.bnImageHint}</p>
          <div className="flex items-center gap-3">
            <div className="relative grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-blue-50">
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
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn btn-ghost h-10 px-3 text-sm disabled:opacity-50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {t.bnUpload}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600 sm:col-span-2">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-blue" />
          {t.bnActive}
        </label>

        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t.bnSave}
          </button>
        </div>
      </form>

      {/* Banner lists */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : banners.length === 0 ? (
        <div className="card p-10 text-center text-ink-400">{t.bnEmpty}</div>
      ) : (
        <div className="space-y-4">
          {[
            { label: t.bnHeroList, rows: hero },
            { label: t.bnPromoList, rows: promo },
          ]
            .filter((g) => g.rows.length)
            .map((g) => (
              <div key={g.label}>
                <div className="mb-2 text-sm font-medium text-ink-400">{g.label}</div>
                <div className="card divide-y divide-line">
                  {g.rows.map((b) => (
                    <div key={b.name} className="flex items-center gap-3 p-3">
                      <span className="grid h-11 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-blue-50">
                        {b.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={abs(b.image)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImagePlus className="h-4 w-4 text-blue-300" />
                        )}
                      </span>
                      <div className="min-w-0 grow">
                        <div className="truncate text-sm font-medium text-ink">
                          {b.title}
                          {!b.is_active && <span className="ms-2 text-xs text-coral">({t.bnInactive})</span>}
                        </div>
                        {b.subtitle && <div className="truncate text-xs text-ink-400">{b.subtitle}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => edit(b)}
                        aria-label={t.bnEdit}
                        className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(b)}
                        aria-label={t.bnDelete}
                        className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

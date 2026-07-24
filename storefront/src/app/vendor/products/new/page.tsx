"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight, ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { getCategories, type Category } from "@/lib/api";
import { getMyProduct, upsertProduct } from "@/lib/vendor";
import { uploadImage } from "@/lib/uploads";
import { useI18n } from "@/components/i18n-provider";

function ProductForm() {
  const { t } = useI18n();
  const router = useRouter();
  const editId = useSearchParams().get("id");
  const editing = !!editId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(editing);
  const [form, setForm] = useState({
    title: "",
    category: "",
    brand: "",
    price: "",
    compare_at_price: "",
    stock: "",
    track_inventory: true,
    condition: "New" as "New" | "Used" | "Refurbished",
    images: [] as string[],
    video_url: "",
    short_description: "",
    description: "",
    has_variants: false,
    variant_option_name: "",
    variants: [] as { option_value: string; price: string; stock: string; image: string }[],
    price_tiers: [] as { min_qty: string; price: string }[],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (!files.length) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const urls: string[] = [];
      for (const file of files) urls.push(await uploadImage(file));
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : t.catUploadErr);
    } finally {
      setUploading(false);
    }
  }

  const removeImage = (i: number) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }));

  const makePrimary = (i: number) =>
    setForm((f) => {
      const imgs = [...f.images];
      const [picked] = imgs.splice(i, 1);
      imgs.unshift(picked);
      return { ...f, images: imgs };
    });

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setForm((f) => ({ ...f, images: [...f.images, url] }));
    setUrlInput("");
  }

  const addVariant = () =>
    setForm((f) => ({
      ...f,
      variants: [...f.variants, { option_value: "", price: "", stock: "", image: "" }],
    }));
  const removeVariant = (i: number) =>
    setForm((f) => ({ ...f, variants: f.variants.filter((_, j) => j !== i) }));
  const setVariant = (i: number, key: "option_value" | "price" | "stock" | "image", value: string) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, j) => (j === i ? { ...v, [key]: value } : v)),
    }));

  // Per-variant photo upload (so picking a colour swaps the product image).
  const [vUploading, setVUploading] = useState<number | null>(null);
  async function onPickVariantImage(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setVUploading(i);
    setUploadErr(null);
    try {
      setVariant(i, "image", await uploadImage(file));
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : t.pfVariantUploadErr);
    } finally {
      setVUploading(null);
    }
  }

  useEffect(() => {
    getCategories().then((cats) => {
      setCategories(cats);
      setForm((f) => (f.category ? f : { ...f, category: cats[0]?.name ?? "" }));
    });
  }, []);

  // Prefill when editing an existing product.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    getMyProduct(editId)
      .then((p) => {
        if (cancelled || !p) return;
        setForm({
          title: p.title ?? "",
          category: p.category ?? "",
          brand: p.brand ?? "",
          price: p.price != null ? String(p.price) : "",
          compare_at_price: p.compare_at_price != null ? String(p.compare_at_price) : "",
          stock: p.stock_qty != null ? String(p.stock_qty) : "",
          track_inventory: p.track_inventory == null ? true : !!p.track_inventory,
          condition: (p.condition as "New" | "Used" | "Refurbished") ?? "New",
          images: p.images?.length ? p.images : p.image ? [p.image] : [],
          video_url: p.video_url ?? "",
          short_description: p.short_description ?? "",
          description: p.description ?? "",
          has_variants: !!p.has_variants,
          variant_option_name: p.variant_option_name ?? "",
          variants: (p.variants ?? []).map((v) => ({
            option_value: v.option_value ?? "",
            price: v.price != null ? String(v.price) : "",
            stock: v.stock_qty != null ? String(v.stock_qty) : "",
            image: v.image ?? "",
          })),
          price_tiers: (p.price_tiers ?? []).map((tr) => ({
            min_qty: tr.min_qty != null ? String(tr.min_qty) : "",
            price: tr.price != null ? String(tr.price) : "",
          })),
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Variant products define price + stock per row; the base price becomes the
    // cheapest variant. Blank-value rows are dropped.
    const variantRows = form.variants
      .filter((v) => v.option_value.trim())
      .map((v) => ({
        option_value: v.option_value.trim(),
        price: Number(v.price) || 0,
        stock_qty: Number(v.stock) || 0,
        image: v.image.trim() || undefined,
      }));
    const variantPrices = variantRows.map((v) => v.price).filter((p) => p > 0);

    if (form.has_variants && variantRows.length === 0) {
      setError(t.pfNeedVariant);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await upsertProduct({
        name: editId ?? undefined,
        title: form.title,
        category: form.category || undefined,
        brand: form.brand.trim() || undefined,
        short_description: form.short_description.trim() || undefined,
        price: form.has_variants
          ? variantPrices.length
            ? Math.min(...variantPrices)
            : 0
          : Number(form.price) || 0,
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : undefined,
        stock_qty: form.has_variants || form.stock === "" ? undefined : Number(form.stock),
        track_inventory: form.track_inventory ? 1 : 0,
        condition: form.condition,
        images: form.images,
        video_url: form.video_url.trim(),
        description: form.description || undefined,
        has_variants: form.has_variants ? 1 : 0,
        variant_option_name: form.has_variants ? form.variant_option_name || undefined : undefined,
        variants: form.has_variants ? variantRows : undefined,
        price_tiers: form.has_variants
          ? []
          : form.price_tiers
              .filter((tr) => Number(tr.min_qty) >= 2 && Number(tr.price) > 0)
              .map((tr) => ({ min_qty: Number(tr.min_qty), price: Number(tr.price) })),
      });
      router.push("/vendor/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.pfSaveErr);
      setBusy(false);
    }
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";
  const label = "mb-1.5 block text-sm font-medium text-ink";

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/vendor/products" className="grid h-9 w-9 place-items-center rounded-xl border border-line hover:bg-blue-50">
          <ArrowRight className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-medium text-ink">{editing ? t.vpEditAria : t.pfAddTitle}</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-coral bg-coral-50 px-4 py-3 text-sm text-coral">{error}</div>
      )}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card space-y-4 p-5">
            <div>
              <label className={label}>{t.pfName}</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} placeholder={t.pfNamePlaceholder} />
            </div>
            <div>
              <label className={label}>{t.pfShortDesc}</label>
              <input
                value={form.short_description}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                className={field}
                placeholder={t.pfShortDescPlaceholder}
                maxLength={160}
              />
            </div>
            <div>
              <label className={label}>{t.pfDescription}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-28 w-full rounded-xl border border-line bg-white p-4 text-sm outline-none focus:border-blue"
                placeholder={t.pfDescriptionPlaceholder}
              />
            </div>
            <div>
              <label className={label}>{t.pfImages}</label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {form.images.map((img, i) => (
                  <div key={img + i} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-blue-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute start-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {t.pfPrimary}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label={t.bnImgRemove}
                      className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink-600 shadow hover:text-coral"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {i !== 0 && (
                      <button
                        type="button"
                        onClick={() => makePrimary(i)}
                        className="absolute inset-x-0 bottom-0 bg-white/85 py-1 text-[10px] text-blue-600 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        {t.pfMakePrimary}
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="grid aspect-square place-items-center rounded-xl border border-dashed border-line text-ink-400 transition-colors hover:border-blue hover:text-blue-600 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="flex flex-col items-center gap-1">
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-[10px]">{t.pfAddImage}</span>
                    </span>
                  )}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPickFiles} className="hidden" />
              <div className="mt-2 flex gap-2">
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className={field}
                  placeholder={t.pfImageUrlPlaceholder}
                  inputMode="url"
                />
                <button type="button" onClick={addUrl} className="btn btn-ghost shrink-0 px-4">{t.pfAdd}</button>
              </div>
              {uploadErr && <p className="mt-1 text-xs text-coral">{uploadErr}</p>}
              <p className="mt-1 text-xs text-ink-400">{t.pfImageHint}</p>
            </div>
            <div>
              <label className={label}>{t.pfVideo}</label>
              <input
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                className={field}
                dir="ltr"
                placeholder="https://youtu.be/… أو https://…/clip.mp4"
              />
              <p className="mt-1 text-xs text-ink-400">{t.pfVideoHint}</p>
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={form.has_variants}
                onChange={(e) => setForm({ ...form, has_variants: e.target.checked })}
                className="h-4 w-4 accent-blue"
              />
              {t.pfSellVariants}
            </label>

            {form.has_variants && (
              <>
                <div>
                  <label className={label}>{t.pfOptionName}</label>
                  <input
                    value={form.variant_option_name}
                    onChange={(e) => setForm({ ...form, variant_option_name: e.target.value })}
                    className={field}
                    placeholder={t.pfOptionNamePlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <div className="hidden grid-cols-[auto_1.4fr_1fr_1fr_auto] gap-2 px-1 text-xs text-ink-400 sm:grid">
                    <span>{t.pfColImage}</span>
                    <span>{t.pfColValue}</span>
                    <span>{t.cmpPrice}</span>
                    <span>{t.pfColStock}</span>
                    <span></span>
                  </div>
                  {form.variants.map((v, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-2 items-center gap-2 rounded-xl border border-line p-2 sm:grid-cols-[auto_1.4fr_1fr_1fr_auto]"
                    >
                      <label
                        className="relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-line bg-blue-50 text-ink-400 transition-colors hover:border-blue"
                        title={t.pfVariantImageTitle}
                      >
                        {vUploading === i ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : v.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImagePlus className="h-4 w-4" />
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickVariantImage(i, e)} />
                      </label>
                      <input value={v.option_value} onChange={(e) => setVariant(i, "option_value", e.target.value)} className={field} placeholder={t.pfVariantValuePlaceholder} />
                      <input type="number" min="0" value={v.price} onChange={(e) => setVariant(i, "price", e.target.value)} className={field} placeholder={t.cmpPrice} />
                      <input type="number" min="0" value={v.stock} onChange={(e) => setVariant(i, "stock", e.target.value)} className={field} placeholder={t.pfColStock} />
                      <button
                        type="button"
                        onClick={() => removeVariant(i)}
                        aria-label={t.pfVariantRemove}
                        className="grid h-10 w-10 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-coral-50 hover:text-coral"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addVariant} className="btn btn-ghost w-full justify-center">
                    <Plus className="h-4 w-4" /> {t.pfAddVariant}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card space-y-4 p-5">
            <div>
              <label className={label}>{t.pfCategory}</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.category_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>{t.pfBrand}</label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className={field}
                placeholder={t.pfBrandPlaceholder}
              />
            </div>
            <div>
              <label className={label}>{t.pfCondition}</label>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as "New" | "Used" | "Refurbished" })}
                className={field}
              >
                <option value="New">{t.pfCondNew}</option>
                <option value="Used">{t.pfCondUsed}</option>
                <option value="Refurbished">{t.pfCondRefurbished}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {!form.has_variants && (
                <div>
                  <label className={label}>{t.cmpPrice}</label>
                  <input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={field} placeholder="0" />
                </div>
              )}
              <div>
                <label className={label}>{t.pfCompareAt}</label>
                <input type="number" min="0" value={form.compare_at_price} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })} className={field} placeholder="—" />
              </div>
            </div>
            {form.has_variants ? (
              <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-ink-600">
                {t.pfVariantPriceNote}
              </p>
            ) : (
              <div>
                <label className={label}>{t.pfStock}</label>
                <input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={field} placeholder="0" />
                <p className="mt-1 text-xs text-ink-400">{t.pfStockHint}</p>
              </div>
            )}

            {!form.has_variants && (
              <div className="space-y-2 rounded-xl border border-line p-4">
                <div className="text-sm font-medium text-ink">{t.pfTiersTitle}</div>
                <p className="-mt-1 text-xs text-ink-400">{t.pfTiersHint}</p>
                {form.price_tiers.map((tr, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="number"
                      min="2"
                      value={tr.min_qty}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          price_tiers: f.price_tiers.map((r, j) => (j === i ? { ...r, min_qty: e.target.value } : r)),
                        }))
                      }
                      className={field}
                      placeholder={t.pfTierMinQty}
                    />
                    <input
                      type="number"
                      min="0"
                      value={tr.price}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          price_tiers: f.price_tiers.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)),
                        }))
                      }
                      className={field}
                      placeholder={t.pfTierPrice}
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, price_tiers: f.price_tiers.filter((_, j) => j !== i) }))}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-coral-50 hover:text-coral"
                      aria-label={t.pfTierRemove}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, price_tiers: [...f.price_tiers, { min_qty: "", price: "" }] }))}
                  className="btn btn-ghost h-9 px-3 text-sm"
                >
                  <Plus className="h-4 w-4" /> {t.pfTierAdd}
                </button>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
              <input
                type="checkbox"
                checked={form.track_inventory}
                onChange={(e) => setForm({ ...form, track_inventory: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <span className="text-sm text-ink">
                {t.pfTrackInventory}
                <span className="mt-0.5 block text-xs text-ink-400">{t.pfTrackHint}</span>
              </span>
            </label>
          </section>

          <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t.pfSaveProduct}
          </button>
          {!editing && <p className="text-center text-xs text-ink-400">{t.pfReviewNote}</p>}
        </div>
      </form>
    </div>
  );
}

function ProductFormFallback() {
  const { t } = useI18n();
  return (
    <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
    </div>
  );
}

export default function ProductFormPage() {
  return (
    <Suspense fallback={<ProductFormFallback />}>
      <ProductForm />
    </Suspense>
  );
}

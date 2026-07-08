"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Download, FileUp, Loader2, Upload } from "lucide-react";
import { downloadTemplate, importProductsCsv, type ImportResult } from "@/lib/product-import";
import { cn } from "@/lib/utils";

export default function ProductImportPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    setCsvText(await file.text());
  }

  async function run(dryRun: boolean) {
    if (!csvText.trim()) {
      setError("اختر ملف CSV أولًا.");
      return;
    }
    setBusy(dryRun ? "check" : "import");
    setError(null);
    try {
      const res = await importProductsCsv(csvText, dryRun);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر معالجة الملف.");
    } finally {
      setBusy(null);
    }
  }

  const okCount = result?.results.filter((r) => r.status === "ok").length ?? 0;
  const errCount = result?.errors ?? 0;
  // After a clean dry-run (rows found, no errors) the vendor can import.
  const canImport = !!result && result.dry_run && errCount === 0 && okCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-ink">استيراد منتجات من CSV</h1>
          <p className="mt-1 text-sm text-ink-400">أضف منتجات كتير مرة واحدة بدل ما تدخّلها واحد واحد.</p>
        </div>
        <Link href="/vendor/products" className="btn btn-ghost">
          <ArrowRight className="h-4 w-4" /> رجوع للمنتجات
        </Link>
      </div>

      <section className="card space-y-4 p-5">
        <ol className="space-y-2 text-sm text-ink-600">
          <li>١. نزّل القالب واملأه ببياناتك (العمود <span className="font-medium text-ink">title</span> إجباري).</li>
          <li>٢. ارفع الملف واضغط «تحقّق» لمراجعة الصفوف قبل الإضافة.</li>
          <li>٣. لو كله سليم، اضغط «استيراد» — المنتجات هتتضاف بحالة «قيد المراجعة».</li>
        </ol>
        <button type="button" onClick={downloadTemplate} className="btn btn-ghost">
          <Download className="h-4 w-4" /> نزّل قالب CSV
        </button>
      </section>

      <section className="card space-y-4 p-5">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line p-6 text-sm text-ink-400 transition-colors hover:border-blue hover:text-blue-600">
          <FileUp className="h-5 w-5" />
          {fileName ? <span className="text-ink">{fileName}</span> : "اختر ملف CSV"}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onPickFile} />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => run(true)}
            disabled={!csvText || busy !== null}
            className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "check" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            تحقّق
          </button>
          <button
            type="button"
            onClick={() => run(false)}
            disabled={!canImport || busy !== null}
            className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            استيراد
          </button>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-coral">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}
      </section>

      {result && (
        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {result.dry_run ? (
              <span className="font-medium text-ink">
                نتيجة الفحص: {okCount} جاهز · {errCount} خطأ
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-mint">
                <CheckCircle2 className="h-4 w-4" /> تمت إضافة {result.created} منتج · {errCount} خطأ
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-ink-400">
                  <th className="py-2 pe-3 text-start font-normal">#</th>
                  <th className="py-2 pe-3 text-start font-normal">المنتج</th>
                  <th className="py-2 text-start font-normal">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.row} className="border-b border-line last:border-0">
                    <td className="py-2 pe-3 font-tech text-ink-400">{r.row}</td>
                    <td className="py-2 pe-3 text-ink">{r.title || "—"}</td>
                    <td className="py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                          r.status === "error" ? "bg-coral-50 text-coral" : "bg-[#e7f8f1] text-mint",
                        )}
                      >
                        {r.status === "error" ? r.message || "خطأ" : r.status === "created" ? "تمت الإضافة" : "جاهز"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

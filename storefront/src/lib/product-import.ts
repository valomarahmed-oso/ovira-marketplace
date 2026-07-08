import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export type ImportRowResult = {
  row: number;
  title: string;
  status: "ok" | "created" | "error";
  message: string;
};

export type ImportResult = {
  dry_run: boolean;
  created: number;
  errors: number;
  results: ImportRowResult[];
};

/** The columns of the vendor import CSV (only `title` is required). */
export const IMPORT_COLUMNS = [
  "title",
  "price",
  "stock_qty",
  "category",
  "brand",
  "condition",
  "short_description",
  "description",
  "image",
];

/** Build a starter CSV (header + one sample row) and trigger a download. */
export function downloadTemplate() {
  const sample = [
    "قميص قطن رجالي",
    "299",
    "25",
    "ملابس",
    "أوفيرا",
    "New",
    "قميص قطن ١٠٠٪ مريح",
    "خامة قطن عالية الجودة، متوفّر بمقاسات متعددة.",
    "https://demo.ovira.cloud/files/sample.jpg",
  ];
  const csv = "﻿" + IMPORT_COLUMNS.join(",") + "\n" + sample.map(csvCell).join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ovira-products-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Send the raw CSV text to the backend. `dryRun` validates without writing. */
export async function importProductsCsv(csvText: string, dryRun: boolean): Promise<ImportResult> {
  const res = await fetch(`${BASE}/api/method/ovira_marketplace.api.product_import.import_products_csv`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify({ csv_text: csvText, dry_run: dryRun ? 1 : 0 }),
    credentials: "include",
  });
  if (!res.ok) {
    let message = "تعذّر معالجة الملف.";
    try {
      const data = await res.json();
      const raw = data?._server_messages && JSON.parse(data._server_messages)[0];
      if (raw) message = JSON.parse(raw).message ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()).message as ImportResult;
}

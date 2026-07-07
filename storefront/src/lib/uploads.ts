import { getCsrfToken } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Upload an image to Frappe (public /files) and return its absolute URL.
 * Uses the built-in upload_file endpoint with the session cookie + CSRF token;
 * multipart bodies must NOT set Content-Type (the browser adds the boundary).
 */
export async function uploadImage(file: File): Promise<string> {
  if (!BASE) throw new Error("خدمة الرفع غير متاحة حاليًا.");
  if (!file.type.startsWith("image/")) throw new Error("من فضلك اختر ملف صورة.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("حجم الصورة كبير — الحد الأقصى ٥ ميجابايت.");

  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("is_private", "0");
  fd.append("optimize", "1");

  const headers: Record<string, string> = {};
  const csrf = getCsrfToken();
  if (csrf) headers["X-Frappe-CSRF-Token"] = csrf;

  const res = await fetch(`${BASE}/api/method/upload_file`, {
    method: "POST",
    headers,
    body: fd,
    credentials: "include",
  });
  if (!res.ok) throw new Error("تعذّر رفع الصورة، حاول مرة أخرى.");

  const url = (await res.json())?.message?.file_url as string | undefined;
  if (!url) throw new Error("تعذّر رفع الصورة، حاول مرة أخرى.");
  return /^https?:\/\//.test(url) ? url : `${BASE}${url}`;
}

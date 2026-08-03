/**
 * Uploading an image to Frappe.
 *
 * `upload_file` is Frappe's own endpoint, not one of this app's, so it does not
 * go through `http.ts` — that layer speaks JSON, and this is multipart.
 *
 * The body is assembled from a platform-neutral descriptor rather than taking a
 * browser `File`, because React Native has no such thing: a picked photo is a
 * `file://` uri, and its FormData implementation turns `{uri, name, type}` into
 * a real multipart part. The web host passes a `Blob` instead. Both are valid
 * `FormData` values; only the caller knows which it has.
 */

import { getConfig, isConfigured, report } from "./config.js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** A local photo, as each platform can describe one. */
export type UploadFile =
  | { uri: string; name: string; type: string }
  | { blob: Blob; name: string };

export async function uploadImage(file: UploadFile): Promise<string> {
  if (!isConfigured()) throw new Error("خدمة الرفع غير متاحة حاليًا.");
  const base = getConfig().baseUrl.replace(/\/+$/, "");

  const form = new FormData();
  if ("blob" in file) {
    form.append("file", file.blob, file.name);
  } else {
    // React Native's FormData accepts this shape and nothing else; the cast is
    // the documented way to satisfy the DOM typings it borrows.
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }
  form.append("is_private", "0");
  // Frappe re-encodes and strips EXIF. A 12MP phone photo is otherwise shipped
  // to every shopper who opens the product.
  form.append("optimize", "1");

  const auth = (await getConfig().getAuthHeaders?.()) ?? {};
  // Deliberately no Content-Type: the runtime has to set it, because only it
  // knows the multipart boundary. Setting it by hand produces a body the
  // server cannot parse, and the error says nothing about why.
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(auth)) {
    if (key.toLowerCase() !== "content-type") headers[key] = value;
  }

  let res: Response;
  try {
    res = await fetch(`${base}/api/method/upload_file`, {
      method: "POST",
      headers,
      body: form,
      credentials: getConfig().useCookies ? "include" : undefined,
    });
  } catch (err) {
    report("upload_file", err);
    throw new Error("تعذّر رفع الصورة، تأكد من اتصالك بالإنترنت.");
  }

  if (!res.ok) {
    report("upload_file", `HTTP ${res.status}`);
    throw new Error(
      res.status === 403 ? "محتاج تسجّل دخولك عشان ترفع صور." : "تعذّر رفع الصورة، حاول تاني.",
    );
  }

  const url = ((await res.json()) as { message?: { file_url?: string } })?.message?.file_url;
  if (!url) {
    report("upload_file", "no file_url in response");
    throw new Error("تعذّر رفع الصورة، حاول تاني.");
  }
  return /^https?:\/\//.test(url) ? url : `${base}${url}`;
}

import { writeHeaders } from "@/lib/frappe-client";
import type { Review, ReviewList } from "@/lib/reviews-api";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.vendor_reviews";

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    const raw = data?._server_messages && JSON.parse(data._server_messages)[0];
    if (raw) return JSON.parse(raw).message ?? fallback;
    if (data?.exception) return String(data.exception).replace(/^[^:]+:\s*/, "");
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function getVendorReviews(vendor: string): Promise<ReviewList> {
  const empty: ReviewList = { reviews: [], avg: 0, count: 0 };
  if (!BASE) return empty;
  try {
    const res = await fetch(
      `${BASE}/api/method/${M}.list_vendor_reviews?vendor=${encodeURIComponent(vendor)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return empty;
    return ((await res.json()).message ?? empty) as ReviewList;
  } catch {
    return empty;
  }
}

export async function addVendorReview(input: {
  vendor: string;
  rating: number;
  body: string;
  author?: string;
}): Promise<Review> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${M}.add_vendor_review`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(input),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر إرسال التقييم، حاول مرة أخرى."));
  return (await res.json()).message as Review;
}

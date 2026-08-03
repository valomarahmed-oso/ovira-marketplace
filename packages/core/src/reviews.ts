/**
 * What other shoppers said — about a product, about a seller — and what they
 * asked.
 *
 * Reading is public; writing needs a session. The server also decides what
 * `verified` means (it checks for a delivered order containing the item) and
 * rate-limits writes, so neither is the client's to assert.
 */

import { get, post } from "./http.js";

export type Review = {
  id: string;
  author: string;
  rating: number;
  body: string;
  /** The server confirmed this person actually bought it. Not client-settable. */
  verified: boolean;
  date: string;
};

export type ReviewSummary = { reviews: Review[]; avg: number; count: number };

const EMPTY: ReviewSummary = { reviews: [], avg: 0, count: 0 };

const REVIEWS = "ovira_marketplace.api.reviews";
const VENDOR_REVIEWS = "ovira_marketplace.api.vendor_reviews";
const QA = "ovira_marketplace.api.qa";

/** Takes a slug or a docname — the server resolves either. */
export async function listReviews(product: string, limit = 50): Promise<ReviewSummary> {
  return (await get<ReviewSummary>(`${REVIEWS}.list_reviews`, { product, limit })) ?? EMPTY;
}

/**
 * Add or **replace** this buyer's review. One review per person per product is
 * the server's rule, so a second submission edits the first rather than
 * stacking — which is why the UI can offer "edit" without a separate endpoint.
 */
export function addReview(product: string, rating: number, body: string): Promise<Review> {
  return post(`${REVIEWS}.add_review`, { product, rating, body }, "تعذّر إرسال التقييم.");
}

export async function listVendorReviews(vendor: string, limit = 50): Promise<ReviewSummary> {
  return (
    (await get<ReviewSummary>(`${VENDOR_REVIEWS}.list_vendor_reviews`, { vendor, limit })) ?? EMPTY
  );
}

export function addVendorReview(vendor: string, rating: number, body: string): Promise<Review> {
  return post(
    `${VENDOR_REVIEWS}.add_vendor_review`,
    { vendor, rating, body },
    "تعذّر إرسال تقييم المتجر.",
  );
}

export type Question = {
  id: string;
  author: string;
  body: string;
  /** Null until the seller or the operator replies. */
  answer?: string | null;
  answered_by?: string | null;
  date: string;
};

export async function listQuestions(product: string, limit = 50): Promise<Question[]> {
  return (await get<Question[]>(`${QA}.list_questions`, { product, limit })) ?? [];
}

export function askQuestion(product: string, body: string): Promise<Question> {
  return post(`${QA}.ask_question`, { product, body }, "تعذّر إرسال السؤال.");
}

/** Seller (or operator) answering. Scoped server-side to their own products. */
export function answerQuestion(name: string, answer: string): Promise<Question> {
  return post(`${QA}.answer_question`, { name, answer }, "تعذّر إرسال الإجابة.");
}

import { writeHeaders } from "@/lib/frappe-client";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";
const M = "ovira_marketplace.api.qa";

export type Question = {
  id: string;
  author: string;
  body: string;
  answer?: string | null;
  answered_by?: string | null;
  date: string;
};

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

async function post<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE) throw new Error("الخدمة غير متاحة حاليًا.");
  const res = await fetch(`${BASE}/api/method/${M}.${method}`, {
    method: "POST",
    headers: writeHeaders(),
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "تعذّر تنفيذ العملية، حاول مرة أخرى."));
  return (await res.json()).message as T;
}

export async function getQuestions(product: string): Promise<Question[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(
      `${BASE}/api/method/${M}.list_questions?product=${encodeURIComponent(product)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return [];
    return ((await res.json()).message ?? []) as Question[];
  } catch {
    return [];
  }
}

export const askQuestion = (product: string, body: string, author?: string) =>
  post<Question>("ask_question", { product, body, author });

export const answerQuestion = (name: string, answer: string) =>
  post<Question>("answer_question", { name, answer });

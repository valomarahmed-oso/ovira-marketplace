import type { ReturnStatus } from "@ovira/core";

import { Pill } from "./ui";

/**
 * Where a return request has got to, in the shopper's words.
 *
 * Mapped here rather than in the dictionary for the same reason order statuses
 * are: this is a translation of a *state machine* the backend owns, and an
 * unmapped status must fall through as its raw value — a state someone adds
 * later should look unfamiliar, not invisible.
 */
const LABELS: Record<ReturnStatus, string> = {
  Requested: "قيد المراجعة",
  Approved: "مقبول",
  Rejected: "مرفوض",
  Completed: "تم الاسترداد",
};

const TONES: Record<ReturnStatus, "blue" | "mint" | "coral"> = {
  Requested: "blue",
  Approved: "blue",
  Rejected: "coral",
  Completed: "mint",
};

/** The reasons as the doctype stores them, said in Arabic. */
const REASONS: Record<string, string> = {
  Damaged: "المنتج تالف",
  "Wrong item": "منتج خاطئ",
  "Not as described": "مختلف عن الوصف",
  "Changed mind": "غيّرت رأيي",
  Other: "سبب آخر",
};

export function returnStatusLabel(status: string): string {
  return LABELS[status as ReturnStatus] ?? status;
}

export function returnReasonLabel(reason?: string): string {
  if (!reason) return "";
  return REASONS[reason] ?? reason;
}

export function ReturnStatusPill({ status }: { status: string }) {
  return (
    <Pill label={returnStatusLabel(status)} tone={TONES[status as ReturnStatus] ?? "blue"} />
  );
}

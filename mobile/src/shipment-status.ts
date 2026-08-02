/**
 * Shipment states in Arabic.
 *
 * Same rule as the order, return and ticket maps: the backend owns these
 * values, they are stored in English, and anything unmapped falls through as
 * its raw value so a state added later looks unfamiliar rather than invisible.
 *
 * A plain `.ts` module — no JSX — so the label is reachable from string
 * builders (a printed waybill) as well as from components.
 */

const LABELS: Record<string, string> = {
  Draft: "مسودة",
  Created: "تم الإنشاء",
  "Picked Up": "تم الاستلام",
  "In Transit": "في الطريق",
  Delivered: "تم التسليم",
  Returned: "مُرتجَع",
  Cancelled: "ملغى",
};

const TONES: Record<string, "blue" | "mint" | "coral"> = {
  Draft: "blue",
  Created: "blue",
  "Picked Up": "blue",
  "In Transit": "blue",
  Delivered: "mint",
  Returned: "coral",
  Cancelled: "coral",
};

export function shipmentStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function shipmentStatusTone(status: string): "blue" | "mint" | "coral" {
  return TONES[status] ?? "blue";
}

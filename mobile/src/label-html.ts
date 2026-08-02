import type { ShipmentLabel } from "@ovira/core";

import { dict, money, num } from "./i18n";
import { shipmentStatusLabel } from "./shipment-status";

/**
 * The waybill as a printable page.
 *
 * Sized for a 10×15 cm thermal label, which is what couriers here actually
 * feed, and laid out so the two things that decide what happens to the parcel —
 * the recipient's address and whether cash is collected — are readable at
 * arm's length on a shelf.
 */

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function labelHtml(label: ShipmentLabel): string {
  const t = dict();

  const items = label.items
    .map(
      (item) =>
        `<tr><td>${esc(item.title)}</td><td class="n">×${esc(num(item.qty))}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<style>
  @page { size: 100mm 150mm; margin: 4mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Noto Naskh Arabic", sans-serif;
    color: #000; font-size: 11px; line-height: 1.55; margin: 0;
  }
  .frame { border: 2px solid #000; padding: 6px; }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 2px solid #000; padding-bottom: 5px; }
  .id { font-size: 15px; font-weight: 800; }
  .n { direction: ltr; unicode-bidi: isolate; text-align: left; white-space: nowrap; }
  /* Loud on purpose: a courier who misses this hands the parcel over for
     nothing, and the seller is the one out of pocket. */
  .cod { border: 2px solid #000; text-align: center; padding: 6px; margin: 6px 0; }
  .cod .amt { font-size: 22px; font-weight: 800; }
  section { border-bottom: 1px dashed #000; padding: 5px 0; }
  h2 { font-size: 9px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: .4px; }
  .big { font-size: 14px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 3px; }
  td { padding: 2px 0; vertical-align: top; }
  footer { text-align: center; font-size: 9px; padding-top: 5px; }
</style>
</head>
<body>
  <div class="frame">
    <header>
      <div>
        <div class="id n">${esc(label.shipment)}</div>
        <div>${esc(label.carrier || label.provider || "")}</div>
      </div>
      <div style="text-align:left">
        <div>${esc(shipmentStatusLabel(label.status))}</div>
        ${label.tracking_number ? `<div class="n">${esc(label.tracking_number)}</div>` : ""}
      </div>
    </header>

    ${
      label.cod
        ? `<div class="cod">
             <div>${esc(t.vlCod)}</div>
             <div class="amt n">${esc(money(label.cod_amount))}</div>
           </div>`
        : ""
    }

    <section>
      <h2>${esc(t.vlTo)}</h2>
      <div class="big">${esc(label.recipient_name || "—")}</div>
      ${label.recipient_phone ? `<div class="n big">${esc(label.recipient_phone)}</div>` : ""}
      <div>${esc(label.address || "—")}${
        label.governorate ? `، ${esc(label.governorate)}` : ""
      }</div>
    </section>

    <section>
      <h2>${esc(t.vlFrom)}</h2>
      <div>${esc(label.vendor_name || "—")}</div>
      ${label.vendor_phone ? `<div class="n">${esc(label.vendor_phone)}</div>` : ""}
    </section>

    <section>
      <h2>${esc(t.vlContents)}</h2>
      <table>${items}</table>
    </section>

    <footer>${esc(label.order || "")}</footer>
  </div>
</body>
</html>`;
}

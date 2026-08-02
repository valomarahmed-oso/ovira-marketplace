import type { Order } from "@ovira/core";

import { statusLabel } from "./components/order-status";
import { dict, formatDate, money, num } from "./i18n";

/**
 * The invoice as a printable page.
 *
 * A second rendering of the same order, and deliberately so: `expo-print` takes
 * HTML, and React Native views cannot be handed to it. The numbers all come
 * from the order itself, so the two renderings cannot disagree about money —
 * only about layout, which is the point, because A4 is not a phone.
 */

/** Anything from the order can contain `<`; a title with one must not eat the page. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function invoiceHtml(order: Order): string {
  const t = dict();
  const voided = order.return_status === "Completed";

  const rows = (order.items ?? [])
    .map(
      (item) => `
        <tr>
          <td>${esc(item.title)}</td>
          <td class="c">${esc(num(item.qty))}</td>
          <td class="n">${esc(money(item.rate))}</td>
          <td class="n">${esc(money(item.amount))}</td>
        </tr>`,
    )
    .join("");

  const line = (label: string, value: string) =>
    `<div class="row"><span>${esc(label)}</span><span class="n">${esc(value)}</span></div>`;

  const totals = [
    line(t.subtotal, money(order.subtotal)),
    line(t.shipping, order.shipping_amount === 0 ? t.free : money(order.shipping_amount)),
    order.discount_amount && order.discount_amount > 0
      ? line(
          `${t.discountLabel}${order.coupon_code ? ` (${order.coupon_code})` : ""}`,
          `−${money(order.discount_amount)}`,
        )
      : "",
    // The tax base is stated separately when tax is inclusive, because an
    // Egyptian invoice has to show what was taxed as well as the tax.
    order.tax_amount && order.tax_amount > 0 && order.tax_inclusive
      ? line(t.invoiceNet, money(order.net_total ?? 0))
      : "",
    order.tax_amount && order.tax_amount > 0
      ? line(`${t.tax} ${order.tax_rate ?? ""}%`, money(order.tax_amount))
      : "",
  ].join("");

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Noto Naskh Arabic", sans-serif;
    color: #0b1f38;
    font-size: 12px;
    line-height: 1.7;
    margin: 0;
  }
  .void {
    border: 1px solid #ff5630; background: #ffede8; color: #ff5630;
    text-align: center; font-weight: 700; padding: 10px; border-radius: 8px;
    margin-bottom: 18px;
  }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 1px solid #dbe6f5; padding-bottom: 14px; }
  .brand { font-size: 18px; font-weight: 700; }
  .muted { color: #6b7a90; font-size: 11px; }
  .meta { text-align: left; }
  section { margin-top: 18px; }
  h2 { font-size: 11px; color: #6b7a90; font-weight: 600; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: right; font-size: 11px; color: #6b7a90; font-weight: 600;
       border-bottom: 1px solid #dbe6f5; padding: 6px 0; }
  td { padding: 7px 0; border-bottom: 1px solid #eef4fc; vertical-align: top; }
  .c { text-align: center; }
  /* Figures read left-to-right even on a right-to-left page. */
  .n { text-align: left; direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
  th.n { text-align: left; }
  .totals { margin: 14px 0 0 auto; width: 58%; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; }
  .grand { border-top: 1px solid #dbe6f5; margin-top: 6px; padding-top: 8px;
           font-size: 14px; font-weight: 700; }
  footer { margin-top: 26px; text-align: center; color: #6b7a90; font-size: 11px;
           border-top: 1px solid #dbe6f5; padding-top: 12px; }
</style>
</head>
<body>
  ${voided ? `<div class="void">${esc(t.invoiceVoid)}</div>` : ""}

  <header>
    <div>
      <div class="brand">${esc(t.brand)}</div>
      <div class="muted">demo.ovira.cloud</div>
    </div>
    <div class="meta">
      <div style="font-weight:600">${esc(t.invoice)}</div>
      <div class="muted n">${esc(order.name)}</div>
      <div class="muted">${esc(formatDate(order.creation))}</div>
    </div>
  </header>

  <section>
    <h2>${esc(t.invoiceBillTo)}</h2>
    <div>${esc(order.customer_name || "—")}</div>
    ${
      order.shipping_address
        ? `<div class="muted">${esc(order.shipping_address)}${
            order.governorate ? `، ${esc(order.governorate)}` : ""
          }</div>`
        : ""
    }
  </section>

  <section>
    <h2>${esc(t.invoiceDetails)}</h2>
    <div class="row"><span>${esc(t.orderStatus)}</span><span>${esc(statusLabel(order.status))}</span></div>
    <div class="row"><span>${esc(t.paymentStatus)}</span><span>${esc(order.payment_status || "—")}</span></div>
  </section>

  <section>
    <table>
      <thead>
        <tr>
          <th>${esc(t.invoiceColProduct)}</th>
          <th class="c">${esc(t.qty)}</th>
          <th class="n">${esc(t.invoiceColUnit)}</th>
          <th class="n">${esc(t.total)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      ${totals}
      <div class="row grand"><span>${esc(t.total)}</span><span class="n">${esc(money(order.total))}</span></div>
    </div>
  </section>

  <footer>${esc(t.invoiceThanks.replace("{brand}", t.brand))}</footer>
</body>
</html>`;
}

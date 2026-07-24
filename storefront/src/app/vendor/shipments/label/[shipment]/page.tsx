"use client";

import { use, useEffect, useState } from "react";
import { Loader2, Printer, Truck } from "lucide-react";
import { getShipmentLabel, shipmentStatusLabel, type ShipmentLabel } from "@/lib/shipments-api";
import { useI18n } from "@/components/i18n-provider";
import { formatPrice } from "@/lib/utils";

export default function ShipmentLabelPage({
  params,
}: {
  params: Promise<{ shipment: string }>;
}) {
  const { shipment } = use(params);
  const { t } = useI18n();
  const [data, setData] = useState<ShipmentLabel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShipmentLabel(decodeURIComponent(shipment))
      .then(setData)
      .finally(() => setLoading(false));
  }, [shipment]);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white text-ink">
      {/* Print rules: hide the toolbar, tighten margins to the label only. */}
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>

      {loading ? (
        <div className="flex h-full items-center justify-center text-ink-400">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : !data ? (
        <div className="flex h-full items-center justify-center text-ink-400">{t.lblNotFound}</div>
      ) : (
        <div className="mx-auto max-w-[720px] p-6">
          <div className="no-print mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              <Printer className="h-4 w-4" /> {t.lblPrint}
            </button>
          </div>

          <div className="rounded-2xl border-2 border-ink/80 p-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-ink/80 pb-3">
              <div className="flex items-center gap-2 text-xl font-bold">
                <Truck className="h-6 w-6" /> {t.lblTitle}
              </div>
              <div className="text-end">
                <div className="font-tech text-sm">{data.order}</div>
                <div className="text-xs text-ink-400">{shipmentStatusLabel(t, data.status)}</div>
              </div>
            </div>

            {/* Carrier + tracking */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 text-sm">
              <div>
                <span className="text-ink-400">{t.vshCarrier}: </span>
                <span className="font-medium">{data.carrier || data.provider || "—"}</span>
              </div>
              {data.tracking_number && (
                <div dir="ltr">
                  <span className="text-ink-400">{t.vshTrackingNo}: </span>
                  <span className="font-tech font-medium">{data.tracking_number}</span>
                </div>
              )}
            </div>

            {/* From / To */}
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[#faf9f5] p-4">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-400">
                  {t.lblFrom}
                </div>
                <div className="font-medium">{data.vendor_name || "—"}</div>
                {data.vendor_phone && <div dir="ltr" className="text-sm text-ink-600">{data.vendor_phone}</div>}
              </div>
              <div className="rounded-xl border border-ink/30 p-4">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-400">
                  {t.lblTo}
                </div>
                <div className="font-medium">{data.recipient_name || "—"}</div>
                {data.recipient_phone && <div dir="ltr" className="text-sm text-ink-600">{data.recipient_phone}</div>}
                <div className="mt-1 text-sm text-ink-600">
                  {[data.address, data.governorate].filter(Boolean).join(" — ")}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="border-t border-line pt-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                {t.lblItems}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {data.items.map((it, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="py-1.5">{it.title}</td>
                      <td className="py-1.5 text-end text-ink-400">×{it.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payment / COD */}
            <div className="mt-4 rounded-xl border-2 p-4 text-center">
              {data.cod ? (
                <>
                  <div className="text-sm font-medium">{t.lblCod}</div>
                  <div className="mt-1 text-2xl font-bold">
                    {formatPrice(data.cod_amount, data.currency)}
                  </div>
                  <div className="text-xs text-ink-400">{t.lblCodAmount}</div>
                </>
              ) : (
                <div className="text-sm font-medium text-mint">{t.lblPrepaid}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

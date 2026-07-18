"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MessageThreadList, type ThreadItem } from "@/components/message-thread-list";
import { getVendorThreads } from "@/lib/messaging-api";
import { getMyStore } from "@/lib/vendor";
import { useI18n } from "@/components/i18n-provider";

export default function VendorMessagesPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyStore(), getVendorThreads()])
      .then(([store, rows]) => {
        const vendor = store?.name ?? "";
        setItems(
          rows.map((r) => ({
            key: `${r.order}:${vendor}`,
            order: r.order,
            vendor,
            title: r.customer_name || t.messagesBuyer,
            snippet: r.last_body,
            date: r.last_date,
            unread: r.unread,
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [t.messagesBuyer]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-medium text-ink">{t.messagesTitle}</h1>
      {loading ? (
        <div className="card flex items-center justify-center gap-2 p-10 text-ink-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> {t.loading}
        </div>
      ) : (
        <MessageThreadList items={items} emptyText={t.messagesEmpty} />
      )}
    </div>
  );
}

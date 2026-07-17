"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MessageThreadList, type ThreadItem } from "@/components/message-thread-list";
import { getBuyerThreads } from "@/lib/messaging-api";
import { useI18n } from "@/components/i18n-provider";

export default function BuyerMessagesPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBuyerThreads()
      .then((rows) =>
        setItems(
          rows.map((r) => ({
            key: `${r.order}:${r.vendor}`,
            order: r.order,
            vendor: r.vendor,
            title: r.vendor_name,
            snippet: r.last_body,
            date: r.last_date,
            unread: r.unread,
          })),
        ),
      )
      .finally(() => setLoading(false));
  }, []);

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

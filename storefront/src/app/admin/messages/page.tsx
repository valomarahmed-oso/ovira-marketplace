"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MessageThreadList, type ThreadItem } from "@/components/message-thread-list";
import { getAllThreads } from "@/lib/messaging-api";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";

export default function AdminMessagesPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [items, setItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !isOperator) return;
    getAllThreads()
      .then((rows) =>
        setItems(
          rows.map((r) => ({
            key: `${r.order}:${r.vendor}`,
            order: r.order,
            vendor: r.vendor,
            title: r.vendor_name,
            subtitle: `${t.messagesBuyer}: ${r.customer_name || "—"} · ${r.messages} ${t.messagesCount}`,
            snippet: r.last_body,
            date: r.last_date,
          })),
        ),
      )
      .finally(() => setLoading(false));
  }, [ready, isOperator, t.messagesBuyer, t.messagesCount]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.messagesModerationTitle}</h2>
        <p className="text-sm text-ink-400">{t.messagesModerationSub}</p>
      </div>
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

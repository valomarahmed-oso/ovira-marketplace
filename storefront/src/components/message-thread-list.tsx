"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { OrderChat } from "@/components/order-chat";
import { cn } from "@/lib/utils";

export type ThreadItem = {
  /** Stable key + the (order, vendor) pair the chat is scoped to. */
  key: string;
  order: string;
  vendor: string;
  title: string;
  subtitle?: string;
  snippet: string;
  date: string;
  unread?: number;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(iso));
}

/** A list of conversation summaries; clicking one expands the full thread inline.
 *  Shared by the buyer, vendor and operator inboxes. */
export function MessageThreadList({ items, emptyText }: { items: ThreadItem[]; emptyText: string }) {
  const [open, setOpen] = useState<string | null>(null);

  if (!items.length) {
    return (
      <div className="card flex flex-col items-center gap-2 p-12 text-center text-ink-400">
        <MessageCircle className="h-8 w-8" />
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="card divide-y divide-line overflow-hidden">
      {items.map((it) => {
        const expanded = open === it.key;
        return (
          <div key={it.key}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : it.key)}
              className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-[#faf9f5]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{it.title}</span>
                  <span className="font-tech text-xs text-ink-400">{it.order}</span>
                  {!!it.unread && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1.5 text-[10px] font-medium text-white">
                      {it.unread}
                    </span>
                  )}
                </div>
                {it.subtitle && <div className="text-xs text-ink-400">{it.subtitle}</div>}
                <div className="mt-0.5 line-clamp-1 text-sm text-ink-600">{it.snippet}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-ink-400">
                <span className="text-xs">{formatDate(it.date)}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
              </div>
            </button>
            {expanded && (
              <div className="border-t border-line bg-[#faf9f5] p-4">
                <OrderChat order={it.order} vendor={it.vendor} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

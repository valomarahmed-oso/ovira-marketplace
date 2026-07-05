"use client";

import { BadgeCheck, ShieldCheck, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { Dict } from "@/lib/i18n";

type TierMeta = { key: keyof Dict; icon: LucideIcon; cls: string };

const TIERS: Record<string, TierMeta> = {
  top: { key: "trustTop", icon: ShieldCheck, cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  trusted: { key: "trustTrusted", icon: BadgeCheck, cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  rising: { key: "trustRising", icon: TrendingUp, cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  new: { key: "trustNew", icon: Sparkles, cls: "bg-ink-50 text-ink-500 ring-line" },
};

/** Compact vendor trust chip. Returns null for unknown/empty tiers so callers can
 *  drop it in unconditionally. Pass `showScore` to append the numeric score. */
export function TrustBadge({
  tier,
  score,
  showScore = false,
  className = "",
}: {
  tier?: string | null;
  score?: number | null;
  showScore?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  if (!tier) return null;
  const meta = TIERS[tier];
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${meta.cls} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {t[meta.key]}
      {showScore && typeof score === "number" && score > 0 && (
        <span className="tabular-nums opacity-80">· {score.toFixed(1)}</span>
      )}
    </span>
  );
}

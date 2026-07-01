"use client";

import Link from "next/link";
import { Loader2, LogIn } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { DASHBOARDS } from "@/lib/dashboards";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);

  if (!ready) {
    return (
      <div className="container-ovira flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <LogIn className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">{t.signInPrompt}</h1>
          <p className="text-sm text-ink-400">{t.signInPromptSub}</p>
          <div className="flex justify-center gap-2">
            <Link href="/login?next=%2Faccount" className="btn btn-primary">{t.loginTitle}</Link>
            <Link href="/register" className="btn btn-ghost">{t.createAccount}</Link>
          </div>
        </div>
      </div>
    );
  }

  return <DashboardShell def={DASHBOARDS.buyer}>{children}</DashboardShell>;
}

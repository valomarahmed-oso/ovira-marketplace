"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { DASHBOARDS } from "@/lib/dashboards";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);

  if (!ready) {
    return (
      <div className="container-ovira flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || (!user.isOperator && !user.isContentEditor)) {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Lock className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">{t.adminAccessDenied}</h1>
          {!user && (
            <Link
              href={`/login?next=${encodeURIComponent(pathname || "/admin")}`}
              className="btn btn-primary inline-flex"
            >
              {t.loginTitle}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return <DashboardShell def={DASHBOARDS.operator}>{children}</DashboardShell>;
}

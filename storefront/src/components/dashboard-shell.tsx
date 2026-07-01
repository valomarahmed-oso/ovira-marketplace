"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useAuth } from "@/lib/auth-store";
import { dashboardsFor, type DashboardDef, type DashNavItem } from "@/lib/dashboards";
import { cn } from "@/lib/utils";

/**
 * One shell for all three role dashboards (owner / vendor / buyer). Guards live
 * in each route's layout; by the time we render here the user is authorized for
 * `def`. The sidebar also surfaces a switcher to the *other* dashboards this
 * account may enter, so a multi-role user hops between them from the portal.
 */
export function DashboardShell({
  def,
  children,
}: {
  def: DashboardDef;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const user = useAuth((s) => s.user);

  const isActive = (item: DashNavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // The dashboards this account can switch to, minus the one we're in.
  const others = dashboardsFor(user).filter((d) => d.role !== def.role);
  const Icon = def.icon;

  return (
    <div className="container-ovira py-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50">
          <Icon className="h-6 w-6 text-blue-600" />
        </span>
        <div>
          <h1 className="text-2xl font-medium text-ink">{t[def.titleKey]}</h1>
          <p className="text-sm text-ink-400">{t[def.subtitleKey]}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4">
          <nav className="card space-y-1 p-2">
            {def.nav.map((item) => {
              const active = isActive(item);
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active ? "bg-blue text-white" : "text-ink-600 hover:bg-blue-50",
                  )}
                >
                  <ItemIcon className="h-4 w-4" />
                  {t[item.key]}
                </Link>
              );
            })}
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-600 transition-colors hover:bg-blue-50"
            >
              <ExternalLink className="h-4 w-4" />
              {t.viewStore}
            </Link>
          </nav>

          {others.length > 0 && (
            <div className="card space-y-1 p-2">
              <div className="px-3 py-2 text-xs font-medium text-ink-400">{t.switchDashboard}</div>
              {others.map((d) => {
                const DIcon = d.icon;
                return (
                  <Link
                    key={d.role}
                    href={d.home}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-600 transition-colors hover:bg-blue-50"
                  >
                    <DIcon className="h-4 w-4" />
                    {t[d.titleKey]}
                  </Link>
                );
              })}
            </div>
          )}
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

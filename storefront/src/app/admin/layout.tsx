"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Loader2, Lock, Package, Settings, ShieldCheck, Store } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import type { Dict } from "@/lib/i18n";

type NavItem = { href: string; key: keyof Dict; icon: typeof Settings; exact?: boolean };

// Grows one entry per operator module as each ships (vendors → products →
// orders → cms → categories → payouts → reports).
const NAV: NavItem[] = [
  { href: "/admin", key: "adminNavSettings", icon: Settings, exact: true },
  { href: "/admin/vendors", key: "adminNavVendors", icon: Store },
  { href: "/admin/products", key: "adminNavProducts", icon: Package },
  { href: "/admin/orders", key: "adminNavOrders", icon: ClipboardList },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  if (!ready) {
    return (
      <div className="container-ovira flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || !isOperator) {
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

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="container-ovira py-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
        </span>
        <div>
          <h1 className="text-2xl font-medium text-ink">{t.storeAdmin}</h1>
          <p className="text-sm text-ink-400">{t.storeAdminSub}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside>
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-blue text-white"
                      : "text-ink-600 hover:bg-blue-50"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {t[item.key]}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LayoutDashboard, Package, Settings, ShoppingBag } from "lucide-react";
import { OviraBars } from "@/components/ovira-bars";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/vendor", icon: LayoutDashboard, label: "نظرة عامة", exact: true },
  { href: "/vendor/products", icon: Package, label: "المنتجات" },
  { href: "/vendor/orders", icon: ShoppingBag, label: "الطلبات" },
  { href: "/vendor/settings", icon: Settings, label: "الإعدادات" },
];

export function VendorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="space-y-4">
      <div className="card flex items-center gap-2 p-4">
        <OviraBars />
        <div>
          <div className="text-sm font-medium text-ink">لوحة البائع</div>
          <div className="text-xs text-ink-400">إدارة متجرك</div>
        </div>
      </div>

      <nav className="card space-y-1 p-2">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-blue text-white" : "text-ink-600 hover:bg-blue-50",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-600 transition-colors hover:bg-blue-50"
        >
          <ExternalLink className="h-4 w-4" />
          عرض المتجر
        </Link>
      </nav>
    </aside>
  );
}

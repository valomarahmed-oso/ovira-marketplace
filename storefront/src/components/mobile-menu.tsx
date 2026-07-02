"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Bell,
  Grid2x2,
  Heart,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { PrefsToggle } from "@/components/prefs-toggle";
import { useAuth } from "@/lib/auth-store";
import { signOutServer } from "@/lib/auth";
import { useI18n } from "@/components/i18n-provider";
import { useAppConfig } from "@/components/app-config-provider";

function Item({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-blue-50"
    >
      <Icon className="h-5 w-5 text-blue-600" />
      {label}
    </Link>
  );
}

/** The hamburger drawer: slides in from the inline-start edge (RTL-aware). */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { multiVendor } = useAppConfig();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  // Close when the route changes (a link was tapped).
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock page scroll while open; close on Escape.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const section = "px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-ink-400";

  return (
    <div className={`fixed inset-0 z-[60] lg:hidden ${open ? "" : "pointer-events-none"}`}>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      {/* Panel */}
      <aside
        className={`absolute top-0 h-full w-80 max-w-[85vw] overflow-y-auto bg-surface shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full"
        }`}
        style={{ insetInlineStart: 0 }}
        dir="inherit"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <Logo />
          <button
            type="button"
            aria-label={t.menu}
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="p-3">
          <div className={section}>{t.menuBrowse}</div>
          <Item href="/" icon={Home} label={t.brand} />
          <Item href="/categories" icon={Grid2x2} label={t.allCategories} />
          <Item href="/products" icon={Package} label={t.menuAllProducts} />
          <Item href="/products?sort=price_asc" icon={Tag} label={t.deals} />

          <div className={section}>{t.menuMyPages}</div>
          <Item href="/account" icon={LayoutDashboard} label={t.account} />
          <Item href="/account/orders" icon={ShoppingBag} label={t.myOrders} />
          <Item href="/wishlist" icon={Heart} label={t.wishlist} />
          <Item href="/account/notifications" icon={Bell} label={t.notifications} />

          {(user?.isVendor || user?.isOperator || multiVendor) && (
            <>
              <div className={section}>{t.footVendors}</div>
              {user?.isVendor && <Item href="/vendor" icon={Store} label={t.vendorDashboard} />}
              {user?.isOperator && <Item href="/admin" icon={ShieldCheck} label={t.storeAdmin} />}
              {multiVendor && !user?.isVendor && (
                <Item href="/sell" icon={Store} label={t.becomeVendor} />
              )}
            </>
          )}
        </nav>

        <div className="mt-2 space-y-3 border-t border-line p-4">
          <PrefsToggle />
          {user ? (
            <button
              type="button"
              onClick={() => {
                signOut();
                void signOutServer();
                onClose();
                router.push("/");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-coral hover:bg-coral-50"
            >
              <LogOut className="h-5 w-5" />
              {t.logout}
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50"
            >
              <LogIn className="h-5 w-5" />
              {t.loginTitle}
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}

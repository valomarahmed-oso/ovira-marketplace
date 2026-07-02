"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Heart, MapPin, Menu, Search, ShoppingCart, User } from "lucide-react";
import { Logo } from "@/components/logo";
import { MobileMenu } from "@/components/mobile-menu";
import { PrefsToggle } from "@/components/prefs-toggle";
import { cartCount, useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth-store";
import { useWishlist } from "@/lib/wishlist-store";
import { getUnreadCount } from "@/lib/notifications-api";
import { useHydrated } from "@/lib/use-hydrated";
import { useI18n } from "@/components/i18n-provider";
import { useAppConfig } from "@/components/app-config-provider";

export function Header() {
  const router = useRouter();
  const { t } = useI18n();
  const { multiVendor } = useAppConfig();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const items = useCart((s) => s.items);
  const user = useAuth((s) => s.user);
  const wishItems = useWishlist((s) => s.items);
  const hydrated = useHydrated();
  const [unread, setUnread] = useState(0);
  const count = hydrated ? cartCount(items) : 0;
  const wishCount = hydrated ? wishItems.length : 0;

  // Unread notification badge comes from the backend, once we know who's signed in.
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    getUnreadCount().then(setUnread);
  }, [user]);
  const accountLabel = hydrated && user ? user.name.split(" ")[0] : t.account;

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur">
      <div className="border-b border-line bg-blue-50/60">
        <div className="container-ovira flex h-9 items-center justify-between text-xs text-ink-600">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-blue-600" />
            {t.deliverTo} <strong className="font-medium text-ink">{t.egypt}</strong>
          </span>
          <div className="flex items-center gap-3">
            {multiVendor && (
              <Link href="/sell" className="hidden items-center gap-1 hover:text-blue-600 sm:flex">
                {t.becomeVendor}
              </Link>
            )}
            <PrefsToggle />
          </div>
        </div>
      </div>

      <div className="container-ovira flex h-16 items-center gap-3 md:gap-6">
        <button
          type="button"
          aria-label={t.menu}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-line lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

        <Logo />

        <form onSubmit={onSearch} className="relative hidden flex-1 md:block">
          <Search className="pointer-events-none absolute end-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className="h-11 w-full rounded-xl border border-line bg-canvas pe-12 ps-4 text-sm text-ink outline-none transition-colors focus:border-blue focus:bg-surface"
          />
        </form>

        <nav className="flex items-center gap-1 md:gap-2">
          <Link href="/account" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-blue-50">
            <User className="h-5 w-5 text-blue-600" />
            <span className="hidden lg:inline">{accountLabel}</span>
          </Link>
          <Link href="/account/notifications" aria-label={t.notifications} className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-blue-50">
            <Bell className="h-5 w-5 text-blue-600" />
            {unread > 0 && (
              <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-tech text-[10px] text-white">
                {unread}
              </span>
            )}
          </Link>
          <Link href="/wishlist" aria-label={t.wishlist} className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-blue-50">
            <Heart className="h-5 w-5 text-blue-600" />
            {wishCount > 0 && (
              <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-tech text-[10px] text-white">
                {wishCount}
              </span>
            )}
          </Link>
          <Link href="/cart" className="relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-blue-50">
            <span className="relative">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              {count > 0 && (
                <span className="absolute -end-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 font-tech text-[10px] text-white">
                  {count}
                </span>
              )}
            </span>
            <span className="hidden lg:inline">{t.cart}</span>
          </Link>
        </nav>
      </div>

      <form onSubmit={onSearch} className="container-ovira relative pb-3 md:hidden">
        <Search className="pointer-events-none absolute end-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className="h-11 w-full rounded-xl border border-line bg-canvas pe-12 ps-4 text-sm outline-none focus:border-blue focus:bg-surface"
        />
      </form>
    </header>
  );
}

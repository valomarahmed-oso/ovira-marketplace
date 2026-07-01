"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Heart, LogOut, MapPin, Package } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { signOutServer } from "@/lib/auth";
import { useI18n } from "@/components/i18n-provider";

export default function AccountPage() {
  const router = useRouter();
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  // The layout guards auth; render nothing on the brief render before redirect.
  if (!user) return null;

  const links = [
    { href: "/account/orders", icon: Package, title: t.myOrders, note: t.myOrdersNote },
    { href: "/wishlist", icon: Heart, title: t.wishlist, note: t.wishlistNote },
    { href: "/account/addresses", icon: MapPin, title: t.addresses, note: t.addressesNote },
    { href: "/account/notifications", icon: Bell, title: t.notifications, note: t.notificationsNote },
  ];

  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-4 p-5">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue text-xl font-medium text-white">
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
        <div>
          <div className="text-lg font-medium text-ink">{user.name}</div>
          <div className="text-sm text-ink-400">{user.email}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            signOut();
            void signOutServer();
            router.push("/");
          }}
          className="btn btn-ghost ms-auto"
        >
          <LogOut className="h-4 w-4" /> {t.logout}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card p-5 transition-shadow hover:shadow-card">
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-blue-50">
              <l.icon className="h-5 w-5 text-blue-600" />
            </span>
            <div className="font-medium text-ink">{l.title}</div>
            <div className="text-sm text-ink-400">{l.note}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

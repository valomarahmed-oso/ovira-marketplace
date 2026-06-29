"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Heart, LogIn, LogOut, MapPin, Package } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useHydrated } from "@/lib/use-hydrated";

const links = [
  { href: "/account/orders", icon: Package, title: "طلباتي", note: "تتبّع ومراجعة طلباتك" },
  { href: "/wishlist", icon: Heart, title: "المفضلة", note: "المنتجات اللي حفظتها" },
  { href: "/account/addresses", icon: MapPin, title: "العناوين", note: "عناوين التوصيل" },
  { href: "/account/notifications", icon: Bell, title: "الإشعارات", note: "تنبيهات الطلبات والعروض" },
];

export default function AccountPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="container-ovira py-10">
        <div className="card p-10 text-center text-ink-400">جارٍ التحميل…</div>
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
          <h1 className="text-xl font-medium text-ink">سجّل دخولك</h1>
          <p className="text-sm text-ink-400">ادخل لحسابك عشان تتابع طلباتك وعناوينك.</p>
          <div className="flex justify-center gap-2">
            <Link href="/login" className="btn btn-primary">تسجيل الدخول</Link>
            <Link href="/register" className="btn btn-ghost">إنشاء حساب</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-ovira space-y-6 py-6">
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
            router.push("/");
          }}
          className="btn btn-ghost ms-auto"
        >
          <LogOut className="h-4 w-4" /> خروج
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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

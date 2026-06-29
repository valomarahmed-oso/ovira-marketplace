"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, Lock, Store } from "lucide-react";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { useAuth } from "@/lib/auth-store";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);

  // Once the session is resolved, bounce guests to login (preserving intent).
  useEffect(() => {
    if (ready && !user) {
      router.replace(`/login?next=${encodeURIComponent("/vendor")}`);
    }
  }, [ready, user, router]);

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
            <Lock className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">سجّل دخولك للمتابعة</h1>
          <p className="text-sm text-ink-400">لوحة البائع متاحة للحسابات المسجّلة فقط.</p>
          <Link href={`/login?next=${encodeURIComponent("/vendor")}`} className="btn btn-primary inline-flex">
            تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  // Logged in, but not a vendor yet → invite them to apply.
  if (!user.isVendor) {
    return (
      <div className="container-ovira py-16">
        <div className="card mx-auto max-w-md space-y-4 p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50">
            <Store className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-medium text-ink">لسه مابقتش بائع على أوفيرا</h1>
          <p className="text-sm text-ink-400">
            افتح متجرك وابدأ تبيع منتجاتك لآلاف العملاء. التسجيل بياخد دقايق.
          </p>
          <Link href="/sell" className="btn btn-primary inline-flex">
            ابدأ البيع
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-ovira py-6">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <VendorSidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

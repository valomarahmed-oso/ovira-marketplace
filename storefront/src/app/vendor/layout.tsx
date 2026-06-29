"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, Lock, Store } from "lucide-react";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
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
          <h1 className="text-xl font-medium text-ink">{t.vendorLoginRequired}</h1>
          <p className="text-sm text-ink-400">{t.vendorLoginRequiredSub}</p>
          <Link href={`/login?next=${encodeURIComponent("/vendor")}`} className="btn btn-primary inline-flex">
            {t.loginTitle}
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
          <h1 className="text-xl font-medium text-ink">{t.notVendorTitle}</h1>
          <p className="text-sm text-ink-400">{t.notVendorSub}</p>
          <Link href="/sell" className="btn btn-primary inline-flex">
            {t.startSelling}
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

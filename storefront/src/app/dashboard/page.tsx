"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { primaryDashboard } from "@/lib/dashboards";

/**
 * Canonical portal entry. Sends each account to the highest-privilege dashboard
 * it can enter (owner → vendor → buyer); guests go to login. The per-role
 * switcher inside the shell handles hopping between dashboards afterwards.
 */
export default function DashboardRouter() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?next=%2Fdashboard");
      return;
    }
    router.replace(primaryDashboard(user) ?? "/account");
  }, [ready, user, router]);

  return (
    <div className="container-ovira flex justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
    </div>
  );
}

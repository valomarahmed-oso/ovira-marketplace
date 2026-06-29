"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertCircle, Lock, LogIn, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/lib/auth-store";
import { signIn } from "@/lib/auth";
import { useI18n } from "@/components/i18n-provider";

function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useSearchParams();
  const next = params.get("next");
  const setUser = useAuth((s) => s.setUser);
  const setReady = useAuth((s) => s.setReady);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(email, password);
      setUser(user);
      setReady(true);
      router.push(next || (user.isVendor ? "/vendor" : "/account"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تسجيل الدخول.");
      setBusy(false);
    }
  }

  const wrap = "relative";
  const icon = "pointer-events-none absolute end-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400";
  const field = "h-12 w-full rounded-xl border border-line bg-white pe-12 ps-4 text-sm outline-none focus:border-blue";

  return (
    <div className="container-ovira flex justify-center py-12">
      <div className="card w-full max-w-md space-y-6 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo withWordmark={false} />
          <h1 className="text-2xl font-medium text-ink">{t.loginTitle}</h1>
          <p className="text-sm text-ink-400">{t.loginSub}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className={wrap}>
            <input
              type="email"
              required
              placeholder={t.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
            <Mail className={icon} />
          </div>
          <div className={wrap}>
            <input
              type="password"
              required
              placeholder={t.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
            <Lock className={icon} />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
            <LogIn className="h-5 w-5" /> {busy ? t.loggingIn : t.enter}
          </button>
        </form>

        <p className="text-center text-sm text-ink-400">
          {t.noAccount}{" "}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            className="font-medium text-blue-600 hover:underline"
          >
            {t.createAccount}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

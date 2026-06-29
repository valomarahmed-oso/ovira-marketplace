"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, Mail, Phone, UserPlus, User } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/lib/auth-store";
import { signUp } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const user = await signUp(form.name, form.email, form.password);
    setUser(user);
    router.push("/account");
  }

  const wrap = "relative";
  const icon = "pointer-events-none absolute end-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400";
  const field = "h-12 w-full rounded-xl border border-line bg-white pe-12 ps-4 text-sm outline-none focus:border-blue";

  return (
    <div className="container-ovira flex justify-center py-12">
      <div className="card w-full max-w-md space-y-6 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo withWordmark={false} />
          <h1 className="text-2xl font-medium text-ink">إنشاء حساب</h1>
          <p className="text-sm text-ink-400">انضم لأوفيرا في خطوة واحدة</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className={wrap}>
            <input required placeholder="الاسم بالكامل" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
            <User className={icon} />
          </div>
          <div className={wrap}>
            <input type="email" required placeholder="البريد الإلكتروني" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            <Mail className={icon} />
          </div>
          <div className={wrap}>
            <input inputMode="tel" placeholder="رقم الموبايل" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
            <Phone className={icon} />
          </div>
          <div className={wrap}>
            <input type="password" required placeholder="كلمة المرور" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} />
            <Lock className={icon} />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
            <UserPlus className="h-5 w-5" /> إنشاء الحساب
          </button>
        </form>

        <p className="text-center text-sm text-ink-400">
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            سجّل دخولك
          </Link>
        </p>
      </div>
    </div>
  );
}

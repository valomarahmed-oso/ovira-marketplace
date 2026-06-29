import type { AuthUser } from "@/lib/auth-store";

const BASE = process.env.NEXT_PUBLIC_FRAPPE_URL?.replace(/\/$/, "") ?? "";

export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (BASE) {
    try {
      const res = await fetch(`${BASE}/api/method/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ usr: email, pwd: password }),
        credentials: "include",
      });
      if (res.ok) return { name: email.split("@")[0], email };
    } catch {
      // fall through to mock
    }
  }
  // Mock fallback so the storefront runs without a backend.
  return { name: email.split("@")[0] || "ضيف", email };
}

export async function signUp(name: string, email: string, _password: string): Promise<AuthUser> {
  // TODO: wire to a Frappe sign-up endpoint when the backend is connected.
  return { name: name.trim() || email.split("@")[0], email };
}

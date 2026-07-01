// Session-scoped CSRF handling for the Frappe backend.
//
// Frappe enforces CSRF on any authenticated (non-Guest) write: a POST without a
// valid `X-Frappe-CSRF-Token` header is rejected with "Invalid Request". The
// token is session-scoped; we read it from `auth.me` on load/login and attach it
// to every write. Guests have no token (and are CSRF-exempt), so guest writes
// (login, sign-up, guest checkout) just omit the header.

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null | undefined): void {
  csrfToken = token ?? null;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

/** JSON headers for a write, carrying the CSRF token when we have one. */
export function writeHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
  if (csrfToken) headers["X-Frappe-CSRF-Token"] = csrfToken;
  return headers;
}

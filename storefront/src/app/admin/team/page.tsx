"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, UserPlus, X } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { listTeam, setTeamMember, type ManagedRole, type TeamMember } from "@/lib/team-admin";

export default function AdminTeamPage() {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const isOperator = !!user?.isOperator;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManagedRole>("Marketplace Content Editor");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMembers(await listTeam());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!ready || !isOperator) return;
    void load();
  }, [ready, isOperator, load]);

  const roleLabel: Record<ManagedRole, string> = {
    "Marketplace Operator": t.tmBadgeOperator,
    "Marketplace Content Editor": t.tmBadgeContentEditor,
  };

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await setTeamMember(email.trim(), role, true);
      setEmail("");
      setNotice(t.tmGranted);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.tmErr);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(m: TeamMember, r: ManagedRole) {
    if (!confirm(t.tmRevokeConfirm)) return;
    setError(null);
    setNotice(null);
    try {
      await setTeamMember(m.email, r, false);
      setNotice(t.tmRevoked);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.tmErr);
    }
  }

  const field = "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-blue";
  const label = "mb-1.5 block text-sm font-medium text-ink";

  if (ready && !isOperator) {
    return <div className="card p-10 text-center text-ink-400">{t.tmNoPermission}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium text-ink">{t.tmTitle}</h2>
        <p className="text-sm text-ink-400">{t.tmSubtitle}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-coral-50 px-4 py-3 text-sm text-coral">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-[#e7f8f1] px-4 py-3 text-sm text-mint">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}

      {/* Grant access */}
      <form onSubmit={grant} className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2 font-medium text-ink">{t.tmAddTitle}</div>
        <div>
          <label className={label}>{t.tmEmail}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
            dir="ltr"
            placeholder="name@example.com"
          />
          <p className="mt-1 text-xs text-ink-400">{t.tmEmailHint}</p>
        </div>
        <div>
          <label className={label}>{t.tmRole}</label>
          <select value={role} onChange={(e) => setRole(e.target.value as ManagedRole)} className={field}>
            <option value="Marketplace Content Editor">{t.tmRoleContentEditor}</option>
            <option value="Marketplace Operator">{t.tmRoleOperator}</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {t.tmGrant}
          </button>
        </div>
      </form>

      {/* Members */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : members.length === 0 ? (
        <div className="card p-10 text-center text-ink-400">{t.tmEmpty}</div>
      ) : (
        <div>
          <div className="mb-2 text-sm font-medium text-ink-400">{t.tmMembers}</div>
          <div className="card divide-y divide-line">
            {members.map((m) => (
              <div key={m.email} className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-sm font-medium text-blue-600">
                  {(m.full_name || m.email).trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 grow">
                  <div className="truncate text-sm font-medium text-ink">
                    {m.full_name}
                    {!m.enabled && <span className="ms-2 text-xs text-coral">({t.tmDisabledUser})</span>}
                  </div>
                  <div className="truncate font-tech text-xs text-ink-400">{m.email}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {m.roles.map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pe-1 ps-2.5 text-xs text-blue-600"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {roleLabel[r]}
                      <button
                        type="button"
                        onClick={() => revoke(m, r)}
                        aria-label={t.tmRevoke}
                        className="grid h-5 w-5 place-items-center rounded-full text-blue-600 transition-colors hover:bg-coral-50 hover:text-coral"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

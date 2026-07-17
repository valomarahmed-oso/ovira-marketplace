"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { answerQuestion, askQuestion, getQuestions, type Question } from "@/lib/qa-api";

export function ProductQA({ slug, productVendor }: { slug: string; productVendor?: string }) {
  const { t } = useI18n();
  const user = useAuth((s) => s.user);
  const [list, setList] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAnswer = !!user && (user.isOperator || (!!productVendor && user.vendor === productVendor));

  useEffect(() => {
    let cancelled = false;
    getQuestions(slug)
      .then((q) => !cancelled && setList(q))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await askQuestion(slug, body.trim());
      setList((prev) => [saved, ...prev]);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.qaAskErr);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionHeading title={t.qaTitle} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {loading ? (
            <div className="card flex items-center justify-center p-6 text-ink-400">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          ) : list.length === 0 ? (
            <div className="card p-6 text-center text-sm text-ink-400">{t.qaEmpty}</div>
          ) : (
            list.map((q) => (
              <QuestionCard key={q.id} q={q} canAnswer={canAnswer} onAnswered={(a) =>
                setList((prev) => prev.map((x) => (x.id === a.id ? a : x)))
              } />
            ))
          )}
        </div>

        <div>
          {user ? (
            <form onSubmit={ask} className="card space-y-3 p-5">
              <h3 className="font-medium text-ink">{t.qaAskHeading}</h3>
              <textarea
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t.qaAskPlaceholder}
                className="min-h-24 w-full rounded-xl border border-line bg-white p-4 text-sm outline-none focus:border-blue"
              />
              {error && <p className="text-sm text-coral">{error}</p>}
              <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
                {busy ? t.revSending : t.qaAskSubmit}
              </button>
            </form>
          ) : (
            <div className="card space-y-3 p-5 text-center text-sm text-ink-400">
              <p>{t.qaSignInPrompt}</p>
              <Link href="/login" className="btn btn-primary w-full">
                {t.loginTitle}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function QuestionCard({
  q,
  canAnswer,
  onAnswered,
}: {
  q: Question;
  canAnswer: boolean;
  onAnswered: (a: Question) => void;
}) {
  const { t } = useI18n();
  const [answer, setAnswer] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      onAnswered(await answerQuestion(q.id, answer.trim()));
      setOpen(false);
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.qaAnswerErr);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-start gap-2">
        <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div className="min-w-0">
          <p className="text-sm text-ink">{q.body}</p>
          <span className="text-xs text-ink-400">
            {q.author} · {q.date}
          </span>
        </div>
      </div>

      {q.answer ? (
        <div className="ms-6 rounded-lg bg-canvas px-3 py-2">
          <p className="text-sm text-ink-600">{q.answer}</p>
          {q.answered_by && <span className="text-xs text-mint">{t.qaAnswerBy} {q.answered_by}</span>}
        </div>
      ) : canAnswer ? (
        open ? (
          <form onSubmit={submit} className="ms-6 space-y-2">
            <textarea
              required
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={t.qaAnswerPlaceholder}
              className="min-h-16 w-full rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-blue"
            />
            {error && <p className="text-sm text-coral">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t.qaSend}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
                {t.qaCancel}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="ms-6 text-sm text-blue-600 hover:underline">
            {t.qaReply}
          </button>
        )
      ) : null}
    </div>
  );
}

/**
 * One place to say "a backend call failed", so a failure is never invisible.
 *
 * Every API module in this folder degrades a failed read to `null` or `[]`, and
 * that part is right — a storefront should render something when a panel can't
 * load. What was wrong is that it did so *silently*, making a 500 identical to
 * an empty result at every call site.
 *
 * That is not a hypothetical. The support-ticket queue threw a ValidationError
 * on every single request for days; the buyer's centre and the operator's queue
 * both rendered a calm "no tickets" over a table that had rows in it. Nothing in
 * the UI could have revealed that, and nothing in the logs was looked at because
 * nothing suggested there was anything to look for.
 *
 * Kept in its own module rather than in `api.ts` so the smallest client module
 * can import it without pulling the whole catalog layer (and its mock data) in
 * with it.
 */

/** Log a failed backend call. Callers still degrade gracefully; this only makes
 *  the failure findable — in the container log for server components, in the
 *  browser console for client ones. */
export function reportApiFailure(source: string, reason: unknown) {
  const detail = reason instanceof Error ? reason.message : String(reason);
  console.error(`[ovira] ${source} failed: ${detail}`);
}

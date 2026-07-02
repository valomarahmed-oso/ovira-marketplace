/** Shared shell for static info/legal pages (server-safe, no client JS). */
export function InfoPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-ovira py-10">
      <div className="card mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
        <div className="mt-6 space-y-4 text-sm leading-7 text-ink-600">{children}</div>
      </div>
    </div>
  );
}

export function InfoSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-medium text-ink">{heading}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

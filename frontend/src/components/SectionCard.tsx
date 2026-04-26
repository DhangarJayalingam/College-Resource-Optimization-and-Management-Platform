interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 p-5 shadow-card dark:border-slate-800">
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
}

export function MetricCard({ title, value, helper, icon }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-3 font-display text-3xl font-bold leading-none">{value}</p>
          {helper ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{helper}</p> : null}
        </div>
        {icon ? <div className="rounded-xl bg-cyan-50 p-3 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200">{icon}</div> : null}
      </div>
    </article>
  );
}

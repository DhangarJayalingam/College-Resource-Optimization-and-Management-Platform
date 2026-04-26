interface BadgeProps {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}

const toneClasses: Record<NonNullable<BadgeProps['tone']>, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{label}</span>;
}

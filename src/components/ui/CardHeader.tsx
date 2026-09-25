import type { ReactNode } from 'react';

export function CardHeader({ id, title, icon, action }: { id: string; title: string; icon: ReactNode; action?: ReactNode }) {
  return <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-slate-500" aria-hidden="true">{icon}</span>
      <h2 id={id} className="text-sm font-semibold text-slate-900">{title}</h2>
    </div>
    {action}
  </header>;
}

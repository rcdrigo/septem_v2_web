import { useId, type ReactNode } from 'react';

export function FormSection({ title, description, children, compact = false, id }: {
  title: string;
  description?: string;
  children: ReactNode;
  compact?: boolean;
  id?: string;
}) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className={`min-w-0 border-b border-slate-200 first:pt-0 last:border-b-0 ${compact ? 'py-5' : 'py-7'}`}>
      <header className={compact ? 'mb-4' : 'mb-5'}>
        <h2 id={headingId} className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-slate-900`}>{title}</h2>
        {description && <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-600">{description}</p>}
      </header>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

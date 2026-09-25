import { ArrowRight, ExternalLink, UserRoundMinus } from 'lucide-react';
import { TagPills } from '@/components/tags';
import type { ExecutionTag } from '@/lib/api/tags';
import { openTab } from '@/lib/nav';
import { routes } from '@/lib/routes';
import { TestBadge } from './TestBadge';
import { renderIcon } from '@/lib/icon-catalog';
import { FALLBACK_COLOR, tintOf } from '@/components/catalog/category-catalog';
import type { ProcessMetadata } from '@/lib/api/execution';

/** Identidade visual do processo, compartilhada por cartões e tabelas. */
export function ExecutionProcessPill({ item }: { item: ProcessMetadata }) {
  const color = item.categoryColor ?? FALLBACK_COLOR;
  const icon = item.processIcon ? renderIcon(item.processIcon, 13) : null;
  return <span data-testid="process-pill" title={item.categoryName ? `${item.process || 'Processo'} · ${item.categoryName}` : item.process || 'Processo'}
    style={{ backgroundColor: tintOf(color), color }}
    className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold [&>svg]:shrink-0">
    {icon}<span className="truncate">{item.process || 'Processo'}</span>
  </span>;
}

export function ExecutionNumber({ executionId, number }: { executionId: string; number?: number | null }) {
  if (number == null) return <span className="shrink-0 text-xs text-slate-500">Sem número</span>;
  return (
    <button type="button" title={`Acompanhar requisição #${number}`} aria-label={`Acompanhar requisição #${number}`}
      onClick={(event) => { event.stopPropagation(); openTab(routes.request(executionId)); }}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium tabular-nums text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">
      #{number}<ExternalLink size={12} aria-hidden="true" />
    </button>
  );
}

export function ExecutionIndicators({ isTest, absentUserName, tags = [], className = '' }: { isTest?: boolean; absentUserName?: string | null; tags?: ExecutionTag[]; className?: string }) {
  const absentName = absentUserName?.trim();
  return <TagPills tags={tags} className={className} leadingPills={isTest || absentName ? <>
    {isTest && <TestBadge />}
    {absentName && <span title={`Ausência temporária: ${absentName}`} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"><UserRoundMinus size={13} aria-hidden="true" />Ausência temporária: {absentName}</span>}
  </> : undefined} />;
}

export function CardAccess() {
  return <span aria-hidden="true" className="task-card-access"><span>Acessar</span><ArrowRight size={15} /></span>;
}

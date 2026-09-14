import { History, RefreshCw } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import {
  useExecutionTagHistory,
  useProcessTagHistory,
  useTagsAccess,
  type ExecutionTagHistoryAction,
  type ProcessTagHistoryAction,
  type TagHistoryItem,
} from '@/lib/api/tags';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function eventDescription(item: TagHistoryItem<string>): string {
  switch (item.action) {
    case 'created':
      return `criou a tag “${item.tagName}”`;
    case 'added':
      return `adicionou “${item.tagName}” a esta execução`;
    case 'removed':
      return `removeu “${item.tagName}” desta execução`;
    case 'renamed':
      return item.previousName
        ? `renomeou “${item.previousName}” para “${item.tagName}”`
        : `renomeou a tag para “${item.tagName}”`;
    case 'deleted':
      return `excluiu a tag “${item.tagName}” do processo`;
    default:
      return `alterou a tag “${item.tagName}”`;
  }
}

function HistoryList({
  items,
  isLoading,
  isError,
  onRetry,
  emptyMessage,
}: {
  items?: readonly TagHistoryItem<string>[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyMessage: string;
}) {
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-slate-500">Carregando histórico…</p>;
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-rose-700">Não foi possível carregar o histórico de tags.</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
        </button>
      </div>
    );
  }
  if (!items?.length) {
    return <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <ol className="divide-y divide-slate-100">
      {[...items].sort((left, right) => (
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
      )).map((item) => (
        <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-900">{item.actor.name}</span>{' '}
              {eventDescription(item)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDate(item.occurredAt)}
              {item.operator && item.operator.id !== item.actor.id
                ? ` · Operado por ${item.operator.name}`
                : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ExecutionTagHistoryDialog({
  executionId,
  onClose,
}: {
  executionId: string | number;
  onClose: () => void;
}) {
  const history = useExecutionTagHistory(executionId);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Histórico de tags"
      width="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Fechar
        </button>
      }
    >
      <HistoryList
        items={history.data?.items as TagHistoryItem<ExecutionTagHistoryAction>[] | undefined}
        isLoading={history.isLoading}
        isError={history.isError}
        onRetry={() => void history.refetch()}
        emptyMessage="Ainda não há alterações de tags nesta execução."
      />
    </Dialog>
  );
}

export function ProcessTagHistory({
  processKey,
  className = '',
}: {
  processKey: string | number;
  className?: string;
}) {
  const hasAccess = useTagsAccess();
  const history = useProcessTagHistory(hasAccess ? processKey : null);
  if (!hasAccess) return null;

  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 ${className}`} aria-label="Histórico geral de tags">
      <div className="mb-4 flex items-center gap-2">
        <History size={17} className="text-slate-500" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Histórico geral de tags</h3>
          <p className="text-xs text-slate-500">Criações, renomeações e exclusões do catálogo deste processo.</p>
        </div>
      </div>
      <HistoryList
        items={history.data?.items as TagHistoryItem<ProcessTagHistoryAction>[] | undefined}
        isLoading={history.isLoading}
        isError={history.isError}
        onRetry={() => void history.refetch()}
        emptyMessage="Ainda não há alterações no catálogo de tags."
      />
    </section>
  );
}

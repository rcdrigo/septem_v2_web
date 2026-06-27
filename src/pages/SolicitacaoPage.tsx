import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useInstance } from '@/lib/api/execution';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useSessionStore } from '@/stores/session';
import { InstanceReport, StatusPill } from './InstanciasPage';

/**
 * Relatório/acompanhamento de uma instância em tela cheia (rota
 * /solicitacao/:instanceId, fora do AppShell — sem menus). Aberto em nova aba
 * a partir das listas e da conclusão de tarefa.
 */
export function SolicitacaoPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  // Rota fora do AppShell (nova aba): bootstrap próprio p/ carregar user+perms,
  // senão can('workflow:write') fica falso e a barra de ações admin some.
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  useEffect(() => { if (status === 'idle') void bootstrap(); }, [status, bootstrap]);
  const inst = useInstance(instanceId ?? '');
  const d = inst.data;
  useDocumentTitle(d?.process ?? 'Solicitação');
  if (!instanceId) return null;
  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div className="min-w-0">
            {d?.category && (
              <span className="mb-1 inline-block rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{d.category}</span>
            )}
            <h1 className="text-xl font-semibold text-slate-900">
              Detalhamento do processo{d?.number != null ? ` nº ${d.number}` : ''}
            </h1>
            <p className="truncate text-sm text-slate-500">{d?.process ?? 'Acompanhamento da solicitação'}</p>
            {d && <div className="mt-2"><StatusPill status={d.status} /></div>}
          </div>
          <button type="button" onClick={() => window.print()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <InstanceReport id={instanceId} />
        </div>
      </main>
    </div>
  );
}

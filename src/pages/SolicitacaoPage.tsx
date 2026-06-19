import { useParams } from 'react-router-dom';
import { useInstance } from '@/lib/api/execution';
import { InstanceReport } from './InstanciasPage';

/**
 * Relatório/acompanhamento de uma instância em tela cheia (rota
 * /solicitacao/:instanceId, fora do AppShell — sem menus). Aberto em nova aba
 * a partir das listas e da conclusão de tarefa.
 */
export function SolicitacaoPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const inst = useInstance(instanceId ?? '');
  if (!instanceId) return null;
  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">{inst.data?.process ?? 'Acompanhamento da solicitação'}</h1>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <InstanceReport id={instanceId} />
        </div>
      </main>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useProcessDefinition } from '@/lib/api/process-definitions';
import { useProcessForm, useStartInstance, type TaskButton } from '@/lib/api/execution';
import { ReactForm, FormSkeleton, type ReactFormHandle } from '@/components/form/ReactForm';
import { CompletionScreen } from '@/pages/TarefasPage';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDocumentTitle } from '@/lib/use-document-title';
import { Toaster } from '@/components/ui/Toaster';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';

/**
 * Aba standalone (sem menus) para preencher e iniciar um serviço (req. 7). O
 * formulário é renderizado com componentes React nativos (req. 7.1). Compartilha
 * o token via localStorage com a aba principal; sem sessão → vai para /login.
 */
export function ServicoFormPage() {
  const { processKey } = useParams();
  const token = useSessionStore((s) => s.accessToken);
  const tenant = useSessionStore((s) => s.tenant);
  const detail = useProcessDefinition(processKey ?? null);
  const form = useProcessForm(processKey ?? null);
  const start = useStartInstance();
  const fillRef = useRef<ReactFormHandle>(null);
  const [done, setDone] = useState<{ nextTaskForMe?: string | null; executionId?: string } | null>(null);
  useDocumentTitle(detail.data?.name ?? 'Serviço');

  if (!token) return <Navigate to="/login" replace />;

  async function submit(button?: TaskButton) {
    const { data, errors } = fillRef.current?.submit() ?? { data: {}, errors: {} };
    if ((button?.validateForm ?? true) && Object.keys(errors).length) { toast.error('Preencha os campos obrigatórios.'); return; }
    try {
      const r = await start.mutateAsync({ key: processKey!, data });
      setDone({ nextTaskForMe: r.nextTaskForMe, executionId: r.executionId });
    } catch { toast.error('Não foi possível iniciar o processo.'); }
  }

  const name = detail.data?.name ?? 'Serviço';
  const buttons = form.data?.buttons ?? [];

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{tenant?.clienteNome ?? 'Septem'}</p>
        <h1 className="text-lg font-semibold text-slate-900">{name}</h1>
      </header>

      {done ? (
        <main className="flex-1 overflow-auto">
          <CompletionScreen next={done.nextTaskForMe} executionId={done.executionId} onClose={() => window.close()} />
        </main>
      ) : (
        <>
          {/* Cada grupo renderiza seu próprio card (sem container único). */}
          <main className="flex-1 overflow-auto p-6">
            {form.isLoading ? <FormSkeleton /> : <ReactForm ref={fillRef} schema={form.data?.formSchema} optionsByField={form.data?.fieldOptions} />}
          </main>
          {/* Botões de início — usa os configurados no evento de início; senão, "Iniciar". */}
          <footer className="flex justify-start gap-2 border-t border-slate-200 bg-white px-6 py-3">
            {buttons.length === 0 ? (
              <button type="button" onClick={() => submit()} disabled={start.isPending || form.isLoading} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
                <Play size={15} /> Iniciar
              </button>
            ) : buttons.map((b) => (
              <Tooltip key={b.id} text={b.hint}>
                <button type="button" onClick={() => submit(b)} disabled={start.isPending || form.isLoading}
                  style={b.primaryColor ? { backgroundColor: b.primaryColor, color: b.textColor ?? '#fff' } : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 ${b.primaryColor ? '' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>
                  {b.icon && <i className={b.icon} />}
                  {b.label}
                </button>
              </Tooltip>
            ))}
          </footer>
        </>
      )}
      <Toaster />
    </div>
  );
}

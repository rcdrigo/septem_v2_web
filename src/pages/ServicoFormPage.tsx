import { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useProcessDefinition } from '@/lib/api/process-definitions';
import { useProcessForm, useStartInstance, type TaskButton } from '@/lib/api/execution';
import { ReactForm, FormSkeleton, type ReactFormHandle } from '@/components/form/ReactForm';
import { CompletionScreen, DocBanner } from '@/pages/TarefasPage';
import { useDocumentTitle } from '@/lib/use-document-title';
import { Toaster } from '@/components/ui/Toaster';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { ExecutionHeader } from '@/components/execution/ExecutionHeader';
import { TaskActionFooter, type ExecutionAction } from '@/components/execution/TaskActionFooter';

/**
 * Aba standalone (sem menus) para preencher e iniciar um serviço (req. 7). O
 * formulário é renderizado com componentes React nativos (req. 7.1). Compartilha
 * o token via localStorage com a aba principal; sem sessão → vai para /login.
 */
export function ServicoFormPage() {
  const { processKey } = useParams();
  const token = useSessionStore((s) => s.accessToken);
  const detail = useProcessDefinition(processKey ?? null);
  const form = useProcessForm(processKey ?? null);
  const start = useStartInstance();
  // Aba standalone (sem AppShell): sem bootstrap próprio o usuário e as permissões
  // não chegam a carregar, e o "iniciar como teste" sumiria de quem pode simular.
  const sessionStatus = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  useEffect(() => { if (sessionStatus === 'idle') void bootstrap(); }, [sessionStatus, bootstrap]);
  const canSimulate = useSessionStore((s) => s.can('workflow:simulate'));
  const fillRef = useRef<ReactFormHandle>(null);
  const [isTest, setIsTest] = useState(false);
  const [done, setDone] = useState<{ nextTaskForMe?: string | null; executionId?: string } | null>(null);
  const processName = form.data?.processName ?? detail.data?.name ?? 'Serviço';
  const taskName = form.data?.startTaskName || processName;
  useDocumentTitle(taskName);

  if (!token) return <Navigate to="/login" replace />;

  async function submit(button?: TaskButton) {
    const { data, errors } = fillRef.current?.submit() ?? { data: {}, errors: {} };
    if ((button?.validateForm ?? true) && Object.keys(errors).length) { toast.error('Preencha os campos obrigatórios.'); return; }
    try {
      const r = await start.mutateAsync({ key: processKey!, data, isTest: canSimulate && isTest });
      setDone({ nextTaskForMe: r.nextTaskForMe, executionId: r.executionId });
    } catch { toast.error('Não foi possível iniciar o processo.'); }
  }

  // Cabeçalho no MESMO padrão das demais tarefas: tarefa em destaque e processo
  // como contexto secundário.
  const buttons = form.data?.buttons ?? [];
  const completionActions: ExecutionAction[] = buttons.length === 0
    ? [{
        id: '__start',
        label: 'Iniciar',
        loadingLabel: 'Iniciando…',
        icon: <Play size={15} aria-hidden="true" />,
        onClick: () => submit(),
        disabled: start.isPending || form.isLoading,
        loading: start.isPending,
      }]
    : buttons.map((button) => ({
        id: button.id,
        label: button.label,
        hint: button.hint,
        icon: button.icon ? <i className={button.icon} aria-hidden="true" /> : undefined,
        onClick: () => submit(button),
        disabled: start.isPending || form.isLoading,
        loading: start.isPending,
        loadingLabel: 'Iniciando…',
        style: button.primaryColor ? { backgroundColor: button.primaryColor, color: button.textColor ?? '#fff' } : undefined,
      }));

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100">
      <ExecutionHeader
        processName={processName}
        taskName={taskName}
        alias={form.data?.startTaskAlias}
        sector={form.data?.startTaskSector}
      />

      {done ? (
        <main className="flex-1 overflow-auto">
          <CompletionScreen kind="start" next={done.nextTaskForMe} executionId={done.executionId} onClose={() => window.close()} />
        </main>
      ) : (
        <>
          {/* Cada grupo renderiza seu próprio card (sem container único). */}
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {form.data?.documentationUrl && <DocBanner url={form.data.documentationUrl} />}
            {form.isLoading ? <FormSkeleton /> : <ReactForm ref={fillRef} schema={form.data?.formSchema} data={form.data?.data ?? undefined} optionsByField={form.data?.fieldOptions} uploadContext={{ processKey: processKey ?? undefined }} />}
          </main>
          <TaskActionFooter
            completionActions={completionActions}
            loading={form.isLoading}
            notice={canSimulate ? (
              <label className="inline-flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  data-testid="iniciar-como-teste"
                  checked={isTest}
                  onChange={(event) => setIsTest(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                />
                <span>
                  Iniciar como <strong>teste</strong>
                  <span className="block text-xs text-slate-500">O processo é marcado como teste e todas as tarefas ficam com você.</span>
                </span>
              </label>
            ) : undefined}
          />
        </>
      )}
      <Toaster />
    </div>
  );
}

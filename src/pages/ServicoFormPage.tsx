import { useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CheckCircle2, Play } from 'lucide-react';
import { useProcessDefinition } from '@/lib/api/process-definitions';
import { useProcessForm, useStartInstance } from '@/lib/api/execution';
import { ReactForm, type ReactFormHandle } from '@/components/form/ReactForm';
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
  const [done, setDone] = useState(false);

  if (!token) return <Navigate to="/login" replace />;

  async function submit() {
    const { data, errors } = fillRef.current?.submit() ?? { data: {}, errors: {} };
    if (Object.keys(errors).length) { toast.error('Preencha os campos obrigatórios.'); return; }
    try {
      await start.mutateAsync({ key: processKey!, data });
      setDone(true);
    } catch { toast.error('Não foi possível iniciar o processo.'); }
  }

  const name = detail.data?.name ?? 'Serviço';

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{tenant?.clienteNome ?? 'Septem'}</p>
          <h1 className="text-lg font-semibold text-slate-900">{name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        {done ? (
          <div className="flex flex-col items-center rounded-md border border-slate-200 bg-white py-14 text-center">
            <CheckCircle2 size={44} className="mb-3 text-emerald-500" />
            <p className="text-base font-medium text-slate-800">Solicitação iniciada!</p>
            <p className="mt-1 text-sm text-slate-500">Você pode acompanhar o andamento em "Tarefas" e "Consultas".</p>
            <button type="button" onClick={() => window.close()} className="mt-5 rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Fechar
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-slate-200 bg-white p-6">
            {form.isLoading ? (
              <p className="text-sm text-slate-400">Carregando formulário…</p>
            ) : (
              <>
                <ReactForm ref={fillRef} schema={form.data} />
                <div className="mt-6 flex justify-end">
                  <button type="button" onClick={submit} disabled={start.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
                    <Play size={15} /> Iniciar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

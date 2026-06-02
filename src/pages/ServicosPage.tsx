import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Workflow } from 'lucide-react';
import { useProcessList, type ProcessListItem } from '@/lib/api/process-definitions';
import { useProcessForm, useStartInstance } from '@/lib/api/execution';
import { FormFill, type FormFillHandle } from '@/components/form/FormFill';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from '@/stores/toast';

/**
 * Geral › Serviços (B3): catálogo de processos publicados. "Iniciar" abre o
 * formulário inicial (form-js) e cria a instância com os dados preenchidos.
 */
export function ServicosPage() {
  const list = useProcessList({ status: 'published', pageSize: 100 });
  const [starting, setStarting] = useState<ProcessListItem | null>(null);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Serviços</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {!list.isLoading && (list.data?.items.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Workflow size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhum serviço disponível</p>
            <p className="mt-1 text-sm text-slate-500">Processos publicados aparecem aqui para serem iniciados.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.data?.items.map((p) => (
              <div key={p.key} className="flex flex-col rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-500"><Workflow size={18} /></div>
                <p className="font-medium text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-500">{p.category ?? 'Sem categoria'}{p.area ? ` · ${p.area}` : ''}</p>
                <button type="button" onClick={() => setStarting(p)} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
                  <Play size={15} /> Iniciar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {starting && <StartDialog process={starting} onClose={() => setStarting(null)} />}
    </div>
  );
}

function StartDialog({ process, onClose }: { process: ProcessListItem; onClose: () => void }) {
  const form = useProcessForm(process.key);
  const start = useStartInstance();
  const fillRef = useRef<FormFillHandle>(null);
  const navigate = useNavigate();

  async function submit() {
    const { data, errors } = fillRef.current?.submit() ?? { data: {}, errors: {} };
    if (Object.keys(errors).length) { toast.error('Preencha os campos obrigatórios.'); return; }
    try {
      await start.mutateAsync({ key: process.key, data });
      toast.success(`"${process.name}" iniciado.`);
      onClose();
      navigate('/tarefas');
    } catch { toast.error('Não foi possível iniciar o processo.'); }
  }

  return (
    <Dialog open onClose={onClose} width="lg" title={`Iniciar: ${process.name}`} footer={
      <>
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button onClick={submit} disabled={!form.data || start.isPending} className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Iniciar</button>
      </>
    }>
      {form.isLoading ? <p className="text-sm text-slate-400">Carregando formulário...</p> : <FormFill ref={fillRef} schema={form.data} />}
    </Dialog>
  );
}

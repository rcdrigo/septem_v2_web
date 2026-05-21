import { useNavigate } from 'react-router-dom';
import { Plus, Workflow } from 'lucide-react';

/**
 * Landing de Admin › Processos. Por ora é mínima: o CRUD/listagem real (que lista
 * de `/api/v1/workflow/process-definitions`) entra na Fase 3. O que ela já faz é
 * dar o caminho de volta ao **modelador** (bpmn + form), que vive em `/modelador`.
 */
export function ProcessosPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Processos</h1>
        <button
          type="button"
          onClick={() => navigate('/admin/processos/editar')}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          <Plus size={16} /> Novo processo
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Workflow size={26} />
          </div>
          <p className="text-sm font-medium text-slate-700">Nenhum processo listado ainda</p>
          <p className="mt-1 text-sm text-slate-500">
            A listagem carrega do backend na Fase 3. Por enquanto, abra o modelador para criar
            ou editar um fluxo (BPMN + formulário).
          </p>
          <button
            type="button"
            onClick={() => navigate('/admin/processos/editar')}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Workflow size={16} /> Abrir modelador
          </button>
        </div>
      </div>
    </div>
  );
}

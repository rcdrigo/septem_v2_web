import { Play, Workflow } from 'lucide-react';
import { useProcessList } from '@/lib/api/process-definitions';

/**
 * Geral › Serviços (B3): catálogo de processos publicados. "Iniciar" abre uma
 * NOVA ABA só com o formulário do serviço (sem menus) — ver ServicoFormPage.
 */
export function ServicosPage() {
  const list = useProcessList({ status: 'published', pageSize: 100 });

  function startService(key: string) {
    window.open(`${import.meta.env.BASE_URL}servico/${key}`, '_blank', 'noopener');
  }

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
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-500">{p.icon ? <i className={p.icon} /> : <Workflow size={18} />}</div>
                <p className="font-medium text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-500">{p.category ?? 'Sem categoria'}{p.area ? ` · ${p.area}` : ''}</p>
                {p.description && <div className="mt-1 line-clamp-3 text-xs text-slate-600 [&_a]:text-sky-600 [&_a]:underline [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-4 [&_ul]:pl-4" dangerouslySetInnerHTML={{ __html: p.description }} />}
                <button type="button" onClick={() => startService(p.key)} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
                  <Play size={15} /> Iniciar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

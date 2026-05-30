import { Building2 } from 'lucide-react';
import { useOrgUnitsTree, type OrgUnitNode } from '@/lib/api/org-units';

/**
 * Organograma — IF1.e. Visão somente-leitura da hierarquia de unidades
 * organizacionais (`GET /api/v1/org-units/tree`). A gestão (criar/editar) fica
 * em Configurações › Unidades.
 */
export function OrganogramaPage() {
  const tree = useOrgUnitsTree();

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Organograma</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {tree.isLoading && <p className="text-sm text-slate-400">Carregando...</p>}
        {!tree.isLoading && (tree.data?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Building2 size={26} />
            </div>
            <p className="text-sm font-medium text-slate-700">Nenhuma unidade cadastrada</p>
            <p className="mt-1 text-sm text-slate-500">Cadastre unidades em Configurações › Unidades.</p>
          </div>
        )}
        {tree.data && tree.data.length > 0 && (
          <div className="space-y-4">
            {tree.data.map((node) => <Branch key={node.id} node={node} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Branch({ node }: { node: OrgUnitNode }) {
  return (
    <div>
      <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 ${node.active ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'}`}>
        <Building2 size={15} className="text-slate-400" />
        <span className={`text-sm font-medium ${node.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{node.name}</span>
      </div>
      {node.children.length > 0 && (
        <div className="ml-5 mt-2 space-y-2 border-l border-slate-200 pl-4">
          {node.children.map((child) => <Branch key={child.id} node={child} />)}
        </div>
      )}
    </div>
  );
}

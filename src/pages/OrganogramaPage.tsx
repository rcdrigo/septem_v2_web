import { Building2 } from 'lucide-react';
import { useOrgUnitsTree, useOrgUnitsFlat } from '@/lib/api/org-units';
import { openTab } from '@/lib/nav';
import { OrgUnitTree } from '@/components/org-units/OrgUnitTree';
import { routes } from '@/lib/routes';

/**
 * Organograma — visão somente-leitura da hierarquia de unidades organizacionais.
 * Usa o MESMO layout de Configurações › Unidades (lista em card, com sigla, nome,
 * avatar e titular), porém sem as ações de gestão (criar/editar/excluir). Clicar
 * numa unidade abre o detalhamento (`/org-unit?id=`) em aba própria.
 */
export function OrganogramaPage() {
  const tree = useOrgUnitsTree();
  // A árvore não traz sigla/titular; o flat sim — casamos por id para exibir na linha.
  const flat = useOrgUnitsFlat();
  const byId = new Map((flat.data ?? []).map((u) => [u.id, u]));

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Organograma</h1>
      </header>

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
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
          <OrgUnitTree
            nodes={tree.data}
            unitsById={byId}
            variant="read"
            cardTestId="organograma-linha"
            ariaLabel="Organograma de unidades organizacionais"
            onOpen={(node) => openTab(`${routes.orgUnit}?id=${node.id}`)}
          />
        )}
      </div>
    </div>
  );
}

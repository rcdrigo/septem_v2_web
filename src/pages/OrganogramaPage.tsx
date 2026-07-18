import { useState } from 'react';
import { Building2, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useOrgUnitsTree, useOrgUnitsFlat, type OrgUnitFlat, type OrgUnitNode } from '@/lib/api/org-units';
import { openTab } from '@/lib/nav';
import { Avatar } from '@/pages/admin/UnidadesPage';

/**
 * Organograma — visão somente-leitura da hierarquia de unidades organizacionais.
 * Usa o MESMO layout de Configurações › Unidades (lista em card, com sigla, nome,
 * avatar e titular), porém sem as ações de gestão (criar/editar/excluir). Clicar
 * numa unidade abre o detalhamento (`/unidade?id=`) em aba própria.
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
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {tree.data.map((node) => (
              <TreeNode key={node.id} node={node} depth={0} byId={byId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Linha da unidade — igual à de Unidades, mas só-leitura: clicar abre o detalhe. */
function TreeNode({ node, depth, byId }: { node: OrgUnitNode; depth: number; byId: Map<string, OrgUnitFlat> }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const info = byId.get(node.id);
  const titular = info?.titular ?? null;

  return (
    <>
      <div
        className="group flex items-center gap-2 border-b border-slate-100 px-2 py-2 hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        data-testid="organograma-linha"
      >
        <button
          type="button"
          onClick={() => hasChildren && setOpen((o) => !o)}
          aria-label={open ? 'Recolher' : 'Expandir'}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 ${hasChildren ? 'hover:bg-slate-200' : 'invisible'}`}
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <Avatar url={titular?.photoUrl ?? null} nome={titular?.name ?? node.name} />

        <button
          type="button"
          onClick={() => openTab(`unidade?id=${node.id}`)}
          className="min-w-0 flex-1 text-left"
          title="Abrir a unidade em nova aba"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm font-semibold ${node.active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
              {info?.sigla || node.name}
            </span>
            {info?.sigla && <span className="truncate text-xs text-slate-500">{node.name}</span>}
            {!node.active && <span className="rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-500">inativa</span>}
          </span>
          <span className="block truncate text-xs text-slate-400">
            {titular ? titular.name : 'Sem titular'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => openTab(`unidade?id=${node.id}`)}
          className="ml-auto shrink-0 rounded p-1.5 text-slate-500 opacity-100 transition-opacity hover:bg-slate-200 hover:text-slate-800 sm:opacity-0 sm:group-hover:opacity-100"
          title="Abrir unidade"
          aria-label={`Abrir ${node.name}`}
        >
          <ExternalLink size={14} />
        </button>
      </div>
      {open && node.children.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} byId={byId} />
      ))}
    </>
  );
}

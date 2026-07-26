/* Hallmark · component: org-unit tree · genre: modern-minimal · theme: existing slate
 * states: default · hover · focus · active · expanded · collapsed · inactive · managed
 * contrast: existing application palette
 * pre-emit critique: P5 H5 E5 S5 R5 V4
 */
import { useId, useState } from 'react';
import {
  ChevronRight,
  Ellipsis,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import type { OrgUnitFlat, OrgUnitNode } from '@/lib/api/org-units';
import { MenuDivider, MenuItem, Popover } from '@/components/ui/Popover';

type SharedProps = {
  nodes: OrgUnitNode[];
  unitsById: ReadonlyMap<string, OrgUnitFlat>;
  onOpen: (unit: OrgUnitNode) => void;
  cardTestId: string;
  ariaLabel?: string;
};

type ReadProps = SharedProps & {
  variant: 'read';
};

type ManageProps = SharedProps & {
  variant: 'manage';
  onAddChild: (unit: OrgUnitNode) => void;
  onEdit: (unit: OrgUnitNode) => void;
  onDelete: (unit: OrgUnitNode) => void;
};

export type OrgUnitTreeProps = ReadProps | ManageProps;

/**
 * Árvore vertical compacta. Os cards têm largura intrínseca e nunca truncam nomes;
 * quando uma linha excede a tela, somente este viewport rola horizontalmente.
 */
export function OrgUnitTree(props: OrgUnitTreeProps) {
  return (
    <div
      className="min-w-0 max-w-full overflow-auto rounded-sm p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
      data-testid="org-unit-tree-viewport"
      tabIndex={0}
      role="region"
      aria-label={props.ariaLabel ?? 'Hierarquia de unidades organizacionais'}
    >
      <ul className="flex w-max flex-col items-start gap-3" role="list">
        {props.nodes.map((node) => (
          <OrgUnitTreeNode key={node.id} node={node} depth={0} props={props} />
        ))}
      </ul>
    </div>
  );
}

function OrgUnitTreeNode({
  node,
  depth,
  props,
}: {
  node: OrgUnitNode;
  depth: number;
  props: OrgUnitTreeProps;
}) {
  const [open, setOpen] = useState(true);
  const childrenId = useId();
  const hasChildren = node.children.length > 0;
  const info = props.unitsById.get(node.id);
  const titular = info?.titular ?? null;
  const primaryLabel = info?.sigla || node.name;

  return (
    <li
      className={[
        'relative flex w-max flex-col items-start',
        depth > 0
          ? "before:absolute before:-start-5 before:top-[1.625rem] before:w-5 before:border-t before:border-slate-200 before:content-['']"
          : '',
      ].join(' ')}
      data-depth={depth}
    >
      <div
        className="group inline-flex w-max items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-slate-50 focus-within:border-slate-400"
        data-testid={props.cardTestId}
        data-org-unit-card="true"
      >
        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={`${open ? 'Recolher' : 'Expandir'} ${node.name}`}
            aria-expanded={open}
            aria-controls={childrenId}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 active:bg-slate-300"
          >
            <ChevronRight
              size={17}
              className={`transition-transform duration-150 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}
            />
          </button>
        )}

        <Avatar url={titular?.photoUrl ?? null} nome={titular?.name ?? node.name} size={36} />

        <button
          type="button"
          onClick={() => props.onOpen(node)}
          className="flex w-max items-center gap-3 rounded-md px-1.5 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 active:bg-slate-100"
          title="Abrir a unidade em nova aba"
        >
          <span className="flex w-max flex-col gap-0.5 whitespace-nowrap">
            <span className="flex w-max items-center gap-2 whitespace-nowrap">
              <span className={`text-sm font-semibold ${node.active ? 'text-slate-900' : 'text-slate-500'}`}>
                {primaryLabel}
              </span>
              {info?.sigla && (
                <span className="whitespace-nowrap text-xs text-slate-600" data-testid="org-unit-name">
                  {node.name}
                </span>
              )}
              {!node.active && (
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  inativa
                </span>
              )}
            </span>
            <span className="block whitespace-nowrap text-xs text-slate-500" data-testid="org-unit-holder">
              {titular ? titular.name : 'Sem titular'}
            </span>
          </span>
          <ExternalLink size={14} className="shrink-0 text-slate-400 group-hover:text-slate-600" aria-hidden />
        </button>

        {props.variant === 'manage' && (
          <Popover
            align="right"
            ariaLabel={`Ações de ${node.name}`}
            triggerClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 active:bg-slate-300"
            trigger={(menuOpen) => (
              <Ellipsis size={18} className={menuOpen ? 'text-slate-900' : undefined} aria-hidden />
            )}
          >
            {(close) => (
              <>
                <MenuItem onClick={() => { close(); props.onAddChild(node); }}>
                  <Plus size={15} /> Nova subunidade
                </MenuItem>
                <MenuItem onClick={() => { close(); props.onEdit(node); }}>
                  <Pencil size={15} /> Editar
                </MenuItem>
                <MenuDivider />
                <MenuItem destructive onClick={() => { close(); props.onDelete(node); }}>
                  <Trash2 size={15} /> Excluir
                </MenuItem>
              </>
            )}
          </Popover>
        )}
      </div>

      {open && hasChildren && (
        <ul
          id={childrenId}
          className="ms-5 mt-2 flex w-max flex-col items-start gap-2 border-s border-slate-200 ps-5"
          role="list"
          data-testid="org-unit-children"
        >
          {node.children.map((child) => (
            <OrgUnitTreeNode key={child.id} node={child} depth={depth + 1} props={props} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Círculo com a foto do titular; sem foto, usa o avatar genérico do produto. */
export function Avatar({ url, nome, size = 32 }: { url: string | null; nome: string; size?: number }) {
  const style = { width: size, height: size };
  if (url) {
    return <img src={url} alt={nome} style={style} className="shrink-0 rounded-full object-cover" data-testid="avatar" />;
  }
  return (
    <span
      style={style}
      data-testid="avatar"
      className="flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400"
    >
      <UserIcon size={Math.round(size * 0.5)} />
    </span>
  );
}

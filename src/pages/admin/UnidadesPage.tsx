import { useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useOrgUnitsTree,
  useCreateOrgUnit,
  useUpdateOrgUnit,
  useDeleteOrgUnit,
  type OrgUnitNode,
} from '@/lib/api/org-units';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput, Checkbox } from '@/components/ui/Field';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { slugify } from '@/lib/slugify';

/**
 * Admin › Configurações › Unidades — IF1.c. Árvore de unidades organizacionais
 * (`GET /api/v1/org-units/tree`) com criar (raiz ou filha), editar (nome/ativo)
 * e excluir (bloqueado pelo backend com 409 se tem filhos ou posições).
 */
export function UnidadesPage() {
  const tree = useOrgUnitsTree();
  const [createCtx, setCreateCtx] = useState<{ parentId: string | null; parentName?: string } | null>(null);
  const [editUnit, setEditUnit] = useState<OrgUnitNode | null>(null);
  const del = useDeleteOrgUnit();

  async function askDelete(unit: OrgUnitNode) {
    const ok = await confirm({
      title: 'Excluir unidade?',
      message: `"${unit.name}" será removida. Só é possível excluir unidades sem subunidades nem posições.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(unit.id);
      toast.success(`Unidade "${unit.name}" excluída.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        toast.error('Não dá para excluir: a unidade tem subunidades ou posições.');
      else toast.error('Falha ao excluir a unidade.');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Unidades organizacionais</h1>
        <button
          type="button"
          onClick={() => setCreateCtx({ parentId: null })}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          <Plus size={16} /> Nova unidade raiz
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {tree.isLoading && <p className="text-sm text-slate-400">Carregando...</p>}
        {!tree.isLoading && (tree.data?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Building2 size={26} />
            </div>
            <p className="text-sm font-medium text-slate-700">Nenhuma unidade ainda</p>
            <p className="mt-1 text-sm text-slate-500">Crie a primeira unidade (ex.: a secretaria ou o órgão).</p>
          </div>
        )}
        {tree.data && tree.data.length > 0 && (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {tree.data.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                onAddChild={(n) => setCreateCtx({ parentId: n.id, parentName: n.name })}
                onEdit={setEditUnit}
                onDelete={askDelete}
              />
            ))}
          </div>
        )}
      </div>

      {createCtx && <CreateUnitDialog ctx={createCtx} onClose={() => setCreateCtx(null)} />}
      {editUnit && <EditUnitDialog unit={editUnit} onClose={() => setEditUnit(null)} />}
    </div>
  );
}

function TreeNode({
  node, depth, onAddChild, onEdit, onDelete,
}: {
  node: OrgUnitNode;
  depth: number;
  onAddChild: (n: OrgUnitNode) => void;
  onEdit: (n: OrgUnitNode) => void;
  onDelete: (n: OrgUnitNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div
        className="group flex items-center gap-1 border-b border-slate-100 px-2 py-2 hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && setOpen((o) => !o)}
          className={`flex h-5 w-5 items-center justify-center rounded text-slate-400 ${hasChildren ? 'hover:bg-slate-200' : 'invisible'}`}
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <Building2 size={15} className="shrink-0 text-slate-400" />
        <span className={`text-sm font-medium ${node.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{node.name}</span>
        <code className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{node.key}</code>
        {!node.active && <span className="ml-1 rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-500">inativa</span>}

        <div className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button" onClick={() => onAddChild(node)} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" title="Nova subunidade">
            <Plus size={14} />
          </button>
          <button type="button" onClick={() => onEdit(node)} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" title="Editar">
            <Pencil size={14} />
          </button>
          <button type="button" onClick={() => onDelete(node)} className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700" title="Excluir">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {open && node.children.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  );
}

function CreateUnitDialog({ ctx, onClose }: { ctx: { parentId: string | null; parentName?: string }; onClose: () => void }) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const create = useCreateOrgUnit();

  function onName(v: string) {
    setName(v);
    if (!keyTouched) setKey(slugify(v));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ key, name, parentId: ctx.parentId ?? undefined });
      toast.success(`Unidade "${name}" criada.`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) toast.error('Já existe uma unidade com essa chave.');
      else toast.error('Não foi possível criar a unidade.');
    }
  }

  return (
    <Dialog open onClose={onClose} title={ctx.parentName ? `Nova subunidade de "${ctx.parentName}"` : 'Nova unidade raiz'} footer={
      <>
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button form="create-unit-form" type="submit" disabled={create.isPending || !name || !key}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Criar</button>
      </>
    }>
      <form id="create-unit-form" className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="Nome">
          <TextInput required autoFocus value={name} onChange={(e) => onName(e.target.value)} />
        </Field>
        <Field label="Chave" hint="Identificador estável (slug). É o que o modelador referencia como área.">
          <TextInput required value={key} onChange={(e) => { setKeyTouched(true); setKey(slugify(e.target.value)); }} />
        </Field>
      </form>
    </Dialog>
  );
}

function EditUnitDialog({ unit, onClose }: { unit: OrgUnitNode; onClose: () => void }) {
  const [name, setName] = useState(unit.name);
  const [active, setActive] = useState(unit.active);
  const update = useUpdateOrgUnit();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: unit.id, body: { name, active } });
      toast.success('Alterações salvas.');
      onClose();
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <Dialog open onClose={onClose} title="Editar unidade" footer={
      <>
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button form="edit-unit-form" type="submit" disabled={update.isPending}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Salvar</button>
      </>
    }>
      <form id="edit-unit-form" className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="Nome">
          <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Chave">
          <TextInput value={unit.key} readOnly className="bg-slate-50 text-slate-500" />
        </Field>
        <Checkbox checked={active} onChange={setActive} label="Unidade ativa" />
      </form>
    </Dialog>
  );
}

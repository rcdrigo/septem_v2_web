import { useEffect, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, ExternalLink, Pencil, Plus, Trash2, User as UserIcon } from 'lucide-react';
import {
  useOrgUnitsTree,
  useOrgUnitsFlat,
  useCreateOrgUnit,
  useUpdateOrgUnit,
  useDeleteOrgUnit,
  useOrgUnit,
  type OrgUnitFlat,
  type OrgUnitNode,
  type OrgUnitWrite,
} from '@/lib/api/org-units';
import { openTab } from '@/lib/nav';
import { Dialog } from '@/components/ui/Dialog';
import { UserCombobox } from '@/components/ui/UserCombobox';
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
  // A árvore não traz sigla/titular; o flat sim — casamos por id para exibir na linha.
  const flat = useOrgUnitsFlat();
  const byId = new Map((flat.data ?? []).map((u) => [u.id, u]));
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
                byId={byId}
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

/**
 * Linha da árvore (Fase 3): foto do titular no círculo, SIGLA em destaque, nome
 * como texto secundário e o nome do titular. Clicar abre o detalhe em aba própria.
 */
function TreeNode({
  node, depth, byId, onAddChild, onEdit, onDelete,
}: {
  node: OrgUnitNode;
  depth: number;
  byId: Map<string, OrgUnitFlat>;
  onAddChild: (n: OrgUnitNode) => void;
  onEdit: (n: OrgUnitNode) => void;
  onDelete: (n: OrgUnitNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const info = byId.get(node.id);
  const titular = info?.titular ?? null;

  return (
    <>
      <div
        className="group flex items-center gap-2 border-b border-slate-100 px-2 py-2 hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        data-testid="unidade-linha"
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

        <div className="ml-auto flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button type="button" onClick={() => openTab(`unidade?id=${node.id}`)} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" title="Abrir unidade" aria-label={`Abrir ${node.name}`}>
            <ExternalLink size={14} />
          </button>
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
        <TreeNode key={child.id} node={child} depth={depth + 1} byId={byId} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  );
}

/** Círculo com a foto do titular; sem foto, cai no avatar genérico. */
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

/** Campos cadastrais compartilhados por criar e editar (Fase 3). */
type UnitForm = {
  name: string;
  key: string;
  sigla: string;
  localizacao: string;
  objetivo: string;
  unidadeOrcamentaria: string;
  telefone: string;
  email: string;
  titularUserId: string;
  prepostoUserId: string;
  active: boolean;
};

const FORM_VAZIO: UnitForm = {
  name: '', key: '', sigla: '', localizacao: '', objetivo: '',
  unidadeOrcamentaria: '', telefone: '', email: '',
  titularUserId: '', prepostoUserId: '', active: true,
};

function toWrite(f: UnitForm): OrgUnitWrite {
  const b = (v: string) => (v.trim() ? v.trim() : null);
  return {
    name: f.name,
    sigla: b(f.sigla),
    localizacao: b(f.localizacao),
    objetivo: b(f.objetivo),
    unidadeOrcamentaria: b(f.unidadeOrcamentaria),
    telefone: b(f.telefone),
    email: b(f.email),
    titularUserId: f.titularUserId || null,
    prepostoUserId: f.prepostoUserId || null,
    active: f.active,
  };
}

/** Campos da unidade, usados nos dois diálogos. */
function UnitFields({
  form, set, keyReadOnly, onName,
}: {
  form: UnitForm;
  set: <K extends keyof UnitForm>(k: K, v: UnitForm[K]) => void;
  keyReadOnly?: boolean;
  onName: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Sigla" hint="Aparece em destaque nas listas.">
          <TextInput value={form.sigla} onChange={(e) => set('sigla', e.target.value)} name="sigla" placeholder="SEMED" />
        </Field>
        <Field label="Nome">
          <TextInput required value={form.name} onChange={(e) => onName(e.target.value)} name="name" />
        </Field>
      </div>

      <Field label="Chave" hint="Identificador estável (slug). É o que o modelador referencia como unidade organizacional.">
        <TextInput
          required
          value={form.key}
          readOnly={keyReadOnly}
          className={keyReadOnly ? 'bg-slate-50 text-slate-500' : undefined}
          onChange={(e) => set('key', slugify(e.target.value))}
          name="key"
        />
      </Field>

      <Field label="Objetivo">
        <textarea
          value={form.objetivo}
          onChange={(e) => set('objetivo', e.target.value)}
          rows={2}
          maxLength={1000}
          name="objetivo"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-500"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Localização">
          <TextInput value={form.localizacao} onChange={(e) => set('localizacao', e.target.value)} name="localizacao" />
        </Field>
        <Field label="Unidade orçamentária">
          <TextInput value={form.unidadeOrcamentaria} onChange={(e) => set('unidadeOrcamentaria', e.target.value)} name="unidadeOrcamentaria" />
        </Field>
        <Field label="Telefone">
          <TextInput value={form.telefone} onChange={(e) => set('telefone', e.target.value)} name="telefone" />
        </Field>
        <Field label="E-mail">
          <TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} name="email" />
        </Field>
      </div>

      <Field label="Titular" hint="Pode personificar os usuários desta unidade e subunidades.">
        <UserCombobox
          value={form.titularUserId}
          onChange={(v) => set('titularUserId', v)}
          placeholder="Selecionar titular…"
          clearLabel="Sem titular"
        />
      </Field>
      <Field label="Preposto" hint="Substitui o titular nas ausências.">
        <UserCombobox
          value={form.prepostoUserId}
          onChange={(v) => set('prepostoUserId', v)}
          placeholder="Selecionar preposto…"
          clearLabel="Sem preposto"
        />
      </Field>
    </div>
  );
}

function CreateUnitDialog({ ctx, onClose }: { ctx: { parentId: string | null; parentName?: string }; onClose: () => void }) {
  const [form, setForm] = useState<UnitForm>(FORM_VAZIO);
  const [keyTouched, setKeyTouched] = useState(false);
  const create = useCreateOrgUnit();

  const set = <K extends keyof UnitForm>(k: K, v: UnitForm[K]) => {
    if (k === 'key') setKeyTouched(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  function onName(v: string) {
    setForm((f) => ({ ...f, name: v, key: keyTouched ? f.key : slugify(v) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ ...toWrite(form), key: form.key, parentId: ctx.parentId ?? undefined });
      toast.success(`Unidade "${form.name}" criada.`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) toast.error('Já existe uma unidade com essa chave.');
      else toast.error('Não foi possível criar a unidade.');
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      width="lg"
      title={ctx.parentName ? `Nova subunidade de "${ctx.parentName}"` : 'Nova unidade raiz'}
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
          <button form="create-unit-form" type="submit" disabled={create.isPending || !form.name || !form.key}
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Criar</button>
        </>
      }
    >
      <form id="create-unit-form" onSubmit={submit} data-testid="form-unidade">
        <UnitFields form={form} set={set} onName={onName} />
      </form>
    </Dialog>
  );
}

function EditUnitDialog({ unit, onClose }: { unit: OrgUnitNode; onClose: () => void }) {
  const detail = useOrgUnit(unit.id);
  const update = useUpdateOrgUnit();
  const [form, setForm] = useState<UnitForm>({ ...FORM_VAZIO, name: unit.name, key: unit.key, active: unit.active });

  // O detalhe traz TODOS os campos (a árvore só tem nome/chave/ativo).
  useEffect(() => {
    const d = detail.data;
    if (!d) return;
    setForm({
      name: d.name,
      key: d.key,
      sigla: d.sigla ?? '',
      localizacao: d.localizacao ?? '',
      objetivo: d.objetivo ?? '',
      unidadeOrcamentaria: d.unidadeOrcamentaria ?? '',
      telefone: d.telefone ?? '',
      email: d.email ?? '',
      titularUserId: d.titular?.id ?? '',
      prepostoUserId: d.preposto?.id ?? '',
      active: d.active,
    });
  }, [detail.data]);

  const set = <K extends keyof UnitForm>(k: K, v: UnitForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: unit.id, body: toWrite(form) });
      toast.success('Alterações salvas.');
      onClose();
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  // A árvore só tem nome/chave/ativo: os demais campos vêm do detalhe, que é assíncrono.
  // Enquanto ele não chega, NÃO mostramos o formulário — se o usuário salvasse antes,
  // gravaria os campos em branco por cima da unidade (apagando sigla, contatos, titular…).
  const carregado = !!detail.data;

  return (
    <Dialog open onClose={onClose} width="lg" title="Editar unidade" footer={
      <>
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button form="edit-unit-form" type="submit" disabled={update.isPending || !carregado}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Salvar</button>
      </>
    }>
      {!carregado ? (
        <p className="py-8 text-center text-sm text-slate-500" data-testid="unidade-carregando">Carregando dados da unidade…</p>
      ) : (
        <form id="edit-unit-form" onSubmit={submit} data-testid="form-unidade">
          <UnitFields form={form} set={set} keyReadOnly onName={(v) => set('name', v)} />
          <div className="mt-3">
            <Checkbox checked={form.active} onChange={(v) => set('active', v)} label="Unidade ativa" />
          </div>
        </form>
      )}
    </Dialog>
  );
}

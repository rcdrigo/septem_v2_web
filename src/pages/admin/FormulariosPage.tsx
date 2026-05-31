import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  useFormsList, useForm, useCreateForm, useUpdateForm, useDeleteForm, useFormMasks,
  type FormListItem, type FormGroup, type FormField,
} from '@/lib/api/forms';
import { useDataSources } from '@/lib/api/catalog';
import { Field, TextInput, TextArea, Select, Checkbox } from '@/components/ui/Field';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { slugify } from '@/lib/slugify';

const FIELD_TYPES = ['textfield', 'textarea', 'number', 'select', 'checkbox', 'datetime', 'email'].map((t) => ({ value: t, label: t }));

/**
 * Admin › Configurações › Formulários (Forms F2). Builder próprio sobre as
 * tabelas forms/groups/fields. Rich-text do help_text, máscara-com-teste e
 * eventos entram em fatias seguintes.
 */
export function FormulariosPage() {
  const list = useFormsList();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const del = useDeleteForm();

  async function askDelete(f: FormListItem) {
    const ok = await confirm({ title: 'Excluir formulário?', message: `"${f.name}" será removido.`, confirmLabel: 'Excluir', cancelLabel: 'Cancelar', destructive: true });
    if (!ok) return;
    try { await del.mutateAsync(f.id); toast.success('Formulário excluído.'); } catch { toast.error('Falha ao excluir.'); }
  }

  if (editing) return <FormBuilder id={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Formulários</h1>
        <button type="button" onClick={() => setEditing('new')} className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"><Plus size={16} /> Novo formulário</button>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {!list.isLoading && (list.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><FileText size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhum formulário</p>
            <p className="mt-1 text-sm text-slate-500">Monte um formulário com grupos e campos para usar nos processos.</p>
          </div>
        ) : (
          <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2 text-left">Nome</th><th className="px-4 py-2 text-left">Versão</th><th className="px-4 py-2 w-20" /></tr></thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
              {list.data?.map((f) => (
                <tr key={f.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{f.name}</td>
                  <td className="px-4 py-2 text-slate-600">v{f.version}</td>
                  <td className="px-4 py-2"><div className="flex justify-end gap-1">
                    <button type="button" onClick={() => setEditing(f.id)} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"><Pencil size={15} /></button>
                    <button type="button" onClick={() => askDelete(f)} className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FormBuilder({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useForm(id);
  const create = useCreateForm();
  const update = useUpdateForm();
  const masks = useFormMasks();
  const dataSources = useDataSources();

  const [name, setName] = useState('');
  const [groups, setGroups] = useState<FormGroup[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [hydrated, setHydrated] = useState(!id);

  if (id && detail.data && !hydrated) {
    setName(detail.data.name); setGroups(detail.data.groups); setFields(detail.data.fields); setHydrated(true);
  }

  function addGroup() {
    setGroups([...groups, { key: '', name: '', order: groups.length, columns: 1 }]);
  }
  function addField() {
    setFields([...fields, { type: 'textfield', key: '', name: '', order: fields.length, columns: 1, isRequired: false, isVisibleReport: true, isVisibleRequester: true }]);
  }

  async function save() {
    const body = {
      name,
      groups: groups.filter((g) => g.name).map((g, i) => ({ ...g, key: slugify(g.name), order: i })),
      fields: fields.filter((f) => f.name).map((f, i) => ({ ...f, key: slugify(f.name), order: i })),
    };
    try {
      if (id) await update.mutateAsync({ id, body }); else await create.mutateAsync(body);
      toast.success(id ? 'Formulário salvo.' : `Formulário "${name}" criado.`);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) toast.error('Há campos com a mesma chave (nomes geram chaves iguais). Renomeie.');
      else toast.error('Não foi possível salvar o formulário.');
    }
  }

  const groupOptions = [{ value: '', label: '— sem grupo —' }, ...groups.filter((g) => g.name).map((g) => ({ value: slugify(g.name), label: g.name }))];
  const maskOptions = [{ value: '', label: '— nenhuma —' }, ...(masks.data ?? []).map((m) => ({ value: m.id, label: m.name }))];
  const dsOptions = [{ value: '', label: '— nenhuma —' }, ...(dataSources.data ?? []).map((d) => ({ value: d.id, label: d.name }))];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><ArrowLeft size={18} /></button>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do formulário" className="rounded-md border border-slate-300 px-2 py-1 text-base font-semibold text-slate-900 focus:border-slate-500 focus:outline-none" />
        </div>
        <button type="button" onClick={save} disabled={!name || create.isPending || update.isPending} className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Salvar</button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Agrupamentos</h2>
              <button type="button" onClick={addGroup} className="text-xs font-medium text-slate-600 hover:text-slate-900">+ grupo</button>
            </div>
            <div className="space-y-2">
              {groups.length === 0 && <p className="text-sm text-slate-400">Sem grupos — os campos ficam soltos no formulário.</p>}
              {groups.map((g, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
                  <TextInput value={g.name} placeholder="Nome do grupo" onChange={(e) => setGroups(groups.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <span className="shrink-0 text-xs text-slate-400">colunas</span>
                  <input type="number" min={1} max={4} value={g.columns} onChange={(e) => setGroups(groups.map((x, j) => j === i ? { ...x, columns: Number(e.target.value) || 1 } : x))} className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  <button type="button" onClick={() => setGroups(groups.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={15} /></button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Campos</h2>
              <button type="button" onClick={addField} className="text-xs font-medium text-slate-600 hover:text-slate-900">+ campo</button>
            </div>
            <div className="space-y-2">
              {fields.length === 0 && <p className="text-sm text-slate-400">Nenhum campo ainda.</p>}
              {fields.map((f, i) => (
                <FieldCard key={i} field={f} groupOptions={groupOptions} maskOptions={maskOptions} dsOptions={dsOptions}
                  onChange={(nf) => setFields(fields.map((x, j) => j === i ? nf : x))}
                  onRemove={() => setFields(fields.filter((_, j) => j !== i))} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function FieldCard({ field, groupOptions, maskOptions, dsOptions, onChange, onRemove }: {
  field: FormField;
  groupOptions: { value: string; label: string }[];
  maskOptions: { value: string; label: string }[];
  dsOptions: { value: string; label: string }[];
  onChange: (f: FormField) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<FormField>) => onChange({ ...field, ...patch });

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center gap-2 p-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded p-1 text-slate-400 hover:bg-slate-100">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
        <div className="w-36 shrink-0"><Select value={field.type} options={FIELD_TYPES} onChange={(e) => set({ type: e.target.value })} /></div>
        <TextInput value={field.name} placeholder="Rótulo do campo" onChange={(e) => set({ name: e.target.value })} />
        <div className="w-44 shrink-0"><Select value={field.groupKey ?? ''} options={groupOptions} onChange={(e) => set({ groupKey: e.target.value || null })} /></div>
        <label className="flex shrink-0 items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={field.isRequired} onChange={(e) => set({ isRequired: e.target.checked })} /> obrig.</label>
        <button type="button" onClick={onRemove} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={15} /></button>
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50 p-3">
          <Field label="Texto de ajuda"><TextArea rows={2} value={field.helpText ?? ''} onChange={(e) => set({ helpText: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Prefixo"><TextInput value={field.prefix ?? ''} onChange={(e) => set({ prefix: e.target.value })} /></Field>
            <Field label="Sufixo"><TextInput value={field.suffix ?? ''} onChange={(e) => set({ suffix: e.target.value })} /></Field>
            <Field label="Mín. caracteres"><TextInput type="number" value={field.minLength ?? ''} onChange={(e) => set({ minLength: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Máx. caracteres"><TextInput type="number" value={field.maxLength ?? ''} onChange={(e) => set({ maxLength: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="Colunas"><TextInput type="number" value={field.columns} onChange={(e) => set({ columns: Number(e.target.value) || 1 })} /></Field>
            <Field label="Largura"><TextInput type="number" value={field.width ?? ''} onChange={(e) => set({ width: e.target.value ? Number(e.target.value) : null })} /></Field>
          </div>
          <Field label="Máscara"><Select value={field.maskId ?? ''} options={maskOptions} onChange={(e) => set({ maskId: e.target.value || null })} /></Field>
          <Field label="Fonte de dados"><Select value={field.dataSourceId ?? ''} options={dsOptions} onChange={(e) => set({ dataSourceId: e.target.value || null })} /></Field>
          <div className="col-span-2 flex gap-4">
            <Checkbox checked={field.isVisibleReport} onChange={(v) => set({ isVisibleReport: v })} label="Visível no relatório" />
            <Checkbox checked={field.isVisibleRequester} onChange={(v) => set({ isVisibleRequester: v })} label="Visível ao requisitante" />
          </div>
        </div>
      )}
    </div>
  );
}

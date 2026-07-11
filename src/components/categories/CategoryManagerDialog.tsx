import { useState } from 'react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput } from '@/components/ui/Field';
import { IconSearchPicker } from '@/components/ui/IconSearchPicker';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import type { Category, CategoryInput } from '@/lib/api/catalog';

const DEFAULT_COLOR = '#0ea5e9';

type FormState = { id: number | null; name: string; description: string; color: string; icon: string };

const EMPTY_FORM: FormState = { id: null, name: '', description: '', color: DEFAULT_COLOR, icon: '' };

export type CategoryApi = {
  useList: () => UseQueryResult<Category[]>;
  useCreate: () => UseMutationResult<Category, unknown, CategoryInput>;
  useUpdate: () => UseMutationResult<Category, unknown, CategoryInput & { id: number }>;
  useDelete: () => UseMutationResult<unknown, unknown, number>;
};

/**
 * Modal genérico de CRUD de categorias (name, description, color HEX, icon FA).
 * Processos e Relatórios têm listas PRÓPRIAS — cada tela injeta seus hooks via
 * `api` (mesmo shape de request/response nos dois backends).
 */
export function CategoryManagerDialog({
  title,
  inUseHint,
  api,
  onClose,
}: {
  title: string;
  /** Aviso exibido na confirmação de exclusão (quem bloqueia: processos/relatórios). */
  inUseHint: string;
  api: CategoryApi;
  onClose: () => void;
}) {
  const list = api.useList();
  const createMut = api.useCreate();
  const updateMut = api.useUpdate();
  const deleteMut = api.useDelete();

  const [form, setForm] = useState<FormState | null>(null);
  const saving = createMut.isPending || updateMut.isPending;

  function startEdit(c: Category) {
    setForm({ id: c.id, name: c.name, description: c.description ?? '', color: c.color ?? DEFAULT_COLOR, icon: c.icon ?? '' });
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error('Informe o nome da categoria.');
      return;
    }
    const input: CategoryInput = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      color: form.color || undefined,
      icon: form.icon || undefined,
    };
    try {
      if (form.id == null) {
        await createMut.mutateAsync(input);
        toast.success('Categoria criada.');
      } else {
        await updateMut.mutateAsync({ id: form.id, ...input });
        toast.success('Categoria atualizada.');
      }
      setForm(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.detail ?? err.message) : 'Falha ao salvar a categoria.');
    }
  }

  async function remove(c: Category) {
    const ok = await confirm({
      title: 'Excluir categoria?',
      message: `"${c.name}" será removida. ${inUseHint}`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(c.id);
      toast.success('Categoria excluída.');
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.detail ?? err.message) : 'Falha ao excluir a categoria.');
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      width="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Concluído
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {form === null && (
          <>
            <button
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus size={15} /> Nova categoria
            </button>

            {(list.data?.length ?? 0) === 0 && !list.isLoading && (
              <p className="text-sm text-slate-500">Nenhuma categoria cadastrada.</p>
            )}

            <ul className="flex flex-col gap-2">
              {list.data?.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
                    style={{ backgroundColor: c.color ?? '#64748b' }}
                  >
                    {c.icon?.includes('fa-') ? <i className={c.icon} /> : <Tags size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                    {c.description && <p className="truncate text-xs text-slate-500">{c.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    aria-label={`Editar ${c.name}`}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    aria-label={`Excluir ${c.name}`}
                    className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {form !== null && (
          <div className="flex flex-col gap-3">
            <Field label="Nome">
              <TextInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: Obras Públicas"
              />
            </Field>
            <Field label="Descrição">
              <TextInput
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Opcional"
              />
            </Field>
            {/* Cor + ícone lado a lado no desktop; empilhados no mobile */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Cor" hint="Herdada pelos itens da categoria.">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Cor da categoria"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                  />
                  <TextInput
                    className="w-full min-w-0"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    placeholder="#0ea5e9"
                  />
                </div>
              </Field>
              <Field label="Ícone">
                <IconSearchPicker value={form.icon || undefined} onChange={(next) => setForm({ ...form, icon: next ?? '' })} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {form.id == null ? 'Criar categoria' : 'Salvar alterações'}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

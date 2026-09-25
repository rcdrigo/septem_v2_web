import { useEffect, useMemo, useState } from 'react';
import { History, Pencil, Plus, RotateCcw, Tag, Trash2, X } from 'lucide-react';
import { PaletteField } from '@/components/ui/PaletteField';
import { Dialog } from '@/components/ui/Dialog';
import { confirm } from '@/components/ui/ConfirmDialog';
import { TextInput } from '@/components/ui/Field';
import { ApiError } from '@/lib/api';
import {
  normalizeTagName,
  useExecutionTags,
  useSaveExecutionTags,
  useTagsAccess,
  type TagSnapshot,
} from '@/lib/api/tags';
import { toast } from '@/stores/toast';
import { ExecutionTagHistoryDialog } from './TagHistory';
import { DEFAULT_TAG_COLOR, normalizeTagColor, tagColorStyle } from './tagColor';

type DraftTag = {
  id: string;
  name: string;
  originalName: string;
  color: string;
  originalColor: string;
  selected: boolean;
  originallySelected: boolean;
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
};

function draftFromSnapshot(snapshot: TagSnapshot): DraftTag[] {
  const selectedIds = new Set(snapshot.tags.map((tag) => tag.id));
  return snapshot.catalog.map((tag) => ({
    id: tag.id,
    name: tag.name,
    originalName: tag.name,
    color: tag.color ?? DEFAULT_TAG_COLOR,
    originalColor: tag.color ?? DEFAULT_TAG_COLOR,
    selected: selectedIds.has(tag.id),
    originallySelected: selectedIds.has(tag.id),
    isNew: false,
    deleted: false,
    editing: false,
  }));
}

function validationError(tags: readonly DraftTag[]): string | null {
  const seen = new Set<string>();
  for (const tag of tags) {
    if (tag.deleted) continue;
    if (!normalizeTagColor(tag.color)) return 'Informe uma cor hexadecimal válida, como #0ea5e9.';
    const name = tag.name.trim();
    if (!name) return 'O nome da tag não pode ficar vazio.';
    if (name.length > 50) return 'O nome da tag deve ter no máximo 50 caracteres.';
    const normalized = normalizeTagName(name);
    if (seen.has(normalized)) return `Já existe uma tag chamada “${name}” neste processo.`;
    seen.add(normalized);
  }
  return null;
}

function hasDraftChanges(tags: readonly DraftTag[]): boolean {
  return tags.some((tag) => (
    (tag.isNew && tag.selected)
    || tag.deleted
    || tag.selected !== tag.originallySelected
    || tag.name.trim() !== tag.originalName
    || normalizeTagColor(tag.color) !== normalizeTagColor(tag.originalColor)
  ));
}

function TagColorField({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  return <PaletteField label={label} value={normalizeTagColor(value) ?? DEFAULT_TAG_COLOR} onChange={onChange} disabled={disabled} compact />;
}

function TagsEditorDialog({
  executionId,
  onClose,
}: {
  executionId: string | number;
  onClose: () => void;
}) {
  const query = useExecutionTags(executionId);
  const saveMutation = useSaveExecutionTags(executionId);
  const [baseline, setBaseline] = useState<TagSnapshot | null>(null);
  const [draft, setDraft] = useState<DraftTag[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_TAG_COLOR);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conflictNeedsReview, setConflictNeedsReview] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!query.data || baseline) return;
    setBaseline(query.data);
    setDraft(draftFromSnapshot(query.data));
  }, [baseline, query.data]);

  const error = useMemo(() => validationError(draft), [draft]);
  const dirty = useMemo(() => hasDraftChanges(draft), [draft]);

  function closeTopDialog() {
    if (saveMutation.isPending || confirmingDelete) return;
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    onClose();
  }

  function addOrReuse() {
    if (saveMutation.isPending) return;
    const name = newName.trim();
    if (!name) {
      toast.error('Informe o nome da tag.');
      return;
    }
    if (name.length > 50) {
      toast.error('O nome da tag deve ter no máximo 50 caracteres.');
      return;
    }
    const normalized = normalizeTagName(name);
    const existing = draft.find((tag) => normalizeTagName(tag.name) === normalized);
    if (existing) {
      setDraft((current) => current.map((tag) => tag.id === existing.id
        ? { ...tag, selected: true, deleted: false }
        : tag));
      setNewName('');
      return;
    }
    const color = normalizeTagColor(newColor);
    if (!color) {
      toast.error('Informe uma cor hexadecimal válida, como #0ea5e9.');
      return;
    }
    setDraft((current) => [...current, {
      id: `new:${crypto.randomUUID()}`,
      name,
      originalName: name,
      color,
      originalColor: color,
      selected: true,
      originallySelected: false,
      isNew: true,
      deleted: false,
      editing: false,
    }]);
    setNewName('');
  }

  function setSelected(id: string, selected: boolean) {
    if (saveMutation.isPending) return;
    setDraft((current) => current.flatMap((tag) => {
      if (tag.id !== id) return [tag];
      if (tag.isNew && !selected) return [];
      return [{ ...tag, selected }];
    }));
  }

  function updateName(id: string, name: string) {
    if (saveMutation.isPending) return;
    setDraft((current) => current.map((tag) => tag.id === id ? { ...tag, name } : tag));
  }

  async function deleteGlobally(tag: DraftTag) {
    if (saveMutation.isPending) return;
    if (tag.isNew) {
      setDraft((current) => current.filter((item) => item.id !== tag.id));
      return;
    }
    setConfirmingDelete(true);
    let accepted = false;
    try {
      accepted = await confirm({
        title: 'Excluir tag do processo?',
        message: `“${tag.name}” será removida de todas as execuções associadas, inclusive encerradas e aquelas às quais você não tem acesso. O histórico será preservado.`,
        confirmLabel: 'Excluir tag do processo',
        cancelLabel: 'Cancelar',
        destructive: true,
      });
    } finally {
      setConfirmingDelete(false);
    }
    if (!accepted) return;
    setDraft((current) => current.map((item) => item.id === tag.id
      ? { ...item, deleted: true, selected: false, editing: false }
      : item));
  }

  async function save() {
    if (!baseline) return;
    const currentError = validationError(draft);
    if (currentError) {
      toast.error(currentError);
      return;
    }
    try {
      await saveMutation.mutateAsync({
        executionRevision: baseline.executionRevision,
        catalogRevision: baseline.catalogRevision,
        selectedTagIds: draft
          .filter((tag) => tag.selected && !tag.deleted && !tag.isNew)
          .map((tag) => tag.id),
        createNames: [],
        createTags: draft
          .filter((tag) => tag.isNew && tag.selected && !tag.deleted)
          .map((tag) => ({ name: tag.name.trim(), color: normalizeTagColor(tag.color)! })),
        colorUpdates: draft
          .filter((tag) => !tag.isNew && !tag.deleted && normalizeTagColor(tag.color) !== normalizeTagColor(tag.originalColor))
          .map((tag) => ({ id: tag.id, color: normalizeTagColor(tag.color)! })),
        renames: draft
          .filter((tag) => !tag.isNew && !tag.deleted && tag.name.trim() !== tag.originalName)
          .map((tag) => ({ id: tag.id, name: tag.name.trim() })),
        deleteTagIds: draft.filter((tag) => !tag.isNew && tag.deleted).map((tag) => tag.id),
      });
      toast.success('Tags atualizadas.');
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        const current = caught.body?.current as TagSnapshot | undefined;
        if (current?.catalog && current.tags) {
          setBaseline(current);
          setDraft(draftFromSnapshot(current));
        } else {
          const refreshed = await query.refetch();
          if (refreshed.data) {
            setBaseline(refreshed.data);
            setDraft(draftFromSnapshot(refreshed.data));
          }
        }
        setConflictNeedsReview(true);
        toast.warning('As tags foram alteradas por outra pessoa. Os dados atuais foram recarregados.');
        return;
      }
      toast.error(caught instanceof ApiError
        ? (caught.detail ?? caught.message)
        : 'Não foi possível salvar as tags.');
    }
  }

  return (
    <Dialog
      open
      onClose={closeTopDialog}
      title="Tags da execução"
      width="lg"
      footer={
        <>
          <button
            type="button"
            aria-label="Histórico de tags"
            onClick={() => setHistoryOpen(true)}
            disabled={saveMutation.isPending || confirmingDelete}
            className="mr-auto inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <History size={15} aria-hidden="true" /> <span className="hidden sm:inline">Histórico de tags</span>
          </button>
          <button
            type="button"
            onClick={closeTopDialog}
            disabled={saveMutation.isPending || confirmingDelete}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!baseline || !dirty || !!error || saveMutation.isPending || conflictNeedsReview}
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Salvando…' : 'Salvar tags'}
          </button>
        </>
      }
    >
      {query.isLoading && <p className="py-8 text-center text-sm text-slate-500">Carregando tags…</p>}
      {query.isError && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-rose-700">Não foi possível carregar as tags desta execução.</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw size={14} aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      )}

      {baseline && (
        <div className={`flex flex-col gap-4 ${saveMutation.isPending ? 'pointer-events-none opacity-70' : ''}`} aria-busy={saveMutation.isPending || undefined}>
          {conflictNeedsReview && (
            <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p>Outra pessoa alterou estas tags. Recarregamos os dados atuais; revise-os antes de salvar novamente.</p>
              <button
                type="button"
                onClick={() => setConflictNeedsReview(false)}
                className="mt-2 rounded-md border border-amber-400 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-amber-100"
              >
                Dados revisados
              </button>
            </div>
          )}

          <div>
            <label htmlFor="new-tag-name" className="mb-1.5 block text-sm font-medium text-slate-800">
              Nome da tag
            </label>
            <div className="flex gap-2">
              <TextInput
                id="new-tag-name"
                value={newName}
                maxLength={50}
                placeholder="Nome da nova tag"
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addOrReuse();
                  }
                }}
                className="min-w-0 flex-1"
                list="tag-catalog-options"
              />
              <datalist id="tag-catalog-options">
                {draft.filter((tag) => !tag.deleted).map((tag) => <option key={tag.id} value={tag.name} />)}
              </datalist>
              <TagColorField label="Cor da nova tag" value={newColor} onChange={setNewColor} disabled={saveMutation.isPending} />
              <button
                type="button"
                aria-label="Adicionar"
                onClick={addOrReuse}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                <Plus size={15} aria-hidden="true" /> <span className="hidden sm:inline">Adicionar</span>
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">A nova tag será cadastrada no processo e associada a esta execução ao salvar. Um nome existente reutiliza a tag e sua cor.</p>
          </div>

          {[
            { key: 'selected', title: 'Associadas a esta execução', description: 'Identificam esta requisição. Remover a associação mantém a tag disponível no processo.', items: draft.filter(tag => tag.selected && !tag.deleted), empty: 'Nenhuma tag associada a esta execução.' },
            { key: 'catalog', title: 'Disponíveis no processo', description: 'Tags cadastradas que você pode associar a esta execução. Editar nome, cor ou excluir altera o cadastro para todas as execuções.', items: draft.filter(tag => !tag.selected && !tag.deleted), empty: 'Nenhuma outra tag disponível no processo.' },
            { key: 'deleted', title: 'Exclusões pendentes', description: 'Estas tags serão excluídas do processo ao salvar.', items: draft.filter(tag => tag.deleted), empty: '' },
          ].filter(group => group.key !== 'deleted' || group.items.length > 0).map(group => (
            <section key={group.key} aria-labelledby={`tags-${group.key}`} className="border-t border-slate-200 pt-4">
              <h3 id={`tags-${group.key}`} className="text-sm font-semibold text-slate-900">{group.title} <span className="ml-1 font-normal text-slate-500">({group.items.length})</span></h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{group.description}</p>
              {group.items.length === 0 ? <p className="mt-3 text-sm text-slate-500">{group.empty}</p> : <ul className="mt-3 divide-y divide-slate-100">
              {group.items.map((tag) => (
                <li key={tag.id} className={`py-3 first:pt-0 last:pb-0 ${tag.deleted ? 'text-rose-700' : ''}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <Tag size={15} style={{ color: normalizeTagColor(tag.color) ?? DEFAULT_TAG_COLOR }} className={tag.deleted ? 'text-rose-400' : 'text-slate-400'} aria-hidden="true" />
                    {tag.editing ? (
                      <TextInput
                        autoFocus
                        aria-label="Novo nome da tag"
                        value={tag.name}
                        maxLength={50}
                        onChange={(event) => updateName(tag.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            event.stopPropagation();
                            setDraft((current) => current.map((item) => item.id === tag.id ? { ...item, editing: false } : item));
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            setDraft((current) => current.map((item) => item.id === tag.id ? { ...item, name: item.originalName, editing: false } : item));
                          }
                        }}
                        className="min-w-0 flex-1"
                      />
                    ) : (
                      <span style={tag.deleted ? undefined : tagColorStyle(tag.color)} className={`min-w-0 max-w-full truncate rounded-full px-2.5 py-1 text-sm font-medium ${tag.deleted ? 'text-rose-700 line-through' : 'text-slate-800'}`}>
                        {tag.name}
                      </span>
                    )}
                    <span className="flex-1" />
                    {tag.isNew && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">Nova</span>}

                    {tag.deleted ? (
                      <button
                        type="button"
                        onClick={() => setDraft((current) => current.map((item) => item.id === tag.id ? { ...item, deleted: false } : item))}
                        className="inline-flex min-h-8 items-center gap-1 rounded px-2 text-xs font-medium text-slate-600 hover:bg-white"
                      >
                        <RotateCcw size={13} aria-hidden="true" /> Desfazer exclusão
                      </button>
                    ) : (
                      <>
                        {!tag.isNew && (
                          <button
                            type="button"
                            aria-label={`Renomear ${tag.name}`}
                            title="Editar nome e cor no processo"
                            onClick={() => setDraft((current) => current.map((item) => item.id === tag.id ? { ...item, editing: !item.editing } : item))}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={tag.isNew ? `Remover nova tag ${tag.name}` : `Excluir tag do processo: ${tag.name}`}
                          title={tag.isNew ? 'Remover nova tag' : 'Excluir tag do processo'}
                          onClick={() => void deleteGlobally(tag)}
                          className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          {tag.isNew ? <X size={14} aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                        </button>
                      </>
                    )}
                  </div>

                  {!tag.deleted && (tag.editing || tag.isNew) && (
                    <div className="mt-2 flex items-center gap-2"><span className="text-xs text-slate-600">Cor no processo</span><TagColorField label={`Cor da tag ${tag.name}`} value={tag.color} disabled={saveMutation.isPending} onChange={(color) => setDraft((current) => current.map((item) => item.id === tag.id ? { ...item, color } : item))} /></div>
                  )}

                  {!tag.deleted && !tag.isNew && (tag.name.trim() !== tag.originalName || normalizeTagColor(tag.color) !== normalizeTagColor(tag.originalColor)) && (
                    <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                      Alterar o nome ou a cor modifica esta tag em todas as execuções do processo, inclusive encerradas e aquelas às quais você não tem acesso.
                    </p>
                  )}

                  {!tag.deleted && (
                    <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
                      {tag.selected ? (
                        <button
                          type="button"
                          onClick={() => setSelected(tag.id, false)}
                          className="text-xs font-medium text-rose-700 hover:underline"
                        >
                          Remover desta execução
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelected(tag.id, true)}
                          className="text-xs font-medium text-sky-700 hover:underline"
                        >
                          Adicionar a esta execução
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
              </ul>}
            </section>
          ))}

          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        </div>
      )}

      {historyOpen && (
        <ExecutionTagHistoryDialog executionId={executionId} onClose={() => setHistoryOpen(false)} />
      )}
    </Dialog>
  );
}

export type TagsButtonProps = {
  executionId: string | number;
  className?: string;
  /** Controlled state, useful when the trigger lives inside a native dialog. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Set false to render only the controlled editor dialog. */
  trigger?: boolean;
};

export function TagsButton({
  executionId,
  className = '',
  open: controlledOpen,
  onOpenChange,
  trigger = true,
}: TagsButtonProps) {
  const hasAccess = useTagsAccess();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  function setOpen(next: boolean) {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  if (!hasAccess) return null;

  return (
    <>
      {trigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 ${className}`}
        >
          <Tag size={15} aria-hidden="true" /> Tags
        </button>
      )}
      {open && <TagsEditorDialog executionId={executionId} onClose={() => setOpen(false)} />}
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useManuals, useManual, useManualCategories, useManualParents,
  useCreateManual, useUpdateManual, useDeleteManual, useCreateManualCategory,
  type ManualAudience, type ManualListItem, type ManualWrite,
} from '@/lib/api/manuals';
import { useOrgUnitsFlat } from '@/lib/api/org-units';
import { useSessionStore } from '@/stores/session';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput, Select, Checkbox } from '@/components/ui/Field';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { IconSearchPicker } from '@/components/ui/IconSearchPicker';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { openTab } from '@/lib/nav';

const AUDIENCE_OPTIONS = [
  { value: 'externo', label: 'Externo (público)' },
  { value: 'interno', label: 'Interno' },
  { value: 'ambos', label: 'Ambos' },
];

/**
 * Admin › Configurações › Manuais (Fase 10). Lista com abas Manuais/Técnico (a aba
 * Técnico só aparece para quem tem manuals:technical) e um editor com categoria inline,
 * artigo-pai (que trava a categoria), público, unidades (quando inclui interno), ícone,
 * conteúdo rich-text (imagem/vídeo por URL + HTML) e publicar.
 */
export function ManuaisPage() {
  const canTechnical = useSessionStore((s) => s.can('manuals:technical'));
  const [tab, setTab] = useState<'normal' | 'tecnico'>('normal');
  const list = useManuals();
  const del = useDeleteManual();

  const visible = (list.data ?? []).filter((m) => (tab === 'tecnico' ? m.isTechnical : !m.isTechnical));

  async function askDelete(m: ManualListItem) {
    const ok = await confirm({ title: 'Excluir manual?', message: `"${m.title}" será removido.`, confirmLabel: 'Excluir', cancelLabel: 'Cancelar', destructive: true });
    if (!ok) return;
    try { await del.mutateAsync(m.id); toast.success('Manual excluído.'); } catch { toast.error('Falha ao excluir.'); }
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">Manuais</h1>
          <p className="mt-0.5 text-sm text-slate-500">Conteúdo do guia (Guide) por categoria, público e unidade.</p>
        </div>
        <button type="button" data-testid="novo-manual" onClick={() => openTab(`/manual/nova${tab === 'tecnico' ? '?tecnico=1' : ''}`)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700">
          <Plus size={16} /> Novo manual
        </button>
      </header>

      {canTechnical && (
        <div className="flex border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
          <TabBtn active={tab === 'normal'} onClick={() => setTab('normal')} icon={<BookOpen size={14} />}>Manuais</TabBtn>
          <TabBtn active={tab === 'tecnico'} onClick={() => setTab('tecnico')} icon={<FlaskConical size={14} />}>Técnico</TabBtn>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {list.isLoading ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><BookOpen size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhum manual {tab === 'tecnico' ? 'técnico' : ''} ainda</p>
            <p className="mt-1 text-sm text-slate-500">Crie o primeiro em "Novo manual".</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="lista-manuais">
            {visible.map((m) => (
              <li key={m.id} className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {m.icon && <i className={m.icon} aria-hidden="true" />}<span className="truncate">{m.categoryName}</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" aria-label="Editar" onClick={() => openTab(`/manual/${m.id}`)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Pencil size={15} /></button>
                    <button type="button" aria-label="Excluir" onClick={() => askDelete(m)} className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                  </div>
                </div>
                <h2 className="mt-3 truncate text-sm font-bold text-slate-900">{m.title}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 text-xs">
                  <Badge tone={m.published ? 'green' : 'slate'}>{m.published ? 'Publicado' : 'Rascunho'}</Badge>
                  <Badge tone="slate">{AUDIENCE_OPTIONS.find((a) => a.value === m.audience)?.label ?? m.audience}</Badge>
                  {m.isTechnical && <Badge tone="amber">Técnico</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
      {icon}{children}
    </button>
  );
}

function Badge({ tone, children }: { tone: 'green' | 'amber' | 'slate'; children: React.ReactNode }) {
  const cls = tone === 'green' ? 'bg-emerald-100 text-emerald-700' : tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${cls}`}>{children}</span>;
}

type FormState = {
  title: string; contentHtml: string; categoryId: string; parentId: string;
  audience: ManualAudience; icon: string; isTechnical: boolean; published: boolean; orgUnitIds: string[];
};

const EMPTY: FormState = { title: '', contentHtml: '', categoryId: '', parentId: '', audience: 'externo', icon: '', isTechnical: false, published: false, orgUnitIds: [] };

export function ManualEditor({ id, defaultTechnical, canTechnical, onClose, fullPage }: {
  id: string | null; defaultTechnical: boolean; canTechnical: boolean; onClose: () => void; fullPage?: boolean;
}) {
  const detail = useManual(id);
  const categories = useManualCategories();
  const parents = useManualParents(id ?? undefined);
  const units = useOrgUnitsFlat();
  const create = useCreateManual();
  const update = useUpdateManual();
  const createCategory = useCreateManualCategory();
  const [form, setForm] = useState<FormState>({ ...EMPTY, isTechnical: defaultTechnical });
  const [ready, setReady] = useState(id === null);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState('');

  // Só carrega o form quando o detalhe chega (evita salvar-antes-de-carregar).
  useEffect(() => {
    if (id && detail.data) {
      const d = detail.data;
      setForm({
        title: d.title, contentHtml: d.contentHtml ?? '', categoryId: d.categoryId, parentId: d.parentId ?? '',
        audience: d.audience, icon: d.icon ?? '', isTechnical: d.isTechnical, published: d.published, orgUnitIds: d.orgUnitIds ?? [],
      });
      setReady(true);
    }
  }, [id, detail.data]);

  // Artigo-pai trava a categoria: ela é herdada do pai (regra manuais:7).
  const parentCategoryId = useMemo(() => {
    if (!form.parentId) return null;
    return parents.data?.find((p) => p.id === form.parentId)?.categoryId ?? null;
  }, [form.parentId, parents.data]);
  useEffect(() => {
    if (parentCategoryId && parentCategoryId !== form.categoryId) setForm((f) => ({ ...f, categoryId: parentCategoryId }));
  }, [parentCategoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const showUnits = form.audience !== 'externo'; // interno/ambos → escolher unidades (vazio = todas)

  async function submitCategory() {
    const name = catName.trim();
    if (!name) { toast.error('Informe o nome da categoria.'); return; }
    try {
      const { id: newId } = await createCategory.mutateAsync({ name });
      setForm((f) => ({ ...f, categoryId: newId }));
      setCatOpen(false);
      setCatName('');
      toast.success('Categoria criada.');
    } catch { toast.error('Não foi possível criar a categoria.'); }
  }

  async function save() {
    if (!form.title.trim()) { toast.error('Informe o título.'); return; }
    if (!form.parentId && !form.categoryId) { toast.error('Escolha uma categoria.'); return; }
    const body: ManualWrite = {
      title: form.title.trim(),
      contentHtml: form.contentHtml,
      categoryId: form.parentId ? undefined : form.categoryId,
      parentId: form.parentId || undefined,
      audience: form.audience,
      icon: form.icon || undefined,
      isTechnical: form.isTechnical,
      published: form.published,
      orgUnitIds: showUnits ? form.orgUnitIds : [],
    };
    try {
      if (id) await update.mutateAsync({ id, body });
      else await create.mutateAsync(body);
      toast.success(id ? 'Manual atualizado.' : 'Manual criado.');
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError && (err.body as { error?: string })?.error;
      toast.error(msg === 'category_required' ? 'Escolha uma categoria.' : 'Não foi possível salvar o manual.');
    }
  }

  const busy = create.isPending || update.isPending;

  const title = id ? 'Editar manual' : 'Novo manual';
  const footer = (
    <>
      <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
      <button type="button" data-testid="salvar-manual" disabled={busy || !ready} onClick={save}
        className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">{busy ? 'Salvando…' : 'Salvar'}</button>
    </>
  );
  const content = (
    <>
      {!ready ? <p className="p-4 text-sm text-slate-400">Carregando…</p> : (
        <div className="grid gap-4">
          <Field label="Título"><TextInput data-testid="manual-titulo" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Como abrir uma requisição" /></Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Artigo-pai (opcional)" hint="Agrupa o manual sob outro; herda a categoria dele.">
              <Select data-testid="manual-pai" value={form.parentId} placeholder="Sem artigo-pai"
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                options={(parents.data ?? []).filter((p) => canTechnical || !p.isTechnical).map((p) => ({ value: p.id, label: p.title }))} />
            </Field>
            <Field label="Categoria">
              <div className="flex gap-2">
                <Select data-testid="manual-categoria" value={form.categoryId} placeholder="Escolha…" disabled={!!form.parentId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
                {!form.parentId && (
                  <button type="button" data-testid="nova-categoria" onClick={() => { setCatName(''); setCatOpen(true); }} title="Nova categoria"
                    className="shrink-0 rounded-md border border-slate-300 px-2.5 text-sm text-slate-700 hover:bg-slate-50"><Plus size={16} /></button>
                )}
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Público">
              <Select data-testid="manual-publico" value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value as ManualAudience })} options={AUDIENCE_OPTIONS} />
            </Field>
            <Field label="Ícone"><IconSearchPicker value={form.icon || undefined} onChange={(next) => setForm({ ...form, icon: next ?? '' })} /></Field>
          </div>

          {showUnits && (
            <Field label="Unidades organizacionais" hint="Nenhuma marcada = visível a todas as unidades.">
              <div data-testid="manual-unidades" className="max-h-40 overflow-auto rounded-md border border-slate-200 p-2">
                {(units.data ?? []).map((u) => {
                  const checked = form.orgUnitIds.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-2 py-1 text-sm text-slate-700">
                      <input type="checkbox" checked={checked}
                        onChange={(e) => setForm((f) => ({ ...f, orgUnitIds: e.target.checked ? [...f.orgUnitIds, u.id] : f.orgUnitIds.filter((x) => x !== u.id) }))} />
                      {u.name}
                    </label>
                  );
                })}
                {(units.data ?? []).length === 0 && <p className="py-1 text-xs text-slate-400">Nenhuma unidade cadastrada.</p>}
              </div>
            </Field>
          )}

          <Field label="Conteúdo" hint="Formate o texto, insira imagens/vídeos por URL ou edite o HTML.">
            <RichTextEditor value={form.contentHtml} enableMedia enableHtmlSource onChange={(html) => setForm((f) => ({ ...f, contentHtml: html }))} />
          </Field>

          <div className="flex flex-wrap items-center gap-4">
            <Checkbox checked={form.published} onChange={(v) => setForm({ ...form, published: v })} label="Publicar" />
            {canTechnical && <Checkbox checked={form.isTechnical} onChange={(v) => setForm({ ...form, isTechnical: v })} label="Manual técnico" />}
          </div>
        </div>
      )}
    </>
  );

  const catModal = catOpen && (
    <Dialog open onClose={() => setCatOpen(false)} width="sm" title="Nova categoria"
      footer={<>
        <button type="button" onClick={() => setCatOpen(false)} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button type="button" data-testid="nova-categoria-salvar" disabled={createCategory.isPending} onClick={submitCategory}
          className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">Criar</button>
      </>}>
      <Field label="Nome da categoria">
        <TextInput data-testid="nova-categoria-nome" autoFocus value={catName}
          onChange={(e) => setCatName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitCategory(); }}
          placeholder="Ex.: Primeiros passos" />
      </Field>
    </Dialog>
  );

  if (fullPage) {
    return (
      <div className="flex h-screen flex-col bg-slate-100">
        <header className="border-b border-slate-200 bg-white px-6 py-4"><h1 className="text-lg font-semibold text-slate-900">{title}</h1></header>
        <main className="flex-1 overflow-auto p-6"><div className="mx-auto w-full max-w-4xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">{content}</div></main>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">{footer}</footer>
        {catModal}
      </div>
    );
  }
  return (
    <Dialog open onClose={onClose} width="xl" title={title} footer={footer}>
      {content}
      {catModal}
    </Dialog>
  );
}

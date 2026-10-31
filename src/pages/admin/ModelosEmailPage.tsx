import { useState } from 'react';
import { Mail, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import {
  useEmailTemplatesList, useEmailTemplate, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate,
  useTestEmailTemplate,
  type EmailTemplateListItem, type Recipient, type RecipientType, type RecipientKind,
} from '@/lib/api/email-templates';
import { ApiError } from '@/lib/api';
import { useAreas, useAreaPositions } from '@/lib/api/catalog';
import { useUsersList } from '@/lib/api/users';
import { FormSection } from '@/components/ui/FormSection';
import { CombinedSearch, useCombinedSearch, type SearchColumn } from '@/components/ui/CombinedSearch';
import { openTab } from '@/lib/nav';
import { routes } from '@/lib/routes';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ContextHelp } from '@/components/guide/ContextHelp';

const TYPE_OPTIONS: { value: RecipientType; label: string }[] = [
  { value: 'requester', label: 'Requisitante' },
  { value: 'position', label: 'Posição' },
  { value: 'dynamic', label: 'Usuário dinâmico (campo)' },
  { value: 'fixedUser', label: 'Usuário fixo' },
  { value: 'fixedAddress', label: 'Endereço fixo' },
  { value: 'sql', label: 'Customizado (SQL)' },
];
const KIND_OPTIONS: { value: RecipientKind; label: string }[] = [{ value: 'to', label: 'Para' }, { value: 'cc', label: 'Cópia' }, { value: 'bcc', label: 'Cópia oculta' }];

/** Admin › Configurações › Modelos de e-mail (T2). Lista + editor com assunto,
 * corpo, anexos (campos do form) e destinatários to/cc/bcc nos 6 tipos. */
export function ModelosEmailPage() {
  const list = useEmailTemplatesList();
  const columns: SearchColumn<EmailTemplateListItem>[] = [
    { key: 'name', label: 'Nome', value: row => row.name },
    { key: 'description', label: 'Descrição', value: row => row.description ?? '' },
  ];
  const search = useCombinedSearch(list.data ?? [], columns);
  const del = useDeleteEmailTemplate();

  async function askDelete(t: EmailTemplateListItem) {
    const ok = await confirm({ title: 'Excluir modelo?', message: `"${t.name}" será removido.`, confirmLabel: 'Excluir', cancelLabel: 'Cancelar', destructive: true });
    if (!ok) return;
    try { await del.mutateAsync(t.id); toast.success('Modelo excluído.'); } catch { toast.error('Falha ao excluir.'); }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-center gap-1">
          <h1 className="text-lg font-semibold text-slate-900">Modelos de e-mail</h1>
          <ContextHelp manual="modelos-email-notificacoes" section="criar-modelo-email" label="Abrir manual de modelos de e-mail" />
        </div>
        <button type="button" onClick={() => openTab(routes.emailTemplate('novo'))} className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"><Plus size={16} /> Novo modelo</button>
      </header>

      <CombinedSearch columns={columns} search={search} loading={list.isLoading} />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {list.isError ? (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Não foi possível carregar os modelos. <button type="button" onClick={() => void list.refetch()} className="font-medium underline">Tentar novamente</button></p>
        ) : !list.isLoading && (list.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Mail size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhum modelo de e-mail</p>
            <p className="mt-1 text-sm text-slate-500">Crie modelos com placeholders, anexos e destinatários para os eventos de e-mail dos processos.</p>
          </div>
        ) : !list.isLoading && search.rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-600"><p>Nenhum modelo corresponde à busca.</p><button type="button" onClick={search.clear} className="mt-3 font-medium text-slate-900 underline">Limpar busca</button></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2 text-left">Nome</th><th className="px-4 py-2 text-left">Descrição</th><th className="px-4 py-2 w-20" /></tr></thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
              {search.rows.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{t.name}</td>
                  <td className="px-4 py-2 text-slate-600">{t.description ?? '—'}</td>
                  <td className="px-4 py-2"><div className="flex justify-end gap-1">
                    <button type="button" onClick={() => openTab(routes.emailTemplate(t.id))} aria-label={`Editar ${t.name} em nova aba`} title="Editar em nova aba" className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"><Pencil size={15} /></button>
                    <button type="button" onClick={() => askDelete(t)} aria-label={`Excluir ${t.name}`} title="Excluir" className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

export function EmailTemplateEditor({ id, onClose }: { id?: string; onClose: () => void }) {
  const detail = useEmailTemplate(id ?? null);
  const create = useCreateEmailTemplate();
  const update = useUpdateEmailTemplate();
  const test = useTestEmailTemplate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [hydrated, setHydrated] = useState(!id);

  if (id && detail.data && !hydrated) {
    const d = detail.data;
    setName(d.name); setDescription(d.description ?? ''); setSubject(d.subject ?? ''); setBodyHtml(d.bodyHtml ?? '');
    setAttachments(d.attachments.map((a) => a.fieldRef));
    setRecipients(d.recipients);
    setHydrated(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name, description: description || undefined, subject: subject || undefined, bodyHtml: bodyHtml || undefined,
      attachments: attachments.filter(Boolean).map((fieldRef) => ({ fieldRef })),
      recipients,
    };
    try {
      if (id) await update.mutateAsync({ id, body }); else await create.mutateAsync(body);
      toast.success(id ? 'Modelo atualizado.' : `Modelo "${name}" criado.`);
      onClose();
    } catch (error) { toast.error(error instanceof ApiError ? (error.detail ?? 'Não foi possível salvar o modelo.') : 'Não foi possível salvar o modelo.'); }
  }

  async function doTest() {
    try {
      const r = await test.mutateAsync({ subject, bodyHtml });
      toast.success(`Teste enviado para ${r.sentTo}.`);
    } catch (err) {
      const d = err instanceof ApiError ? err.detail : undefined;
      toast.error(d ?? 'Não foi possível enviar o teste.');
    }
  }

  const loading = !!id && !hydrated;
  const saving = create.isPending || update.isPending;
  const title = id ? 'Editar modelo de e-mail' : 'Novo modelo de e-mail';

  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      </header>
      <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <div className="w-full rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          {loading ? (
            <div role={detail.isError ? 'alert' : 'status'} className="py-10 text-center text-sm text-slate-600">
              {detail.isError ? <><p>Não foi possível carregar o modelo.</p><button type="button" onClick={() => void detail.refetch()} className="mt-3 font-medium text-slate-900 underline">Tentar novamente</button></> : 'Carregando o modelo…'}
            </div>
          ) : (
            <form id="et-form" onSubmit={save}>
              <FormSection title="Identificação" description="Nome e descrição para localizar o modelo nos processos.">
                <Field label="Nome"><TextInput required autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Descrição"><TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
              </FormSection>
              <FormSection title="Conteúdo" description="Defina o assunto e a mensagem enviados pelo processo.">
                <Field label="Assunto" hint="Aceita placeholders, ex: {{requisitante.nome}}."><TextInput value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
                <Field label="Mensagem" hint="Use placeholders, ex: {{requisitante.nome}}."><RichTextEditor value={bodyHtml} onChange={setBodyHtml} /></Field>
              </FormSection>
              <FormSection title="Destinatários e anexos" description="Configure quem recebe a mensagem e quais campos fornecem os arquivos anexados.">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-800">Destinatários</h3>
                  {recipients.length === 0 && <p className="text-sm text-slate-600">Nenhum destinatário adicionado.</p>}
                  {recipients.map((r, i) => (
                    <RecipientRow key={i} value={r} onChange={(nr) => setRecipients(recipients.map((x, j) => j === i ? nr : x))} onRemove={() => setRecipients(recipients.filter((_, j) => j !== i))} />
                  ))}
                  <button type="button" onClick={() => setRecipients([...recipients, { kind: 'to', type: 'requester' }])} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Plus size={14} /> Adicionar destinatário</button>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-800">Anexos (campos do formulário)</h3>
                  {attachments.length === 0 && <p className="text-sm text-slate-600">Nenhum anexo adicionado.</p>}
                  {attachments.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <TextInput aria-label={`Campo do anexo ${i + 1}`} value={a} placeholder="ex: anexo_contrato" onChange={(e) => setAttachments(attachments.map((x, j) => j === i ? e.target.value : x))} />
                      <button type="button" aria-label={`Remover anexo ${i + 1}`} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="rounded p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><X size={16} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setAttachments([...attachments, ''])} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Plus size={14} /> Adicionar anexo</button>
                </div>
              </FormSection>
              <FormSection title="Teste" description="Envie o assunto e a mensagem atuais para o seu e-mail antes de salvar.">
                <button type="button" onClick={doTest} disabled={test.isPending} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  <Send size={14} /> {test.isPending ? 'Enviando…' : 'Testar'}
                </button>
              </FormSection>
            </form>
          )}
        </div>
      </main>
      <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
        <button form="et-form" type="submit" disabled={!name.trim() || loading || saving} className="rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar'}</button>
      </footer>
    </div>
  );
}

function RecipientRow({ value, onChange, onRemove }: { value: Recipient; onChange: (r: Recipient) => void; onRemove: () => void }) {
  const areas = useAreas();
  const areaKey = (areas.data ?? []).find((a) => a.id === value.orgUnitId)?.key ?? null;
  const positions = useAreaPositions(value.type === 'position' ? areaKey : null);
  const users = useUsersList({ status: 'active', pageSize: 50 });

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
        <Select aria-label="Tipo de envio" className="col-start-1" value={value.kind} options={KIND_OPTIONS} onChange={(e) => { const kind = KIND_OPTIONS.find(option => option.value === e.target.value)?.value; if (kind) onChange({ ...value, kind }); }} />
        <Select aria-label="Tipo de destinatário" className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1" value={value.type} options={TYPE_OPTIONS} onChange={(e) => { const type = TYPE_OPTIONS.find(option => option.value === e.target.value)?.value; if (type) onChange({ ...value, type, orgUnitId: null, positionId: null, fieldRef: null, userId: null, address: null, sql: null }); }} />
        <button type="button" onClick={onRemove} aria-label="Remover destinatário" className="col-start-2 row-start-1 row-span-2 self-start rounded p-2 text-slate-500 sm:col-start-3 hover:bg-rose-50 hover:text-rose-700"><X size={15} /></button>
      </div>
      <div className="mt-2">
        {value.type === 'position' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Select aria-label="Unidade organizacional do destinatário" value={value.orgUnitId ?? ''} placeholder="Unidade organizacional" options={(areas.data ?? []).map((a) => ({ value: a.id, label: a.name }))} onChange={(e) => onChange({ ...value, orgUnitId: e.target.value, positionId: null })} />
            <Select aria-label="Posição do destinatário" value={value.positionId ?? ''} placeholder="Posição" disabled={!areaKey} options={(positions.data ?? []).map((p) => ({ value: p.id, label: p.name }))} onChange={(e) => onChange({ ...value, positionId: e.target.value })} />
          </div>
        )}
        {value.type === 'dynamic' && <TextInput aria-label="Campo do destinatário" value={value.fieldRef ?? ''} placeholder="Campo do formulário" onChange={(e) => onChange({ ...value, fieldRef: e.target.value })} />}
        {value.type === 'fixedUser' && <Select aria-label="Usuário destinatário" value={value.userId ?? ''} placeholder="Usuário" options={(users.data?.items ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))} onChange={(e) => onChange({ ...value, userId: e.target.value })} />}
        {value.type === 'fixedAddress' && <TextInput aria-label="Endereço do destinatário" value={value.address ?? ''} placeholder="email@dominio.gov" onChange={(e) => onChange({ ...value, address: e.target.value })} />}
        {value.type === 'sql' && <TextArea aria-label="SQL de destinatários" rows={2} value={value.sql ?? ''} placeholder="SELECT email FROM ..." className="font-mono text-xs" onChange={(e) => onChange({ ...value, sql: e.target.value })} />}
      </div>
    </div>
  );
}

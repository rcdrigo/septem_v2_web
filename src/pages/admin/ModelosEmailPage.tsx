import { useState } from 'react';
import { Mail, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  useEmailTemplatesList, useEmailTemplate, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate,
  type EmailTemplateListItem, type Recipient, type RecipientType,
} from '@/lib/api/email-templates';
import { useAreas, useAreaPositions } from '@/lib/api/catalog';
import { useUsersList } from '@/lib/api/users';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';

const TYPE_OPTIONS = [
  { value: 'requester', label: 'Requisitante' },
  { value: 'position', label: 'Posição' },
  { value: 'dynamic', label: 'Usuário dinâmico (campo)' },
  { value: 'fixedUser', label: 'Usuário fixo' },
  { value: 'fixedAddress', label: 'Endereço fixo' },
  { value: 'sql', label: 'Customizado (SQL)' },
];
const KIND_OPTIONS = [{ value: 'to', label: 'Para' }, { value: 'cc', label: 'Cópia' }, { value: 'bcc', label: 'Cópia oculta' }];

/** Admin › Configurações › Modelos de e-mail (T2). Lista + editor com assunto,
 * corpo, anexos (campos do form) e destinatários to/cc/bcc nos 6 tipos. */
export function ModelosEmailPage() {
  const list = useEmailTemplatesList();
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteEmailTemplate();

  async function askDelete(t: EmailTemplateListItem) {
    const ok = await confirm({ title: 'Excluir modelo?', message: `"${t.name}" será removido.`, confirmLabel: 'Excluir', cancelLabel: 'Cancelar', destructive: true });
    if (!ok) return;
    try { await del.mutateAsync(t.id); toast.success('Modelo excluído.'); } catch { toast.error('Falha ao excluir.'); }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Modelos de e-mail</h1>
        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"><Plus size={16} /> Novo modelo</button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {!list.isLoading && (list.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Mail size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhum modelo de e-mail</p>
            <p className="mt-1 text-sm text-slate-500">Crie modelos com placeholders, anexos e destinatários para os eventos de e-mail dos processos.</p>
          </div>
        ) : (
          <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2 text-left">Nome</th><th className="px-4 py-2 text-left">Descrição</th><th className="px-4 py-2 w-20" /></tr></thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
              {list.data?.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{t.name}</td>
                  <td className="px-4 py-2 text-slate-600">{t.description ?? '—'}</td>
                  <td className="px-4 py-2"><div className="flex justify-end gap-1">
                    <button type="button" onClick={() => setEditId(t.id)} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"><Pencil size={15} /></button>
                    <button type="button" onClick={() => askDelete(t)} className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && <TemplateDialog onClose={() => setCreating(false)} />}
      {editId && <TemplateDialog id={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

function TemplateDialog({ id, onClose }: { id?: string; onClose: () => void }) {
  const detail = useEmailTemplate(id ?? null);
  const create = useCreateEmailTemplate();
  const update = useUpdateEmailTemplate();

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
    } catch { toast.error('Não foi possível salvar o modelo.'); }
  }

  return (
    <Dialog open onClose={onClose} width="lg" title={id ? 'Editar modelo de e-mail' : 'Novo modelo de e-mail'} footer={
      <>
        <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
        <button form="et-form" type="submit" disabled={!name} className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Salvar</button>
      </>
    }>
      <form id="et-form" className="flex flex-col gap-3" onSubmit={save}>
        <Field label="Nome"><TextInput required autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Descrição"><TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Assunto" hint="Aceita placeholders, ex: {{requisitante.nome}}."><TextInput value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Mensagem" hint="HTML + placeholders {{ }}. Editor rich-text entra depois."><TextArea rows={5} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} className="font-mono text-xs" /></Field>

        <Field label="Anexos (campos do formulário)">
          <div className="flex flex-col gap-1.5">
            {attachments.map((a, i) => (
              <div key={i} className="flex gap-2">
                <TextInput value={a} placeholder="ex: anexo_contrato" onChange={(e) => setAttachments(attachments.map((x, j) => j === i ? e.target.value : x))} />
                <button type="button" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={15} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setAttachments([...attachments, ''])} className="self-start text-xs font-medium text-slate-600 hover:text-slate-900">+ anexo</button>
          </div>
        </Field>

        <Field label="Destinatários">
          <div className="flex flex-col gap-2">
            {recipients.map((r, i) => (
              <RecipientRow key={i} value={r} onChange={(nr) => setRecipients(recipients.map((x, j) => j === i ? nr : x))} onRemove={() => setRecipients(recipients.filter((_, j) => j !== i))} />
            ))}
            <button type="button" onClick={() => setRecipients([...recipients, { kind: 'to', type: 'requester' }])} className="self-start text-xs font-medium text-slate-600 hover:text-slate-900">+ destinatário</button>
          </div>
        </Field>
      </form>
    </Dialog>
  );
}

function RecipientRow({ value, onChange, onRemove }: { value: Recipient; onChange: (r: Recipient) => void; onRemove: () => void }) {
  const areas = useAreas();
  const areaKey = (areas.data ?? []).find((a) => a.id === value.orgUnitId)?.key ?? null;
  const positions = useAreaPositions(value.type === 'position' ? areaKey : null);
  const users = useUsersList({ status: 'active', pageSize: 50 });

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center gap-2">
        <Select value={value.kind} options={KIND_OPTIONS} onChange={(e) => onChange({ ...value, kind: e.target.value as Recipient['kind'] })} />
        <Select value={value.type} options={TYPE_OPTIONS} onChange={(e) => onChange({ ...value, type: e.target.value as RecipientType, orgUnitId: null, positionId: null, fieldRef: null, userId: null, address: null, sql: null })} />
        <button type="button" onClick={onRemove} className="ml-auto rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={15} /></button>
      </div>
      <div className="mt-2">
        {value.type === 'position' && (
          <div className="grid grid-cols-2 gap-2">
            <Select value={value.orgUnitId ?? ''} placeholder="Área" options={(areas.data ?? []).map((a) => ({ value: a.id, label: a.name }))} onChange={(e) => onChange({ ...value, orgUnitId: e.target.value, positionId: null })} />
            <Select value={value.positionId ?? ''} placeholder="Posição" disabled={!areaKey} options={(positions.data ?? []).map((p) => ({ value: p.id, label: p.name }))} onChange={(e) => onChange({ ...value, positionId: e.target.value })} />
          </div>
        )}
        {value.type === 'dynamic' && <TextInput value={value.fieldRef ?? ''} placeholder="Campo do formulário" onChange={(e) => onChange({ ...value, fieldRef: e.target.value })} />}
        {value.type === 'fixedUser' && <Select value={value.userId ?? ''} placeholder="Usuário" options={(users.data?.items ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))} onChange={(e) => onChange({ ...value, userId: e.target.value })} />}
        {value.type === 'fixedAddress' && <TextInput value={value.address ?? ''} placeholder="email@dominio.gov" onChange={(e) => onChange({ ...value, address: e.target.value })} />}
        {value.type === 'sql' && <TextArea rows={2} value={value.sql ?? ''} placeholder="SELECT email FROM ..." className="font-mono text-xs" onChange={(e) => onChange({ ...value, sql: e.target.value })} />}
      </div>
    </div>
  );
}

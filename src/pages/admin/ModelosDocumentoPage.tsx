import { useRef, useState } from 'react';
import { AlertTriangle, Eye, FileStack, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import {
  useDocumentTemplates, useDocumentTemplate, useCreateDocumentTemplate,
  useUpdateDocumentTemplate, useDeleteDocumentTemplate, useUploadDocumentTemplateFile,
  openDocumentTemplateFile,
  type DocumentTemplateListItem,
} from '@/lib/api/document-templates';
import { useOrgUnitsFlat } from '@/lib/api/org-units';
import { Dialog } from '@/components/ui/Dialog';
import { Combobox } from '@/components/ui/Combobox';
import { Field, TextInput, TextArea, RadioGroup } from '@/components/ui/Field';
import { confirm } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api';
import { toast } from '@/stores/toast';

/** Abre o .docx do modelo em nova aba, avisando na tela se falhar. */
async function preview(id: string) {
  try { await openDocumentTemplateFile(id); }
  catch { toast.error('Não foi possível abrir o arquivo do modelo.'); }
}

/**
 * Admin › Modelos de documentos (Fase 6a). Cadastro dos modelos `.docx` com chaves
 * `{{ }}`: nome, descrição, unidade organizacional, status, tipo de saída e o arquivo.
 * O preview abre o .docx em aba própria (somente leitura).
 */
export function ModelosDocumentoPage() {
  const list = useDocumentTemplates();
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteDocumentTemplate();

  async function askDelete(t: DocumentTemplateListItem) {
    const ok = await confirm({
      title: 'Excluir modelo?', message: `"${t.name}" será removido.`,
      confirmLabel: 'Excluir', cancelLabel: 'Cancelar', destructive: true,
    });
    if (!ok) return;
    try { await del.mutateAsync(t.id); toast.success('Modelo excluído.'); }
    catch { toast.error('Falha ao excluir.'); }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Modelos de documentos</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          <Plus size={16} /> Novo modelo
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {!list.isLoading && (list.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <FileStack size={26} />
            </div>
            <p className="text-sm font-medium text-slate-700">Nenhum modelo de documento</p>
            <p className="mt-1 text-sm text-slate-500">
              Cadastre modelos .docx com chaves para gerar documentos nas tarefas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Nome</th>
                  <th className="px-4 py-2 text-left">Arquivo</th>
                  <th className="px-4 py-2 text-left">Saída</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="w-24 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {list.isLoading && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>
                )}
                {list.data?.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid="doc-linha">
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-800">{t.name}</span>
                      {t.description && <span className="block truncate text-xs text-slate-500">{t.description}</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {t.hasFile ? (
                        <span className="flex items-center gap-1.5">
                          <span className="truncate">{t.fileName}</span>
                          {!t.templateValid && (
                            <span title="O template tem erros de sintaxe" className="text-amber-600"><AlertTriangle size={14} /></span>
                          )}
                        </span>
                      ) : <span className="text-slate-400">— sem arquivo —</span>}
                    </td>
                    <td className="px-4 py-2 uppercase text-slate-600">{t.outputType}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${t.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {t.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        {t.hasFile && (
                          <button
                            type="button"
                            onClick={() => void preview(t.id)}
                            title="Visualizar o arquivo (somente leitura)"
                            aria-label={`Visualizar ${t.name}`}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                          >
                            <Eye size={15} />
                          </button>
                        )}
                        <button type="button" onClick={() => setEditId(t.id)} title="Editar"
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800">
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => askDelete(t)} title="Excluir"
                          className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <TemplateDialog onClose={() => setCreating(false)} />}
      {editId && <TemplateDialog id={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

const OUTPUT_OPTIONS = [
  { value: 'docx', label: 'DOCX (Word)' },
  { value: 'pdf', label: 'PDF' },
] as const;

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
] as const;

function TemplateDialog({ id, onClose }: { id?: string; onClose: () => void }) {
  const detail = useDocumentTemplate(id ?? null);
  const create = useCreateDocumentTemplate();
  const update = useUpdateDocumentTemplate();
  const upload = useUploadDocumentTemplateFile();
  const units = useOrgUnitsFlat();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [orgUnitId, setOrgUnitId] = useState<string>('');
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [outputType, setOutputType] = useState<'docx' | 'pdf'>('docx');
  const [hydrated, setHydrated] = useState(!id);

  if (id && detail.data && !hydrated) {
    const d = detail.data;
    setName(d.name); setDescription(d.description ?? '');
    setOrgUnitId(d.orgUnitId ?? '');
    setStatus(d.active ? 'ativo' : 'inativo');
    setOutputType(d.outputType);
    setHydrated(true);
  }

  const unitOptions = (units.data ?? []).map((u) => ({ value: u.id, label: u.sigla ? `${u.sigla} — ${u.name}` : u.name }));
  const issues = detail.data?.validation?.issues ?? [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name,
      description: description || undefined,
      orgUnitId: orgUnitId || null,
      active: status === 'ativo',
      outputType,
    };
    try {
      if (id) await update.mutateAsync({ id, body });
      else await create.mutateAsync(body);
      toast.success(id ? 'Modelo atualizado.' : `Modelo "${name}" criado.`);
      onClose();
    } catch (err) {
      const d = err instanceof ApiError ? (err.body as { detail?: string } | undefined)?.detail : undefined;
      toast.error(d ?? 'Não foi possível salvar o modelo.');
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file || !id) return;
    try {
      const r = await upload.mutateAsync({ id, file });
      toast.success(`Arquivo "${r.fileName}" enviado.`);
    } catch (err) {
      const d = err instanceof ApiError ? (err.body as { detail?: string } | undefined)?.detail : undefined;
      toast.error(d ?? 'Não foi possível enviar o arquivo.');
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      width="lg"
      title={id ? 'Editar modelo de documento' : 'Novo modelo de documento'}
      footer={
        <>
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
          <button form="dt-form" type="submit" disabled={!name}
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            Salvar
          </button>
        </>
      }
    >
      <form id="dt-form" className="flex flex-col gap-3" onSubmit={save}>
        <Field label="Nome"><TextInput required autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Descrição"><TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Unidade organizacional" hint="Define quem pode editar o modelo pela permissão de unidade.">
          <Combobox
            value={orgUnitId}
            options={unitOptions}
            onChange={setOrgUnitId}
            clearLabel="— sem unidade (global) —"
            placeholder={units.isLoading ? 'Carregando…' : 'Selecione a unidade'}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <RadioGroup<'ativo' | 'inativo'> name="dt-status" value={status} onChange={setStatus} options={STATUS_OPTIONS as any} />
          </Field>
          <Field label="Tipo de saída">
            <RadioGroup<'docx' | 'pdf'> name="dt-output" value={outputType} onChange={setOutputType} options={OUTPUT_OPTIONS as any} />
          </Field>
        </div>

        {/* Arquivo: só existe depois de salvar (precisa do id para a chave no storage). */}
        <Field label="Arquivo do modelo (.docx)" hint={id ? 'Word ou LibreOffice. O arquivo substitui o anterior.' : 'Salve o modelo primeiro para enviar o arquivo.'}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              data-testid="doc-file-input"
              onChange={(e) => void pickFile(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={!id || upload.isPending}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Upload size={14} /> {upload.isPending ? 'Enviando…' : 'Enviar .docx'}
            </button>
            {detail.data?.fileName && (
              <>
                <span className="truncate text-sm text-slate-600">{detail.data.fileName}</span>
                <button
                  type="button"
                  onClick={() => id && void preview(id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  <Eye size={13} /> Visualizar
                </button>
              </>
            )}
          </div>
        </Field>

        {/* Erros de sintaxe do template detectados no upload (Fase 6b). */}
        {issues.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3" data-testid="doc-issues">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <AlertTriangle size={13} /> Problemas encontrados no template
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-900">
              {issues.map((it, i) => <li key={i}>{it.message}</li>)}
            </ul>
          </div>
        )}
      </form>
    </Dialog>
  );
}

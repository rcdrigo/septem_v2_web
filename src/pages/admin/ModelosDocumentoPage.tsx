import { useRef, useState } from 'react';
import { AlertTriangle, BookOpen, Eye, FileStack, FlaskConical, History, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import {
  useDocumentTemplates, useDocumentTemplate, useCreateDocumentTemplate,
  useUpdateDocumentTemplate, useDeleteDocumentTemplate, useUploadDocumentTemplateFile,
  openDocumentTemplateFile, openDocumentTemplatePreview, useTemplateKeys, skeletonFromKeys, testDocumentTemplate, useDocumentExecutions,
  useDocumentServices,
  type DocumentTemplateListItem,
} from '@/lib/api/document-templates';
import { useOrgUnitsFlat } from '@/lib/api/org-units';
import { Dialog } from '@/components/ui/Dialog';
import { Combobox } from '@/components/ui/Combobox';
import { Field, TextInput, TextArea, RadioGroup } from '@/components/ui/Field';
import { confirm } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api';
import { toast } from '@/stores/toast';
import { formatWithRelative, formatDuration } from '@/lib/relative-time';
import { openTab } from '@/lib/nav';

/**
 * Preview do modelo em nova aba, somente leitura (:11). Vai pelo PDF, que o navegador
 * exibe; se o servidor não tiver conversor, cai no .docx original (que baixa) em vez
 * de deixar o usuário sem nada.
 */
async function preview(id: string) {
  try {
    await openDocumentTemplatePreview(id);
  } catch {
    try { await openDocumentTemplateFile(id); }
    catch { toast.error('Não foi possível abrir o arquivo do modelo.'); }
  }
}

/**
 * Admin › Modelos de documentos (Fase 6a). Cadastro dos modelos `.docx` com chaves
 * `{{ }}`: nome, descrição, unidade organizacional, status, tipo de saída e o arquivo.
 * O preview abre o .docx em aba própria (somente leitura).
 */
export function ModelosDocumentoPage() {
  const list = useDocumentTemplates();
  const [editId, setEditId] = useState<string | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [histId, setHistId] = useState<{ id: string; nome: string } | null>(null);
  const [camposOpen, setCamposOpen] = useState(false);
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openTab('manual-templates')}
            title="Manual técnico de criação de templates"
            data-testid="doc-manual"
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <BookOpen size={15} /> <span className="hidden sm:inline">Manual</span>
          </button>
          <button
            type="button"
            onClick={() => setCamposOpen(true)}
            data-testid="doc-buscar-campos"
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Search size={15} /> <span className="hidden sm:inline">Buscar campos</span>
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Novo modelo</span><span className="sm:hidden">Novo</span>
          </button>
        </div>
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
          <>
          {/* Mobile: cards empilhados. A tabela larga jogaria os botões de ação para
              fora da tela (só alcançáveis com scroll horizontal) — no celular as
              colunas viram linhas e as ações ficam sempre visíveis. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {list.isLoading && <li className="py-8 text-center text-slate-400">Carregando...</li>}
            {list.data?.map((t) => (
              <li key={t.id} className="rounded-md border border-slate-200 bg-white p-3" data-testid="doc-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                    {t.description && <p className="truncate text-xs text-slate-500">{t.description}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${t.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {t.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
                  <span className="uppercase">{t.outputType}</span> ·{' '}
                  {t.hasFile ? <span className="truncate">{t.fileName}</span> : <span>sem arquivo</span>}
                  {t.hasFile && !t.templateValid && <AlertTriangle size={12} className="shrink-0 text-amber-600" />}
                </p>
                <div className="mt-2 flex gap-1">
                  {t.hasFile && (
                    <button type="button" onClick={() => void preview(t.id)} title="Visualizar"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"><Eye size={15} /></button>
                  )}
                  {t.hasFile && (
                    <button type="button" onClick={() => setTestId(t.id)} title="Testar"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"><FlaskConical size={15} /></button>
                  )}
                  <button type="button" onClick={() => setHistId({ id: t.id, nome: t.name })} title="Histórico"
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"><History size={15} /></button>
                  <button type="button" onClick={() => setEditId(t.id)} title="Editar"
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"><Pencil size={15} /></button>
                  <button type="button" onClick={() => askDelete(t)} title="Excluir"
                    className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto sm:block">
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
                        {t.hasFile && (
                          <button
                            type="button"
                            onClick={() => setTestId(t.id)}
                            title="Testar o modelo"
                            aria-label={`Testar ${t.name}`}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                          >
                            <FlaskConical size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setHistId({ id: t.id, nome: t.name })}
                          title="Histórico de execuções"
                          aria-label={`Histórico de ${t.name}`}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                        >
                          <History size={15} />
                        </button>
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
          </>
        )}
      </div>

      {camposOpen && <CamposDialog onClose={() => setCamposOpen(false)} />}
      {testId && <TestDialog id={testId} onClose={() => setTestId(null)} />}
      {histId && <HistoricoDialog id={histId.id} nome={histId.nome} onClose={() => setHistId(null)} />}
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

/**
 * "Buscar campos disponíveis" (modelos_documentos:42-44): dropdown pesquisável com os
 * serviços que o usuário pode ver (o servidor filtra pela unidade; admin vê todos) e,
 * ao buscar, abre em nova aba a lista de campos com agrupamento, nome e chave.
 */
function CamposDialog({ onClose }: { onClose: () => void }) {
  const servicos = useDocumentServices(true);
  const [key, setKey] = useState('');

  const options = (servicos.data ?? []).map((s) => ({
    value: s.key,
    label: s.area ? `${s.name} — ${s.area}` : s.name,
  }));

  return (
    <Dialog
      open
      onClose={onClose}
      width="md"
      title="Buscar campos disponíveis"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>
          <button
            type="button"
            disabled={!key}
            data-testid="campos-buscar"
            onClick={() => { openTab(`campos-servico?key=${encodeURIComponent(key)}`); onClose(); }}
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Buscar
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-600">
          Escolha o serviço para ver as chaves que podem ser usadas no modelo. Abre em uma nova aba.
        </p>
        <Field label="Serviço">
          <Combobox
            value={key}
            options={options}
            onChange={setKey}
            placeholder={servicos.isLoading ? 'Carregando…' : 'Selecione o serviço'}
          />
        </Field>
        {!servicos.isLoading && options.length === 0 && (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
            Nenhum serviço publicado disponível para a sua unidade.
          </p>
        )}
      </div>
    </Dialog>
  );
}

/**
 * Histórico de execuções do modelo (modelos_documentos:30-37): quando, quem pediu,
 * quanto demorou, tipo (teste/produção), status — com o erro quando falhou — e o
 * payload enviado. Só abre para quem tem a permissão documents:history.
 */
function HistoricoDialog({ id, nome, onClose }: { id: string; nome: string; onClose: () => void }) {
  const execs = useDocumentExecutions(id, true);
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <Dialog
      open
      onClose={onClose}
      width="lg"
      title={`Histórico — ${nome}`}
      footer={<button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>}
    >
      {execs.isLoading ? (
        <p className="py-8 text-center text-sm text-slate-400">Carregando o histórico…</p>
      ) : execs.isError ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Você não tem permissão para ver o histórico deste modelo.
        </p>
      ) : (execs.data?.length ?? 0) === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhuma geração registrada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="doc-historico">
          {execs.data!.map((e) => (
            <li key={e.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.status === 'sucesso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {e.status === 'sucesso' ? 'Sucesso' : 'Falhou'}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {e.kind === 'teste' ? 'Teste' : 'Produção'}
                </span>
                <span className="text-xs uppercase text-slate-500">{e.outputType}</span>
                <span className="ml-auto text-xs text-slate-500">{formatDuration(e.durationMs)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{formatWithRelative(e.startedAt)}</p>
              <p className="text-xs text-slate-500">Requisitante: {e.requestedBy ?? '— integração —'}</p>

              <div className="mt-2 flex flex-wrap gap-3">
                {e.status === 'falha' && e.error && (
                  <button type="button" onClick={() => setAberto(aberto === `err-${e.id}` ? null : `err-${e.id}`)}
                    className="text-xs font-medium text-rose-700 hover:underline" data-testid="doc-ver-erro">
                    {aberto === `err-${e.id}` ? 'Ocultar erro' : 'Ver erro'}
                  </button>
                )}
                {e.payload && (
                  <button type="button" onClick={() => setAberto(aberto === `pay-${e.id}` ? null : `pay-${e.id}`)}
                    className="text-xs font-medium text-slate-600 hover:underline">
                    {aberto === `pay-${e.id}` ? 'Ocultar payload' : 'Ver payload'}
                  </button>
                )}
              </div>

              {aberto === `err-${e.id}` && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-rose-50 p-2 text-xs text-rose-900" data-testid="doc-erro-detalhe">{e.error}</pre>
              )}
              {aberto === `pay-${e.id}` && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-xs text-slate-700">{e.payload}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/**
 * Modal de TESTE (modelos_documentos:13-15): lê as chaves do .docx, monta um JSON de
 * exemplo para o usuário preencher e gera o documento numa nova aba. O documento sai
 * com marca d'água e travado para edição (o servidor aplica).
 */
function TestDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const keys = useTemplateKeys(id, true);
  const [json, setJson] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [semeado, setSemeado] = useState(false);

  // Semeia o JSON assim que as chaves chegam (não sobrescreve o que o usuário editou).
  if (keys.data && !semeado) {
    setJson(JSON.stringify(skeletonFromKeys(keys.data.keys), null, 2));
    setSemeado(true);
  }

  async function gerar() {
    let data: unknown;
    try { data = json.trim() ? JSON.parse(json) : {}; }
    catch { setErro('O JSON está inválido — revise a formatação.'); return; }
    setErro(null);
    setGerando(true);
    try {
      await testDocumentTemplate(id, data);
      toast.success('Documento de teste gerado.');
    } catch (err) {
      const d = err instanceof ApiError ? (err.body as { detail?: string } | undefined)?.detail : undefined;
      setErro(d ?? 'Não foi possível gerar o documento.');
    } finally { setGerando(false); }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      width="lg"
      title="Testar modelo"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">
            Retornar
          </button>
          <button
            type="button"
            onClick={gerar}
            disabled={gerando || keys.isLoading}
            data-testid="doc-gerar"
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {gerando ? 'Gerando…' : 'Gerar documento'}
          </button>
        </>
      }
    >
      {keys.isLoading ? (
        <p className="py-8 text-center text-sm text-slate-400">Lendo as chaves do modelo…</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600">
            Preencha os valores das chaves encontradas no modelo. O documento gerado é de
            teste: sai com marca d'água e bloqueado para edição.
          </p>
          {(keys.data?.keys.length ?? 0) === 0 && (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
              Este modelo não tem chaves — o documento será gerado como está.
            </p>
          )}
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            rows={14}
            data-testid="doc-json"
            className="w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs text-slate-800 focus:border-slate-500 focus:outline-none"
          />
          {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="doc-erro">{erro}</p>}
        </div>
      )}
    </Dialog>
  );
}

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
  const [camposOpen, setCamposOpen] = useState(false);

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
  // Editando, o form só existe DEPOIS do dado chegar. Sem esta guarda o usuário podia
  // digitar o nome e salvar antes da carga, e o PUT ia com descrição/unidade vazias —
  // apagando o que ele nem viu (mesma classe de bug da Fase 3).
  const carregando = !!id && !hydrated;

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
          <button form="dt-form" type="submit" disabled={!name || carregando}
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            Salvar
          </button>
        </>
      }
    >
      {carregando ? (
        <p className="py-10 text-center text-sm text-slate-400" data-testid="doc-carregando">Carregando o modelo…</p>
      ) : (
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

        {/* Ajuda para escrever o modelo, AQUI dentro do editor (a spec pede o botão ao
            criar/editar — é neste momento que o usuário precisa das chaves). */}
        <div className="flex flex-wrap gap-2 rounded-md bg-slate-50 p-2">
          <button
            type="button"
            onClick={() => setCamposOpen(true)}
            data-testid="dlg-buscar-campos"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Search size={13} /> Buscar campos disponíveis
          </button>
          <button
            type="button"
            onClick={() => openTab('manual-templates')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <BookOpen size={13} /> Manual técnico
          </button>
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
      )}
      {camposOpen && <CamposDialog onClose={() => setCamposOpen(false)} />}
    </Dialog>
  );
}

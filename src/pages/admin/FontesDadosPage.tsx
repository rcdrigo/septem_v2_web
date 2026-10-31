import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Braces, Database, Pencil, Plus, Play, Trash2, X } from 'lucide-react';
import { usePlaceholders } from '@/lib/api/catalog';
import {
  useDataSourcesList,
  useDataSource,
  useCreateDataSource,
  useUpdateDataSource,
  useDeleteDataSource,
  useTestDataSource,
  useDataSourceUsages,
  type DataSourceListItem,
  type DataSourceScope,
  type DataSourceType,
  type TestResult,
  type DataSourceTable,
} from '@/lib/api/data-sources';
import { openTab } from '@/lib/nav';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { normalizeSqlQuery } from '@/lib/sql-query';
import { formatFormFieldMapping, parseFormFieldMapping, type ApiMapping } from '@/lib/data-source-mapping';
import { routes } from '@/lib/routes';
import { ContextHelp } from '@/components/guide/ContextHelp';
import { EditableTableEditor, TableQueryEditor } from './TableDataSourceEditors';
import { readEditableTable, readTableQuery, validateEditableTable, comparisons, type EditableTable, type TableQuery } from '@/lib/table-data-source';

const TYPE_LABEL: Record<DataSourceType, string> = { fixed: 'Fixa (Simples)', 'fixed-table': 'Fixa (Tabela)', table: 'Customizado (Tabela)', sql: 'Customizado (SQL)', api: 'API (JSON)' };

/**
 * Fontes de dados (T1). Lista + editor por tipo (Fixa / SQL / API) com "Testar".
 * O escopo (process/report) vem da query `?scope=report` — fontes de processo e
 * de relatório são listadas e criadas separadamente.
 */
export function FontesDadosPage() {
  const [params] = useSearchParams();
  const scope: DataSourceScope = params.get('scope') === 'report' ? 'report' : 'process';
  const list = useDataSourcesList(scope);
  // Criar/editar abre em nova aba (sem menus).
  const openEditor = (id?: string) => openTab(`${routes.dataSource(id ?? 'nova')}?scope=${scope}`);
  const del = useDeleteDataSource();

  async function askDelete(d: DataSourceListItem) {
    const ok = await confirm({ title: 'Excluir fonte de dados?', message: `"${d.name}" será removida.`, confirmLabel: 'Excluir', cancelLabel: 'Cancelar', destructive: true });
    if (!ok) return;
    try { await del.mutateAsync(d.id); toast.success(`"${d.name}" excluída.`); }
    catch { toast.error('Falha ao excluir.'); }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex min-w-0 items-center gap-1">
          <h1 className="truncate text-lg font-semibold text-slate-900">
            Fontes de dados <span className="text-sm font-normal text-slate-400">· {scope === 'report' ? 'Relatórios' : 'Processos'}</span>
          </h1>
          <ContextHelp manual="fontes-dados-integracoes" section="configurar-fonte" label="Abrir manual de fontes de dados" />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => openEditor()} className="flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700">
            <Plus size={16} /> Nova fonte
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {!list.isLoading && (list.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Database size={26} /></div>
            <p className="text-sm font-medium text-slate-700">Nenhuma fonte de dados</p>
            <p className="mt-1 text-sm text-slate-500">Crie uma fonte simples, uma tabela ou uma integração para preencher os campos do formulário.</p>
          </div>
        ) : (
          <table className="w-full overflow-hidden rounded-md border border-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2 text-left">Nome</th><th className="px-4 py-2 text-left">Tipo</th><th className="px-4 py-2 text-left">Descrição</th><th className="px-4 py-2 w-20" /></tr>
            </thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
              {list.data?.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{d.name}</td>
                  <td className="px-4 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{TYPE_LABEL[d.type]}</span></td>
                  <td className="px-4 py-2 text-slate-600">{d.description ?? '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openEditor(d.id)} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" title="Editar"><Pencil size={15} /></button>
                      <button type="button" onClick={() => askDelete(d)} className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700" title="Excluir"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

// ── editor de fonte ────────────────────────────────────────────────────
type FixedItem = { value: string; label: string };
type ApiHeader = { k: string; v: string };

export function DataSourceDialog({ id, scope, onClose, fullPage }: { id?: string; scope: DataSourceScope; onClose: () => void; fullPage?: boolean }) {
  const detail = useDataSource(id ?? null);
  const create = useCreateDataSource();
  const update = useUpdateDataSource();
  const test = useTestDataSource();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<DataSourceType>('fixed');
  const [items, setItems] = useState<FixedItem[]>([{ value: '', label: '' }]);
  const [query, setQuery] = useState('');
  const [table, setTable] = useState<EditableTable>({ columns: ['Código', 'Descrição'], rows: [['', '']] });
  const [tableQuery, setTableQuery] = useState<TableQuery>({ sourceId: '', valueColumn: '', textColumn: '', filters: [] });
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState<ApiHeader[]>([]);
  const [body, setBody] = useState('');
  const [mapping, setMapping] = useState({ repeat: '', value: '', text: '' });
  const [fieldMapping, setFieldMapping] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const [hydrated, setHydrated] = useState(!id);

  if (id && detail.data && !hydrated) {
    const d = detail.data; const cfg = (d.config ?? {}) as any;
    setName(d.name); setDescription(d.description ?? ''); setType(d.type);
    if (d.type === 'fixed') setItems(cfg.items?.length ? cfg.items : [{ value: '', label: '' }]);
    if (d.type === 'sql') setQuery(cfg.query ?? '');
    if (d.type === 'fixed-table') setTable(readEditableTable(d.config));
    if (d.type === 'table') { setTableQuery(readTableQuery(d.config)); setFieldMapping(formatFormFieldMapping(cfg.mapping?.fields)); }
    if (d.type === 'api') {
      setUrl(cfg.url ?? ''); setMethod(cfg.method ?? 'GET'); setHeaders(cfg.headers ?? []); setBody(cfg.body ?? '');
      setMapping({ repeat: cfg.mapping?.repeat ?? '', value: cfg.mapping?.value ?? '', text: cfg.mapping?.text ?? '' });
      setFieldMapping(formatFormFieldMapping(cfg.mapping?.fields));
    }
    setHydrated(true);
  }

  if (id && !hydrated) return <p role={detail.error ? 'alert' : 'status'} className="p-4 text-sm text-slate-700">{detail.error ? 'Não foi possível carregar a fonte. Reabra esta página para tentar novamente.' : 'Carregando fonte de dados…'}</p>;

  function buildConfig(): unknown {
    if (type === 'fixed') return { items: items.filter((i) => i.value || i.label) };
    if (type === 'fixed-table') return validateEditableTable(table);
    if (type === 'table') {
      if (!tableQuery.sourceId || !tableQuery.valueColumn || !tableQuery.textColumn) throw new Error('Selecione a fonte de origem e as colunas de valor e texto.');
      if (tableQuery.filters.some(f => !f.column || !f.field.trim() || !comparisons.some(c => c.value === f.operator))) throw new Error('Preencha coluna, comparação e identificador em todos os filtros.');
      return { ...tableQuery, filters: tableQuery.filters.map(f => ({ ...f, field: f.field.trim() })), mapping: { fields: parseFormFieldMapping(fieldMapping) } };
    }
    if (type === 'sql') {
      const normalized = normalizeSqlQuery(query);
      setQuery(normalized);
      return { query: normalized };
    }
    return { url, method, headers: headers.filter((h) => h.k), body, mapping: { ...mapping, fields: parseFormFieldMapping(fieldMapping) } satisfies ApiMapping };
  }

  async function runTest() {
    setResult(null);
    try { setResult(await test.mutateAsync({ type, config: buildConfig(), params: type === 'table' ? samples : undefined })); }
    catch (err) { toast.error(err instanceof ApiError ? (err.detail ?? 'Falha no teste.') : err instanceof Error ? err.message : 'Falha no teste.'); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = { name, description: description || undefined, scope, type, config: buildConfig() };
      if (id) await update.mutateAsync({ id, body }); else await create.mutateAsync(body);
      toast.success(id ? 'Fonte atualizada.' : `Fonte "${name}" criada.`);
      onClose();
    } catch (err) { toast.error(err instanceof ApiError ? (err.detail ?? err.message) : err instanceof Error ? err.message : 'Não foi possível salvar a fonte.'); }
  }

  const title = id ? 'Editar fonte de dados' : 'Nova fonte de dados';
  const footer = (
    <>
      <button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Cancelar</button>
      <button type="button" onClick={runTest} disabled={test.isPending} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"><Play size={14} /> Testar</button>
      <button form="ds-form" type="submit" disabled={!name} className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">Salvar</button>
    </>
  );

  if (fullPage) {
    return (
      <div className="flex h-screen flex-col bg-slate-100">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <div className="w-full space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            {renderForm()}
            {id && <UsagesSection id={id} />}
          </div>
        </main>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">{footer}</footer>
      </div>
    );
  }

  return (
    <Dialog open onClose={onClose} width="lg" title={title} footer={footer}>
      {renderForm()}
      {id && <UsagesSection id={id} />}
    </Dialog>
  );

  function renderForm() {
    return (
      <form id="ds-form" className="flex flex-col gap-3" onSubmit={save}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Nome"><TextInput required autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Tipo">
            <Select value={type} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} onChange={(e) => { setType(e.target.value as DataSourceType); setResult(null); }} />
          </Field>
        </div>
        <Field label="Descrição"><TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

        {type === 'fixed' && <FixedEditor items={items} setItems={setItems} />}
        {type === 'fixed-table' && <EditableTableEditor value={table} onChange={setTable} />}
        {type === 'table' && <>
          <TableQueryEditor value={tableQuery} onChange={setTableQuery} scope={scope} samples={samples} onSamples={setSamples} />
          <FormFieldMappingEditor value={fieldMapping} onChange={setFieldMapping} table />
        </>}
        {type === 'sql' && (
          <>
            <Field label="Consulta (SELECT ou procedure — somente leitura)" hint="Roda no banco do tenant. 1 coluna → valor=texto; 2 → valor,texto. Use @parametros. Suporta {{placeholders}} (resolvidos como parâmetro na execução).">
              <TextArea rows={5} value={query} onChange={(e) => setQuery(e.target.value)} className="font-mono text-xs" placeholder="SELECT id, nome FROM setores WHERE responsavel = {{requisitante.nome}}" />
            </Field>
            <PlaceholderHelp />
          </>
        )}
        {type === 'api' && (
          <>
            <ApiEditor url={url} setUrl={setUrl} method={method} setMethod={setMethod} headers={headers} setHeaders={setHeaders} body={body} setBody={setBody} mapping={mapping} setMapping={setMapping} fieldMapping={fieldMapping} setFieldMapping={setFieldMapping} />
            <PlaceholderHelp />
          </>
        )}

        {result && (type === 'api' ? <ApiTestResult result={result} /> : <>
          <ResultTable result={result} />
          {type === 'table' && result.mappedResult && result.mappedResult.rows.length > 0 && <ResultTable result={result.mappedResult} title="Resultado mapeado" />}
        </>)}
      </form>
    );
  }
}

/** Lista onde a fonte de dados é utilizada (campos, tarefas, rotinas, relatórios). */
function UsagesSection({ id }: { id: string }) {
  const usages = useDataSourceUsages(id);
  const items = usages.data?.usages ?? [];
  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Onde é utilizada</p>
      {usages.isLoading ? <p className="text-sm text-slate-400">Carregando…</p>
        : items.length === 0 ? <p className="text-sm text-slate-400">Não está sendo utilizada em nenhum local.</p>
        : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Processo / Tarefa</th>
                  <th className="px-3 py-2 text-left font-medium">Campo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((u, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 align-top">
                      <div className="text-slate-800">{u.process ?? '—'}</div>
                      {u.task && <div className="text-xs text-slate-400">{u.task}</div>}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">{u.field ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function FixedEditor({ items, setItems }: { items: FixedItem[]; setItems: (v: FixedItem[]) => void }) {
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  }
  function sortBy(field: 'value' | 'label') {
    setItems([...items].sort((a, b) => (a[field] ?? '').localeCompare(b[field] ?? '', 'pt-BR', { numeric: true })));
  }
  return (
    <Field label="Itens">
      <div className="mb-1.5 flex items-center gap-2 text-xs">
        <span className="text-slate-400">Ordenar:</span>
        <button type="button" onClick={() => sortBy('value')} className="rounded border border-slate-300 px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-50">por valor</button>
        <button type="button" onClick={() => sortBy('label')} className="rounded border border-slate-300 px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-50">por texto</button>
        <span className="text-slate-400">· use ↑/↓ para ordenar manualmente</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="leading-none text-slate-400 hover:text-slate-800 disabled:opacity-30" title="Subir">▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="leading-none text-slate-400 hover:text-slate-800 disabled:opacity-30" title="Descer">▼</button>
            </div>
            <TextInput value={it.value} placeholder="valor" onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
            <TextInput value={it.label} placeholder="texto" onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={15} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setItems([...items, { value: '', label: '' }])} className="self-start text-xs font-medium text-slate-600 hover:text-slate-900">+ adicionar item</button>
      </div>
    </Field>
  );
}

function ApiEditor(p: {
  url: string; setUrl: (v: string) => void; method: string; setMethod: (v: string) => void;
  headers: ApiHeader[]; setHeaders: (v: ApiHeader[]) => void; body: string; setBody: (v: string) => void;
  mapping: { repeat: string; value: string; text: string }; setMapping: (v: { repeat: string; value: string; text: string }) => void;
  fieldMapping: string; setFieldMapping: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <Field label="URL"><TextInput value={p.url} onChange={(e) => p.setUrl(e.target.value)} placeholder="https://api.exemplo.gov.br/dados" /></Field>
        <Field label="Método"><Select value={p.method} options={['GET', 'POST', 'PUT'].map((m) => ({ value: m, label: m }))} onChange={(e) => p.setMethod(e.target.value)} /></Field>
      </div>
      <Field label="Headers">
        <div className="flex flex-col gap-1.5">
          {p.headers.map((h, i) => (
            <div key={i} className="flex gap-2">
              <TextInput value={h.k} placeholder="parâmetro" onChange={(e) => p.setHeaders(p.headers.map((x, j) => j === i ? { ...x, k: e.target.value } : x))} />
              <TextInput value={h.v} placeholder="valor" onChange={(e) => p.setHeaders(p.headers.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} />
              <button type="button" onClick={() => p.setHeaders(p.headers.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><X size={15} /></button>
            </div>
          ))}
          <button type="button" onClick={() => p.setHeaders([...p.headers, { k: '', v: '' }])} className="self-start text-xs font-medium text-slate-600 hover:text-slate-900">+ header</button>
        </div>
      </Field>
      {p.method !== 'GET' && <Field label="Body (JSON)"><TextArea rows={3} value={p.body} onChange={(e) => p.setBody(e.target.value)} className="font-mono text-xs" /></Field>}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">Mapeamento das opções</legend>
        <p className="text-xs text-slate-600">Use caminhos JSON pontilhados. Valor e texto são usados em campos de seleção. Para uma resposta com um único objeto, deixe o nó de repetição vazio.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Nó de repetição"><TextInput value={p.mapping.repeat} placeholder="data.itens" onChange={(e) => p.setMapping({ ...p.mapping, repeat: e.target.value })} /></Field>
          <Field label="Nó de valor"><TextInput value={p.mapping.value} placeholder="id" onChange={(e) => p.setMapping({ ...p.mapping, value: e.target.value })} /></Field>
          <Field label="Nó de texto"><TextInput value={p.mapping.text} placeholder="nome" onChange={(e) => p.setMapping({ ...p.mapping, text: e.target.value })} /></Field>
        </div>
      </fieldset>
      <FormFieldMappingEditor value={p.fieldMapping} onChange={p.setFieldMapping} />
    </>
  );
}

function FormFieldMappingEditor({ value, onChange, table = false }: { value: string; onChange: (value: string) => void; table?: boolean }) {
  return <Field label="Mapeamento dos campos do formulário">
    <p className="text-xs text-slate-600">Informe <code>{table ? 'identificador => coluna' : 'identificador => caminho JSON'}</code>, um por linha. {table ? 'Use o nome exato da coluna da tabela de origem.' : 'O caminho parte de cada item do nó de repetição ou da resposta inteira, se esse nó estiver vazio.'}</p>
    <TextArea rows={4} value={value} onChange={e => onChange(e.target.value)} className="font-mono text-xs" placeholder={table ? 'codigo_atividade => Código da atividade' : 'status_pagamento => Situacao\nvalor_pago => ValorPago'} />
    <p className="text-xs text-slate-600">No modelador, abra <strong>Formulário</strong>, selecione o campo e copie a opção <strong>Chave (identificador)</strong> no painel de propriedades.</p>
    <p className="text-xs text-slate-600">Ao executar a fonte, os valores retornados preenchem os campos indicados. Em uma lista de opções, o preenchimento acompanha a opção selecionada.</p>
  </Field>;
}

function ApiTestResult({ result }: { result: TestResult }) {
  const original = result.originalResponse ?? '';
  const mapped = result.mappedResult;
  return (
    <div className="space-y-3" aria-live="polite">
      <section className="overflow-hidden rounded-md border border-slate-200" aria-label="Resultado original">
        <h2 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">Resultado original</h2>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs text-slate-700">{original || 'Resposta sem conteúdo.'}</pre>
      </section>
      {result.mappingError && <p role="alert" className="text-sm text-rose-700">{result.mappingError}</p>}
      {mapped && mapped.columns.length > 0 && mapped.rows.length > 0 && <ResultTable result={mapped} title="Resultado mapeado" />}
    </div>
  );
}

function ResultTable({ result, title = 'Resultado' }: { result: DataSourceTable; title?: string }) {
  return (
    <div className="rounded-md border border-slate-200">
      <p className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">{title} ({result.rows.length} linha{result.rows.length === 1 ? '' : 's'})</p>
      <div className="max-h-48 overflow-auto" tabIndex={0} role="region" aria-label={title}>
        <table className="w-full text-xs">
          <thead className="bg-white text-slate-500"><tr>{result.columns.map((c) => <th key={c} className="px-3 py-1.5 text-left font-medium">{c}</th>)}</tr></thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100">{row.map((cell, j) => <td key={j} className="px-3 py-1.5 text-slate-700">{cell == null ? <span className="text-slate-500">null</span> : typeof cell === 'object' ? JSON.stringify(cell) : String(cell)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Lista os placeholders disponíveis; clicar copia o token para a área de transferência. */
function PlaceholderHelp() {
  const [open, setOpen] = useState(false);
  const ph = usePlaceholders();
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
        <Braces size={12} /> {open ? 'Ocultar' : 'Ver'} placeholders
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-600">Placeholders são marcadores substituídos por dados do requisitante, do executor, do processo ou do formulário ao executar a fonte. Use-os na consulta SQL, na URL, nos headers ou no corpo da API. Clique em um marcador para copiar.</p>
          {ph.isPending && <p role="status" className="text-xs text-slate-600">Carregando placeholders…</p>}
          {ph.isError && <p role="alert" className="text-xs text-rose-700">Não foi possível carregar os placeholders. <button type="button" onClick={() => void ph.refetch()} className="underline">Tentar novamente</button></p>}
          {(ph.data?.groups ?? []).map((g) => (
            <div key={g.group}>
              <p className="text-xs font-semibold text-slate-600">{g.group}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {g.items.map((it) => (
                  <button key={it.token} type="button" title={`${it.label} — clique para copiar`}
                    onClick={async () => { try { await navigator.clipboard.writeText(it.token); toast.success('Placeholder copiado.'); } catch { toast.error('Não foi possível copiar o placeholder. Selecione o texto e copie manualmente.'); } }}
                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-slate-100">{it.token}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
            <p className="font-semibold">Placeholders de formulários</p>
            <p>Para um campo simples, use <code className="select-all break-all">{'{{formulario.identificador}}'}</code>. Exemplo: <code className="select-all break-all">{'{{formulario.cpf}}'}</code>. Substitua o identificador pela Chave (identificador) do campo, disponível ao selecioná-lo no editor de Formulário do modelador.</p>
            <p>Para campos de uma tabela, use <code className="select-all break-all">{'{{formulario.chave_da_tabela.identificador}}'}</code>. Exemplo: <code className="select-all break-all">{'{{formulario.itens.valor}}'}</code>. Os valores das linhas são unidos por vírgula e espaço.</p>
            <p>No teste do editor, requisitante e executor correspondem ao usuário conectado, e os dados do processo são exemplos. Os valores do formulário ficam disponíveis durante o preenchimento ou a execução do processo.</p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { useDataSource, useDataSourcesList, type DataSourceScope } from '@/lib/api/data-sources';
import { comparisons, importEditableTable, readEditableTable, type EditableTable, type TableQuery } from '@/lib/table-data-source';

const button = 'inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export function EditableTableEditor({ value, onChange }: { value: EditableTable; onChange: (value: EditableTable) => void }) {
  const [preview, setPreview] = useState<EditableTable | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(value.rows.length / 50) - 1));
  return <section className="min-w-0 space-y-3" aria-label="Tabela editável">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-sm font-medium text-slate-800">Tabela editável</h2><p className="text-xs text-slate-600">Adicione linhas e colunas ou importe a primeira aba de uma planilha. A primeira linha contém os cabeçalhos.</p></div>
      <label className="block text-sm text-slate-700">Importar planilha (.xlsx, .xls ou .csv)
        <input type="file" accept=".xlsx,.xls,.csv" disabled={busy} className="mt-1 block w-full max-w-sm text-xs file:mr-2 file:rounded file:border file:border-slate-300 file:bg-white file:px-2 file:py-1.5" onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
          setBusy(true); setError('');
          try { setPreview(await importEditableTable(file)); }
          catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível ler a planilha.'); }
          finally { setBusy(false); }
        }} />
      </label>
    </div>
    {busy && <p role="status" className="text-sm text-slate-600">Lendo planilha…</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {preview && <div className="space-y-2 rounded border border-slate-300 p-3">
      <p className="text-sm text-slate-700">Prévia: {preview.rows.length} linhas e {preview.columns.length} colunas. A importação substituirá a tabela atual.</p>
      <p className="break-words text-xs text-slate-600">Colunas: {preview.columns.join(', ')}</p>
      <div className="max-h-40 overflow-auto"><table className="text-xs"><thead><tr>{preview.columns.map(c => <th key={c} className="px-2 py-1 text-left">{c}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 5).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="px-2 py-1">{cell}</td>)}</tr>)}</tbody></table></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => { onChange(preview); setPage(0); setPreview(null); }}>Usar dados importados</button><button type="button" className={button} onClick={() => setPreview(null)}>Cancelar importação</button></div>
    </div>}
    <div className="overflow-auto rounded border border-slate-200" role="region" aria-label="Células da tabela editável" tabIndex={0}>
      <table className="w-full text-sm"><thead className="bg-slate-50"><tr>
        {value.columns.map((column, i) => <th key={i} className="min-w-44 p-2 text-left font-medium"><div className="flex items-center gap-1">
          <TextInput aria-label={`Nome da coluna ${i + 1}`} value={column} onChange={e => onChange({ ...value, columns: value.columns.map((c, j) => j === i ? e.target.value : c) })} />
          <button type="button" aria-label={`Remover coluna ${i + 1}`} className="rounded p-1 text-slate-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onChange({ columns: value.columns.filter((_, j) => j !== i), rows: value.rows.map(row => row.filter((_, j) => j !== i)) })}><Trash2 size={15} /></button>
        </div></th>)}<th className="w-10"><span className="sr-only">Ações</span></th>
      </tr></thead><tbody>{value.rows.slice(pageIndex * 50, pageIndex * 50 + 50).map((row, offset) => { const i = pageIndex * 50 + offset; return <tr key={i} className="border-t border-slate-100">
        {value.columns.map((column, j) => <td key={j} className="p-2"><TextInput aria-label={`Linha ${i + 1}, ${column || `coluna ${j + 1}`}`} value={row[j] ?? ''} onChange={e => onChange({ ...value, rows: value.rows.map((r, k) => k === i ? value.columns.map((_, n) => n === j ? e.target.value : r[n] ?? '') : r) })} /></td>)}
        <td className="p-2"><button type="button" aria-label={`Remover linha ${i + 1}`} className="rounded p-1 text-slate-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onChange({ ...value, rows: value.rows.filter((_, j) => j !== i) })}><Trash2 size={15} /></button></td>
      </tr>; })}</tbody></table>
      {!value.rows.length && <p className="p-3 text-sm text-slate-600">Nenhuma linha cadastrada. Adicione uma linha ou importe uma planilha.</p>}
    </div>
    {value.rows.length > 50 && <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700"><button type="button" className={button} disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)}>Página anterior</button><span>Página {pageIndex + 1} de {Math.ceil(value.rows.length / 50)} · {value.rows.length} linhas</span><button type="button" className={button} disabled={(pageIndex + 1) * 50 >= value.rows.length} onClick={() => setPage(pageIndex + 1)}>Próxima página</button></div>}
    <p className="text-xs text-slate-600 sm:hidden">Deslize a tabela para acessar todas as colunas.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={!value.columns.length || value.rows.length >= 10000} onClick={() => { onChange({ ...value, rows: [...value.rows, value.columns.map(() => '')] }); setPage(Math.floor(value.rows.length / 50)); }}><Plus size={14} /> Adicionar linha</button>
      <button type="button" className={button} disabled={value.columns.length >= 100} onClick={() => {
        let name = `Coluna ${value.columns.length + 1}`;
        while (value.columns.includes(name)) name += ' nova';
        onChange({ columns: [...value.columns, name], rows: value.rows.map(row => [...row, '']) });
      }}><Plus size={14} /> Adicionar coluna</button>
    </div>
  </section>;
}

export function TableQueryEditor({ value, onChange, scope, samples, onSamples }: {
  value: TableQuery; onChange: (value: TableQuery) => void; scope: DataSourceScope;
  samples: Record<string, string>; onSamples: (value: Record<string, string>) => void;
}) {
  const sources = useDataSourcesList(scope);
  const source = useDataSource(value.sourceId || null);
  const table = readEditableTable(source.data?.config);
  const columns = [{ value: '', label: 'Selecione a coluna' }, ...table.columns.map(c => ({ value: c, label: c }))];
  return <div className="min-w-0 space-y-3">
    <Field label="Fonte Fixa (Tabela)"><Select aria-label="Fonte Fixa (Tabela)" value={value.sourceId} options={[{ value: '', label: sources.isLoading ? 'Carregando fontes…' : 'Selecione uma fonte' }, ...(sources.data ?? []).filter(s => s.type === 'fixed-table').map(s => ({ value: s.id, label: s.name }))]} onChange={e => onChange({ ...value, sourceId: e.target.value, valueColumn: '', textColumn: '', filters: [] })} /></Field>
    {sources.error && <p role="alert" className="text-sm text-rose-700">Não foi possível carregar as fontes. Reabra esta página para tentar novamente.</p>}
    {source.isLoading && <p role="status" className="text-sm text-slate-600">Carregando colunas…</p>}
    {source.error && <p role="alert" className="text-sm text-rose-700">Não foi possível carregar a tabela de origem. Selecione outra fonte ou reabra esta página.</p>}
    {value.sourceId && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Coluna de valor"><Select aria-label="Coluna de valor" value={value.valueColumn} options={columns} onChange={e => onChange({ ...value, valueColumn: e.target.value })} /></Field>
        <Field label="Coluna de texto"><Select aria-label="Coluna de texto" value={value.textColumn} options={columns} onChange={e => onChange({ ...value, textColumn: e.target.value })} /></Field>
      </div>
      <section className="space-y-2" aria-label="Filtros do formulário"><h2 className="text-sm font-medium text-slate-800">Filtros do formulário</h2><p className="text-xs text-slate-600">Todos os filtros devem ser atendidos. Enquanto algum campo estiver vazio, a fonte aguarda seu preenchimento.</p>
        <div className="overflow-auto rounded border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{['Coluna da tabela', 'Comparação', 'Identificador do campo', 'Ações'].map(c => <th key={c} className="px-2 py-2 text-left font-medium">{c}</th>)}</tr></thead><tbody>{value.filters.map((filter, i) => <tr key={i}>
          <td className="min-w-40 p-2"><Select aria-label={`Coluna do filtro ${i + 1}`} value={filter.column} options={columns} onChange={e => onChange({ ...value, filters: value.filters.map((f, j) => j === i ? { ...f, column: e.target.value } : f) })} /></td>
          <td className="min-w-40 p-2"><Select aria-label={`Comparação do filtro ${i + 1}`} value={filter.operator} options={comparisons} onChange={e => onChange({ ...value, filters: value.filters.map((f, j) => j === i ? { ...f, operator: e.target.value } : f) })} /></td>
          <td className="min-w-44 p-2"><TextInput aria-label={`Identificador do filtro ${i + 1}`} value={filter.field} onChange={e => onChange({ ...value, filters: value.filters.map((f, j) => j === i ? { ...f, field: e.target.value } : f) })} /></td>
          <td className="p-2"><button type="button" className={button} aria-label={`Remover filtro ${i + 1}`} onClick={() => onChange({ ...value, filters: value.filters.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></td>
        </tr>)}</tbody></table></div>
        {!value.filters.length && <p className="text-xs text-slate-600">Sem filtros: todas as linhas serão consideradas.</p>}
        <button type="button" className={button} onClick={() => onChange({ ...value, filters: [...value.filters, { column: '', operator: 'eq', field: '' }] })}><Plus size={14} /> Adicionar filtro</button>
        <p className="text-xs text-slate-600">No modelador, selecione o campo no Formulário e copie a opção Chave (identificador).</p>
      </section>
      {!!value.filters.length && <fieldset className="space-y-2"><legend className="text-sm font-medium text-slate-800">Valores para testar</legend><p className="text-xs text-slate-600">Simule os valores dos campos e clique em Testar. Estes exemplos não são salvos na fonte.</p><div className="grid gap-2 sm:grid-cols-2">{[...new Set(value.filters.map(f => f.field).filter(Boolean))].map(field => <Field key={field} label={`Teste: ${field}`}><TextInput value={samples[field] ?? ''} onChange={e => onSamples({ ...samples, [field]: e.target.value })} /></Field>)}</div></fieldset>}
      <p className="text-xs text-slate-600">Combobox: apresenta os resultados como opções. Campo de texto: preenche os textos separados por vírgula.</p>
    </>}
  </div>;
}

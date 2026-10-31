export type EditableTable = { columns: string[]; rows: string[][] };
export const comparisons = [
  { value: 'eq', label: 'Igual a' }, { value: 'ne', label: 'Diferente de' },
  { value: 'contains', label: 'Contém' }, { value: 'starts', label: 'Começa com' },
  { value: 'gt', label: 'Maior que' }, { value: 'gte', label: 'Maior ou igual a' },
  { value: 'lt', label: 'Menor que' }, { value: 'lte', label: 'Menor ou igual a' },
];
export type TableFilter = { column: string; operator: string; field: string };
export type TableQuery = { sourceId: string; valueColumn: string; textColumn: string; filters: TableFilter[] };

export function validateEditableTable(table: EditableTable): EditableTable {
  const columns = table.columns.map(c => c.trim());
  if (!columns.length || columns.length > 100 || columns.some(c => !c) || new Set(columns.map(c => c.toLocaleLowerCase('pt-BR'))).size !== columns.length)
    throw new Error('Informe até 100 colunas com nomes únicos e preenchidos.');
  if (table.rows.length > 10000) throw new Error('A tabela editável deve conter até 10.000 linhas.');
  return { columns, rows: table.rows.map(row => columns.map((_, i) => row[i] ?? '')) };
}

export function readEditableTable(value: unknown): EditableTable {
  if (!value || typeof value !== 'object' || !('columns' in value) || !('rows' in value)
    || !Array.isArray(value.columns) || !value.columns.every((c): c is string => typeof c === 'string') || !Array.isArray(value.rows)) return { columns: [], rows: [] };
  return { columns: value.columns, rows: value.rows.filter(Array.isArray).map(row => row.map(cell => String(cell ?? ''))) };
}

export function readTableQuery(value: unknown): TableQuery {
  const result: TableQuery = { sourceId: '', valueColumn: '', textColumn: '', filters: [] };
  if (!value || typeof value !== 'object') return result;
  if ('sourceId' in value && typeof value.sourceId === 'string') result.sourceId = value.sourceId;
  if ('valueColumn' in value && typeof value.valueColumn === 'string') result.valueColumn = value.valueColumn;
  if ('textColumn' in value && typeof value.textColumn === 'string') result.textColumn = value.textColumn;
  if ('filters' in value && Array.isArray(value.filters)) for (const filter of value.filters) {
    if (filter && typeof filter === 'object' && typeof filter.column === 'string' && typeof filter.operator === 'string' && typeof filter.field === 'string')
      result.filters.push({ column: filter.column, operator: filter.operator, field: filter.field });
  }
  return result;
}

export async function importEditableTable(file: File): Promise<EditableTable> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Importe uma planilha de até 10 MB.');
  const { read, utils } = await import('xlsx');
  const workbook = read(await file.arrayBuffer(), { type: 'array', cellText: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('A planilha não contém uma aba com dados.');
  const data = utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
  const [columns, ...rows] = data;
  if (!columns?.length) throw new Error('A primeira linha da planilha deve conter os nomes das colunas.');
  if (rows.some(row => row.length > columns.length)) throw new Error('Existem células sem cabeçalho. Preencha todos os nomes de colunas na primeira linha.');
  return validateEditableTable({ columns, rows });
}

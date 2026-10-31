export type SearchColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
  options?: readonly { value: string; label: string }[];
};

function normalized(value: string | number | null | undefined): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function filterRows<T>(rows: readonly T[], columns: readonly SearchColumn<T>[], query: string, filters: Readonly<Record<string, string>>): T[] {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  return rows.filter(row => {
    const values = columns.map(column => ({ column, text: normalized(column.value(row)) }));
    return terms.every(term => values.some(value => value.text.includes(term)))
      && values.every(({ column, text }) => {
        const filter = normalized(filters[column.key]);
        return !filter || (column.options ? text === filter : text.includes(filter));
      });
  });
}

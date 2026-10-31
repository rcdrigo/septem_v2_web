export async function fetchSearchRows<T>(loadPage: (page: number) => Promise<{ items: T[]; total: number; page: number }>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await loadPage(page);
    if (result.page !== page || (!result.items.length && rows.length < result.total)) {
      throw new Error('Não foi possível carregar todos os registros. Tente novamente.');
    }
    rows.push(...result.items);
    if (rows.length >= result.total) return rows;
  }
}

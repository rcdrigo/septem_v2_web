import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from '../../node_modules/esbuild/lib/main.js';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-combined-search-'));
try {
  await build({ entryPoints: [join(root, 'src/lib/combined-search.ts'), join(root, 'src/lib/paginated-search.ts')], outdir: dir, format: 'esm', platform: 'node', outExtension: { '.js': '.mjs' } });
  const { filterRows } = await import(join(dir, 'combined-search.mjs'));
  const { fetchSearchRows } = await import(join(dir, 'paginated-search.mjs'));
  const rows = [
    { name: 'João Silva', email: 'joao@saude.gov', status: 'Ativo', access: 'Interno' },
    { name: 'João Silva', email: 'joao@obras.gov', status: 'Desativado', access: 'Interno' },
    { name: 'Maria', email: 'maria@saude.gov', status: 'Ativo', access: 'Externo' },
  ];
  const columns = [
    { key: 'name', value: row => row.name },
    { key: 'email', value: row => row.email },
    { key: 'status', value: row => row.status, options: [{value:'Ativo',label:'Ativo'}] },
    { key: 'access', value: row => row.access, options: [{value:'Interno',label:'Interno'}] },
  ];
  assert.deepEqual(filterRows(rows, columns, 'joao saude', { status: 'Ativo', access: 'Interno' }), [rows[0]], 'texto entre colunas, acentos e filtros se combinam por E');
  assert.deepEqual(filterRows(rows, columns, '', { status: 'Ativo' }), [rows[0], rows[2]], 'status usa correspondência exata');
  assert.deepEqual(filterRows(rows, columns, 'maria', { access: 'Interno' }), [], 'nenhum filtro é ignorado quando a interseção fica vazia');
  assert.deepEqual(filterRows(rows, columns, '   ', {}), rows, 'limpar a busca devolve os registros');
  assert.deepEqual(filterRows(rows, columns, '', { name: 'silva', email: 'obras' }), [rows[1]], 'dois filtros textuais por coluna são combinados');
  const calls = [];
  const all = await fetchSearchRows(async page => { calls.push(page); return { page, total: rows.length, items: rows.slice((page - 1) * 2, page * 2) }; });
  assert.deepEqual(calls, [1, 2], 'busca percorre todas as páginas mesmo quando o servidor limita o tamanho');
  assert.deepEqual(all, rows);
  await assert.rejects(fetchSearchRows(async () => ({ page: 1, total: 4, items: rows.slice(0, 2) })), /todos os registros/, 'paginação inconsistente não apresenta resultado parcial como completo');
  await assert.rejects(fetchSearchRows(async page => ({ page, total: 1, items: [] })), /todos os registros/);
  console.log('PASSOU: interseção de filtros, busca por todas as colunas, acentos e carregamento completo da paginação.');
} finally { await rm(dir, { recursive: true, force: true }); }

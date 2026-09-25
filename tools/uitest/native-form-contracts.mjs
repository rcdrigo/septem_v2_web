// Contract tests, no browser/API mocks. Persistence is tested against PostgreSQL in the backend.
import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'native-form-contracts-'));
try {
  await build({ entryPoints: ['src/lib/native-form.ts'], bundle: true, platform: 'node', format: 'esm', outfile: join(dir, 'contract.mjs') });
  const { createNativeForm, parseNativeForm, nativeFields, filterNativeAnswers } = await import(pathToFileURL(join(dir, 'contract.mjs')));
  const fixture = JSON.parse(await readFile(new URL('./fixtures/native-form-v1.json', import.meta.url), 'utf8'));
  const initial = parseNativeForm(createNativeForm());
  assert.equal(initial.tabs.length, 1);
  assert.equal(initial.tabs[0].groups.length, 1);
  assert.equal(initial.tabs[0].groups[0].type, 'group');
  assert.notEqual(createNativeForm().id, initial.id);
  const draft = structuredClone(initial);
  draft.tabs[0].groups[0].fields.push({ id: crypto.randomUUID(), kind: 'field', type: 'textfield', label: 'Texto', key: '' });
  assert.equal(parseNativeForm(draft).tabs[0].groups[0].fields[0].key, '', 'rascunho aceita chave ainda não preenchida');
  const opened = parseNativeForm(JSON.parse(JSON.stringify(fixture)));
  assert.deepEqual(opened, fixture);
  const moved = opened.tabs[0].groups[0].fields.shift();
  moved.label = 'Nome completo';
  opened.tabs[1].groups[0].fields.push(moved);
  const reopened = parseNativeForm(JSON.parse(JSON.stringify(opened)));
  const field = nativeFields(reopened).find(f => f.field.id === 'field-name');
  assert.equal(field.field.key, 'nome');
  assert.equal(field.field.label, 'Nome completo');
  assert.equal(field.tabId, 'tab-2');
  assert.deepEqual(field.field.config, fixture.tabs[0].groups[0].fields[0].config);
  assert.equal(nativeFields(fixture).length, 5); // presentation excluded, table columns included
  assert.equal(nativeFields(fixture).find(f => f.field.key === 'produto').path, 'itens[].produto');
  assert.notEqual(nativeFields(fixture)[0].groupId, nativeFields(fixture)[1].groupId); // homonymous groups
  const payload = { nome: 'Ana', scriptOnly: 'no', 'text-1': 'no', itens: [{ produto: 'A', quantidade: 0, ativo: false, extra: 'no' }, { produto: 'B' }] };
  const answers = filterNativeAnswers(fixture, payload);
  assert.deepEqual(answers, { nome: 'Ana', itens: [{ produto: 'A', quantidade: 0, ativo: false }, { produto: 'B' }] });
  answers.itens[0].produto = 'Changed';
  assert.equal(payload.itens[0].produto, 'A');
  assert.deepEqual(filterNativeAnswers(fixture, { itens: [] }), { itens: [] });
  assert.deepEqual(filterNativeAnswers(fixture, { nome: null }), { nome: null });
  assert.deepEqual(filterNativeAnswers(fixture, { scriptOnly: 'no' }), {});
  for (const value of [null, {}, [null], ['row']]) assert.throws(() => filterNativeAnswers(fixture, { itens: value }));
  const invalid = [
    x => { x.schemaVersion = 2; }, x => { x.tabs = []; },
    x => { x.tabs[0].groups = []; }, x => { x.tabs[0].groups[0].fields[0].id = x.id; },
    x => { x.tabs[1].groups[1].fields[0].key = 'nome'; },
    x => { x.tabs[1].groups[1].key = 'nome'; },
    x => { x.tabs[1].groups[1].fields.push(x.tabs[0].groups[0].fields.pop()); },
    x => { x.tabs[0].groups[0].groups = []; },
    x => { x.tabs[0].groups[0].fields[0].key = '__proto__'; },
    x => { x.tabs[0].groups[0].fields[0].type = 'unknown'; },
    x => { x.tabs[0].groups[0].fields[0].config = { number: Infinity }; },
    x => { x.tabs[0].groups[0].fields[0].key = 'a'.repeat(121); },
    x => { x.tabs[0].groups[0].fields[0].label = 'a'.repeat(241); },
    x => { x.tabs[0].groups[0].fields[0].config = { date: new Date() }; },
    x => { x.tabs[0].groups[0].fields[1].key = 'presentation'; },
  ];
  for (const change of invalid) { const bad = structuredClone(fixture); change(bad); assert.throws(() => parseNativeForm(bad)); }
  assert.throws(() => parseNativeForm({ type: 'default', components: [] }));
  console.log('PASSOU: estrutura inicial, identidade, round-trip, configuração, unicidade, apresentação, respostas e tabelas nativas.');
} finally { await rm(dir, { recursive: true, force: true }); }

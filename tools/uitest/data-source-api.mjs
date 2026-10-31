import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-api-source-'));
await build({ stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {DataSourceDialog} from './src/pages/admin/FontesDadosPage';import {ReactForm} from './src/components/form/ReactForm';
import {useToastStore} from './src/stores/toast';
const root=createRoot(document.getElementById('root')),ref=React.createRef(),client=new QueryClient({defaultOptions:{queries:{retry:false}}});let key=0;
window.messages=()=>useToastStore.getState().toasts.map(t=>t.message);
window.editor=(id)=>flushSync(()=>root.render(<QueryClientProvider client={client}><DataSourceDialog key={++key} id={id} scope="process" fullPage onClose={()=>window.closedEditor=true}/></QueryClientProvider>));
window.form=(schema,data={},optionsByField={},automationScripts=[])=>flushSync(()=>root.render(<QueryClientProvider client={client}><ReactForm key={++key} ref={ref} schema={schema} data={data} optionsByField={optionsByField} automationScripts={automationScripts}/></QueryClientProvider>));
window.submit=()=>ref.current.submit();window.data=()=>ref.current.getData();
`, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'app.js'), platform: 'browser', format: 'iife', tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' } });

const fields = { status_pagamento: 'Situacao', comprovante_pagamento_boleto: 'ImagemUrl', valor_pago: 'ValorPago' };
const mappingText = Object.entries(fields).map(([key, path]) => `${key} => ${path}`).join('\n');
const original = JSON.stringify({ Situacao: 'Pago', ImagemUrl: 'https://exemplo.gov.br/arquivo.pdf', ValorPago: 0 });
const rawResult = { columns: ['value', 'text'], rows: [], originalResponse: original, mappedResult: null };
const mappedResult = { ...rawResult, mappedResult: { columns: Object.keys(fields), rows: [['Pago', 'https://exemplo.gov.br/arquivo.pdf', 0]] } };
const saved = { name: 'Pagamento', type: 'api', scope: 'process', config: { url: 'https://exemplo.gov.br/pagamento', method: 'GET', headers: [], body: '', mapping: { repeat: '', value: '', text: '', fields } } };
const groups = [
  { group: 'Requisitante', items: ['nome', 'email'].map(key => ({ token: `{{requisitante.${key}}}`, label: key })) },
  { group: 'Executor', items: ['nome', 'email'].map(key => ({ token: `{{executor.${key}}}`, label: key })) },
  { group: 'Processo', items: ['nome', 'numero', 'id'].map(key => ({ token: `{{processo.${key}}}`, label: key })) },
];
const field = (key, type = 'textfield') => ({ id: `f-${key}`, kind: 'field', type, key, label: key, config: {} });
const formSchema = (table = false) => ({ format: 'septem-native', schemaVersion: 1, id: 'form', tabs: [{ id: 'tab', label: 'Cadastro', groups: [
  { id: 'g', label: 'Dados', type: 'group', fields: [field('cpf'), ...(table ? [] : [field('consulta', 'select'), field('status_pagamento'), field('valor_pago', 'number'), field('ativo', 'checkbox')])] },
  ...(table ? [{ id: 't', type: 'table', key: 'itens', label: 'Itens', fields: [field('consulta', 'select'), field('status_pagamento'), field('valor_pago', 'number')] }] : []),
] }] });
const options = [
  { value: 'a', label: 'Pagamento A', fieldValues: { status_pagamento: 'Pago A', valor_pago: 0, ativo: false, inexistente: 'ignorar' } },
  { value: 'b', label: 'Pagamento B', fieldValues: { status_pagamento: 'Pago B', valor_pago: 20, ativo: true } },
];
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.setDefaultTimeout(15000);
    const requests = [], errors = [];
    let response = rawResult;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://localhost/**', async route => {
      const req = route.request(), url = new URL(req.url());
      if (!url.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' });
      if (url.pathname.endsWith('/placeholders')) return route.fulfill({ json: { groups } });
      if (url.pathname.endsWith('/source/usages')) return route.fulfill({ json: { usages: [] } });
      if (url.pathname.endsWith('/source') && req.method() === 'GET') return route.fulfill({ json: { id: 'source', ...saved } });
      if (['POST', 'PUT'].includes(req.method())) {
        requests.push({ path: url.pathname, body: req.postDataJSON() });
        if (url.pathname.endsWith('/test')) return route.fulfill({ json: response });
        if (url.pathname.endsWith('/field-options')) return route.fulfill({ json: { options, fieldValues: options[0].fieldValues } });
        return route.fulfill({ json: { id: 'source' } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto('http://localhost');
    for (const file of await readdir(join(root, 'dist/assets'))) if (file.endsWith('.css')) await page.addStyleTag({ content: await readFile(join(root, 'dist/assets', file), 'utf8') });
    await page.addScriptTag({ path: join(dir, 'app.js') });
    await page.evaluate(() => window.editor());
    await page.getByLabel('Nome', { exact: true }).fill('Pagamento');
    await page.locator('#ds-form select').first().selectOption('api');
    await page.getByLabel('URL', { exact: true }).fill(saved.config.url);
    await page.getByText('Editar mapeamento em texto', {exact:true}).click();
    const mapping = page.getByRole('textbox', { name: /Mapeamento dos campos do formulário/, includeHidden: true });
    await page.getByRole('button', { name: 'Testar', exact: true }).click();
    await page.getByRole('region', { name: 'Resultado original' }).waitFor();
    assert.match(await page.locator('pre').innerText(), /Situacao/);
    assert.equal(await page.getByRole('table').count(), 0, 'sem mapeamento, somente resposta original');
    await mapping.fill(mappingText);
    response = mappedResult;
    await page.getByRole('button', { name: 'Testar', exact: true }).click();
    await page.getByRole('columnheader', { name: 'valor_pago', exact: true }).waitFor();
    assert.deepEqual(requests.at(-1).body.config.mapping.fields, fields);
    assert.deepEqual(await page.getByRole('columnheader').allTextContents(), Object.keys(fields));
    assert.equal(await page.getByRole('cell', { name: '0', exact: true }).count(), 1);
    assert.ok(await page.locator('pre').evaluate(pre => !!(pre.compareDocumentPosition(document.querySelector('table')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    await page.getByRole('button', { name: 'Ver placeholders', exact: true }).click();
    for (const group of groups) for (const item of group.items) await page.getByRole('button', { name: item.token, exact: true }).waitFor();
    assert.match(await page.locator('#ds-form').innerText(), /Placeholders são marcadores/);
    assert.match(await page.locator('#ds-form').innerText(), /\{\{formulario.identificador\}\}/);
    assert.match(await page.locator('#ds-form').innerText(), /\{\{formulario.chave_da_tabela.identificador\}\}/);
    assert.match(await page.locator('#ds-form').innerText(), /Chave \(identificador\)/);
    await mkdir(join(root, '.impeccable/review'), { recursive: true });
    await page.screenshot({ path: join(root, `.impeccable/review/data-source-api-${width}.png`), fullPage: true });
    await page.getByRole('table').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(root, `.impeccable/review/data-source-api-results-${width}.png`), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'sem overflow horizontal');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.waitForFunction(() => window.closedEditor);
    assert.deepEqual(requests.at(-1).body.config.mapping.fields, fields);
    await page.evaluate(() => window.editor('source'));
    await page.getByRole('textbox', { name: 'Campo do formulário', exact: true }).first().waitFor();
    assert.deepEqual(await page.getByRole('textbox', { name: 'Campo do formulário', exact: true }).evaluateAll(inputs => inputs.map(input => input.value)), Object.keys(fields), 'edição por linhas recupera as associações salvas');
    await page.getByLabel('Nome', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(root, `.impeccable/review/data-source-api-editor-${width}.png`) });
    const jsonPath = page.getByRole('textbox', { name: 'Caminho no JSON', exact: true }).last();
    await jsonPath.fill('ValorPagoAlternativo');
    await page.getByRole('button', { name: 'Testar', exact: true }).click();
    assert.equal(requests.at(-1).body.config.mapping.fields.valor_pago, 'ValorPagoAlternativo', 'edição por linhas altera o mapeamento enviado');
    await jsonPath.fill('ValorPago');
    await page.getByText('Editar mapeamento em texto', {exact:true}).click();
    assert.equal(await mapping.inputValue(), mappingText, 'edição recupera o mapeamento salvo');
    response = { ...rawResult, originalResponse: '[]', mappedResult: { columns: Object.keys(fields), rows: [] } };
    await page.getByRole('button', { name: 'Testar', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('pre')?.textContent === '[]');
    assert.equal(await page.getByRole('table').count(), 0, 'resultado mapeado vazio fica oculto');
    response = { ...rawResult, originalResponse: '<html>Falha na API</html>', mappingError: 'A API retornou HTTP 403. Confira o resultado original.' };
    await page.getByRole('button', { name: 'Testar', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'HTTP 403' }).waitFor();
    assert.match(await page.locator('pre').innerText(), /<html>Falha na API<\/html>/);
    const count = requests.length;
    await mapping.fill('valor_pago sem separador');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.waitForFunction(() => window.messages().some(text => text.startsWith('Linha 1:')));
    assert.equal(requests.length, count, 'configuração inválida não é salva');

    // Seleção usa os valores da própria linha, com número zero e booleano falso.
    await page.evaluate(([schema, options]) => window.form(schema, {}, { consulta: options }), [formSchema(), options]);
    await page.getByRole('combobox', { name: 'consulta', exact: true }).selectOption('b');
    await page.getByRole('textbox', { name: 'status_pagamento', exact: true }).fill('edição manual');
    await page.getByRole('combobox', { name: 'consulta', exact: true }).selectOption('a');
    let data = await page.evaluate(() => window.data());
    assert.equal(data.status_pagamento, 'Pago A'); assert.equal(data.valor_pago, 0); assert.equal(data.ativo, false); assert.equal('inexistente' in data, false);
    await page.evaluate(([schema, options]) => window.form(schema, { itens: [{}, {}] }, { consulta: options }), [formSchema(true), options]);
    await page.getByRole('combobox', { name: 'consulta', exact: true }).nth(1).selectOption('b');
    data = await page.evaluate(() => window.data());
    assert.equal(data.itens.length, 1, 'serialização nativa descarta a linha vazia');
    assert.equal(data.itens[0].status_pagamento, 'Pago B'); assert.equal(data.itens[0].valor_pago, 20);
    assert.equal(await page.getByRole('textbox', { name: 'status_pagamento', exact: true }).nth(0).inputValue(), '');
    assert.equal(await page.getByRole('textbox', { name: 'status_pagamento', exact: true }).nth(1).inputValue(), 'Pago B');

    // A chamada explícita aplica o retorno e envia os dados atuais como contexto de placeholders.
    await page.evaluate(schema => window.form(schema, {}, {}, [{ taskId: '', code: "form.on('change','cpf',async()=>{await form.dataSource('source');});" }]), formSchema());
    await page.getByRole('textbox', { name: 'cpf', exact: true }).fill('123456');
    await page.waitForFunction(() => window.data().status_pagamento === 'Pago A');
    assert.equal(requests.at(-1).body.formData.cpf, '123456');
    const submission = await page.evaluate(() => window.submit());
    assert.deepEqual(submission.errors, {}); assert.equal(submission.data.valor_pago, 0); assert.equal(submission.data.ativo, false);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASSOU: criar/editar API, resultados original/mapeado, placeholders, seleção e preenchimento (${width}px).`);
  }
} finally { await browser.close(); await rm(dir, { recursive: true, force: true }); }

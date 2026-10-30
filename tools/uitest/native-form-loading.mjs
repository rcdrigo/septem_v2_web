// Real modeler and form controller; only HTTP responses are simulated.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-form-loading-'));
const definition = JSON.parse(await readFile(join(root, 'tools/uitest/fixtures/native-form-v1.json'), 'utf8'));
const emptyXml = await readFile(join(root, 'src/assets/empty-diagram.bpmn'), 'utf8');
const schemaXml = JSON.stringify(definition).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const xml = emptyXml.replace('<bpmn:definitions ', '<bpmn:definitions xmlns:septem="http://septem.app/schema/1.0/bpmn" ')
  .replace('<bpmn:startEvent', `<bpmn:extensionElements><septem:formSchema>${schemaXml}</septem:formSchema></bpmn:extensionElements><bpmn:startEvent`);

await build({
  stdin: { contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {ModeladorPage} from './src/pages/modelador/ModeladorPage';
import {useSessionStore} from './src/stores/session';
import {useModeladorStore} from './src/stores/modelador';
import {useFormStore} from './src/stores/form';
import {getEmbeddedFormSchema} from './src/lib/bpmn-process';
import {setExtensionConfig} from './src/lib/bpmn-helpers';
import Modeler from 'bpmn-js/lib/Modeler';
window.loadingMetrics={referenceScans:0,serializations:0};
const stringify=JSON.stringify;
JSON.stringify=function(value,...args){if(value?.format==='septem-native')window.loadingMetrics.serializations++;return stringify.call(JSON,value,...args);};
const importXML=Modeler.prototype.importXML;
Modeler.prototype.importXML=function(...args){window.modeler=this;return importXML.apply(this,args);};
useSessionStore.setState({accessToken:'test-token',status:'idle',user:null});
window.view=view=>useModeladorStore.getState().setCurrentView(view);
window.flush=()=>useModeladorStore.getState().flushForm();
window.fields=()=>useFormStore.getState().fields;
window.schema=()=>getEmbeddedFormSchema(window.modeler,true);
window.reference=fieldRef=>setExtensionConfig(window.modeler,window.modeler.get('elementRegistry').get('StartEvent_1'),'septem:ActorConfig',{actorType:'formField',fieldRef});
window.saveXml=()=>window.modeler.saveXML({format:true});
const router=createMemoryRouter([{path:'/flows/edit',element:<ModeladorPage/>}],{initialEntries:['/flows/edit?key=loading']});
const tree=<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RouterProvider router={router}/></QueryClientProvider>;
createRoot(document.getElementById('root')).render(location.search.includes('strict')?<React.StrictMode>{tree}</React.StrictMode>:tree);
`, resolveDir: root, loader: 'tsx' },
  plugins: [{ name: 'loading-test', setup(b) {
    b.onResolve({ filter: /\?raw$/ }, args => ({ path: resolve(args.path.startsWith('@/') ? join(root, 'src') : args.resolveDir, args.path.replace(/^@\//, '').replace(/\?raw$/, '')), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
    b.onLoad({ filter: /native-form-references\.ts$/ }, async args => ({
      contents: (await readFile(args.path, 'utf8')).replace('const result: NativeReference[] = [];', 'window.loadingMetrics.referenceScans++;const result: NativeReference[] = [];'),
      loader: 'ts', resolveDir: dirname(args.path),
    }));
  } }],
  bundle: true, outfile: join(dir, 'app.js'), platform: 'browser', format: 'iife',
  tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' },
});

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const width of [1280, 375]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    await page.route('http://localhost/**', async route => {
      const request = route.request(), url = request.url();
      if (!url.includes('/api/')) return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' });
      if (['POST', 'PUT'].includes(request.method())) writes.push(request.postDataJSON());
      const body = url.includes('/api/v1/me') ? { id: 'test', name: 'Admin', email: 'admin@local', isInternal: true, perms: ['*'], accessProfiles: [] }
        : url.includes('/api/tenant/config') ? { tenantId: 'test' }
        : url.includes('/process-definitions/') ? { key: 'loading', name: 'Carregamento', version: 1, status: 'draft', bpmnXml: xml, hasInstances: false } : [];
      await route.fulfill({ json: body });
    });
    await page.goto(`http://localhost/flows/edit${width === 375 ? '?strict=1' : ''}`);
    await page.clock.install();
    for (const file of await readdir(join(root, 'dist/assets'))) if (file.endsWith('.css')) await page.addStyleTag({ content: await readFile(join(root, 'dist/assets', file), 'utf8') });
    await page.addScriptTag({ path: join(dir, 'app.js') });
    await page.waitForFunction(() => window.fields?.().length === 5).catch(async error => {
      console.error({ width, errors, body: await page.locator('body').innerText(), fields: await page.evaluate(() => window.fields?.()) });
      throw error;
    });
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    assert.equal(await page.locator('[data-native-editor]').count(), 0, 'Fluxo inicial não monta o editor oculto');
    await page.evaluate(() => window.flush());
    assert.deepEqual(await page.evaluate(() => window.schema()), definition, 'Salvar sem visitar o formulário preserva a definição');
    assert.equal(await page.evaluate(() => window.loadingMetrics.referenceScans), 0);
    await page.evaluate(() => { window.loadingMetrics.serializations = 0; });
    await page.clock.fastForward(3000);
    await page.evaluate(() => window.flush());
    assert.equal(await page.evaluate(() => window.loadingMetrics.serializations), 0, 'Formulário sem revisão nova não é serializado');

    await page.evaluate(() => window.view('formulario'));
    await page.locator('[data-native-editor]').waitFor({ state: 'visible' });
    await page.locator('[data-field-id="field-name"]').getByRole('button', { name: 'Nome Texto', exact: true }).click();
    const scans = await page.evaluate(() => window.loadingMetrics.referenceScans);
    await page.locator('[data-field-id="text-1"]').getByRole('button', { name: 'Instruções HTML', exact: true }).click();
    await page.locator('[data-field-id="field-name"]').getByRole('button', { name: 'Nome Texto', exact: true }).click();
    assert.equal(await page.evaluate(() => window.loadingMetrics.referenceScans), scans, 'Seleção visual reutiliza referências');
    await page.evaluate(() => window.reference('ausente'));
    await page.getByText('Corrija as referências antes de publicar', { exact: true }).waitFor();
    await page.evaluate(() => window.modeler.get('commandStack').undo());
    await page.getByText('Corrija as referências antes de publicar', { exact: true }).waitFor({ state: 'hidden' });
    await page.evaluate(() => window.modeler.get('commandStack').redo());
    await page.getByText('Corrija as referências antes de publicar', { exact: true }).waitFor();
    await page.evaluate(() => window.reference(undefined));
    await page.getByText('Corrija as referências antes de publicar', { exact: true }).waitFor({ state: 'hidden' });
    await page.evaluate(() => window.modeler.get('eventBus').fire('import.done'));
    await page.locator('[data-native-editor]').waitFor({ state: 'visible' });
    await page.locator('[data-field-id="field-name"]').getByRole('button', { name: 'Nome Texto', exact: true }).click();

    await page.getByLabel('Nome', { exact: true }).fill('Nome revisado');
    await page.evaluate(() => window.flush());
    const revised = await page.evaluate(() => window.schema());
    assert.equal(revised.tabs[0].groups[0].fields[0].label, 'Nome revisado', 'Flush imediato inclui a edição antes dos 600ms');
    assert.equal(revised.tabs[0].groups[0].fields[0].id, 'field-name');
    await page.evaluate(() => { window.loadingMetrics.serializations = 0; });
    await page.clock.fastForward(3000);
    assert.equal(await page.evaluate(() => window.loadingMetrics.serializations), 0);
    await page.evaluate(() => window.view('fluxo'));
    await page.evaluate(() => window.view('formulario'));
    assert.equal(await page.getByLabel('Nome', { exact: true }).inputValue(), 'Nome revisado', 'Trocar de view mantém a seleção e o rascunho');
    await page.getByLabel('Nome', { exact: true }).fill('Edição para sincronizar');
    await page.clock.fastForward(600);
    assert.equal((await page.evaluate(() => window.schema())).tabs[0].groups[0].fields[0].label, 'Edição para sincronizar', 'Revisão nova é sincronizada automaticamente');
    await page.getByLabel('Nome', { exact: true }).fill('Edição após falha');
    const failure = await page.evaluate(async () => {
      const modeling = window.modeler.get('modeling'), updateProperties = modeling.updateProperties;
      modeling.updateProperties = function (...args) {
        modeling.updateProperties = updateProperties;
        throw new Error('Falha simulada de sincronização');
      };
      try { await window.flush(); } catch (error) { return error.message; }
    });
    assert.equal(failure, 'Falha simulada de sincronização');
    await page.evaluate(() => { window.loadingMetrics.serializations = 0; });
    await page.evaluate(() => window.flush());
    assert.ok(await page.evaluate(() => window.loadingMetrics.serializations > 0), 'Falha não marca a revisão como sincronizada');
    assert.equal((await page.evaluate(() => window.schema())).tabs[0].groups[0].fields[0].label, 'Edição após falha');
    const current = await page.evaluate(() => window.schema());
    await page.getByLabel('Importar definição nativa', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"components":[]}') });
    await page.getByText('Definição nativa inválida: form.', { exact: true }).waitFor();
    await page.evaluate(() => window.flush());
    assert.deepEqual(await page.evaluate(() => window.schema()), current, 'Importação inválida preserva o rascunho');
    const exported = await page.evaluate(() => window.saveXml());
    assert.ok(exported.xml.includes('Edição após falha'));
    assert.deepEqual(writes, [], 'Ensaio não grava dados na API');
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Sem overflow horizontal');
    await page.screenshot({ path: join(dir, `loading-${width}.png`) });
    console.log(`PASSOU ${width}px: montagem adiada, cache invalidado por edição/undo/redo/importação, revisão, flush e integridade`);
    await page.close();
  }
  console.log(`Capturas: ${dir}`);
} finally {
  await browser.close();
  await rm(join(dir, 'app.js'), { force: true });
}

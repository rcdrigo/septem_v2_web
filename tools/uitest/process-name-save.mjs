// Página administrativa e modelador reais em abas distintas; somente a API é simulada.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-process-name-'));
const emptyXml = await readFile(join(root, 'src/assets/empty-diagram.bpmn'), 'utf8');
await build({
  stdin: { contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {QueryClientProvider} from '@tanstack/react-query';
import {queryClient} from './src/lib/queryClient';
import {ModeladorPage} from './src/pages/modelador/ModeladorPage';
import {ProcessosPage} from './src/pages/processos/ProcessosPage';
import {useSessionStore} from './src/stores/session';
useSessionStore.setState({accessToken:'test-token',status:'idle',user:null});
const router=createMemoryRouter([
  {path:'/admin/flows',element:<ProcessosPage/>},
  {path:'/flows/edit',element:<ModeladorPage/>},
  {path:'/away',element:<p>Outra página</p>},
],{initialEntries:[location.pathname+location.search]});
window.navigate=path=>router.navigate(path);
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider>
);
`, resolveDir: root, loader: 'tsx' },
  plugins: [{ name: 'raw-bpmn', setup(b) {
    b.onResolve({ filter: /\?raw$/ }, args => ({
      path: resolve(args.path.startsWith('@/') ? join(root, 'src') : args.resolveDir, args.path.replace(/^@\//, '').replace(/\?raw$/, '')),
      namespace: 'raw',
    }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, async args => ({
      contents: await readFile(args.path, 'utf8'), loader: 'text', resolveDir: dirname(args.path),
    }));
  } }],
  bundle: true, outfile: join(dir, 'app.js'), platform: 'browser', format: 'iife',
  tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' },
});

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
});
try {
  for (const initialStatus of ['draft', 'published']) {
    const context = await browser.newContext();
    const errors = [];
    const writes = [];
    let definition = {
      key: 'existente', name: 'Nome anterior', version: 1, versions: [1], status: initialStatus,
      bpmnXml: emptyXml.replace('id="Process_1" isExecutable', 'id="Process_1" name="Nome anterior" isExecutable'),
      hasInstances: false, updatedAt: '2026-10-30T12:00:00Z',
    };
    await context.route('http://process-name.local/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!url.pathname.includes('/api/')) return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' });
      if (request.method() === 'PUT') {
        writes.push(request.method());
        const { bpmnXml } = request.postDataJSON();
        const name = bpmnXml.match(/<bpmn:process\b[^>]*\bname="([^"]*)"/)?.[1];
        assert.ok(name, 'Salvar deve enviar o nome no BPMN');
        definition = { ...definition, name, bpmnXml, status: 'draft', version: initialStatus === 'published' ? 2 : 1 };
        return route.fulfill({ json: { ...definition, warnings: [] } });
      }
      if (request.method() !== 'GET') writes.push(request.method());
      const body = url.pathname === '/api/v1/me'
        ? { id: 'test', name: 'Admin', email: 'admin@local', isInternal: true, perms: ['*'], accessProfiles: [] }
        : url.pathname === '/api/tenant/config' ? { tenantId: 'test' }
        : url.pathname === '/api/v1/workflow/process-definitions/' ? { items: [definition], total: 1, page: 1, pageSize: 20 }
        : url.pathname === '/api/v1/workflow/process-definitions/existente' ? definition : [];
      return route.fulfill({ json: body });
    });
    async function open(path) {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://process-name.local' + path);
      await page.addScriptTag({ path: join(dir, 'app.js') });
      return page;
    }
    const list = await open('/admin/flows');
    await list.getByRole('button', { name: 'Nome anterior', exact: true }).waitFor();
    const editor = await open('/flows/edit?key=existente');
    await editor.getByTitle('Clique para renomear o processo').filter({ hasText: 'Nome anterior' }).waitFor();
    async function renameAndSave(name) {
      await editor.bringToFront();
      await editor.getByTitle('Clique para renomear o processo').click();
      const input = editor.locator('header input').first();
      await input.fill(name);
      await input.press('Enter');
      await editor.getByRole('button', { name: 'Salvar', exact: true }).click();
      await editor.getByText(/Rascunho salvo/).last().waitFor();
      await editor.waitForFunction(() => !document.querySelector('button[aria-busy="true"]'));
      assert.equal(definition.name, name);
      assert.equal(definition.status, 'draft');
    }
    await renameAndSave('Nome salvo');
    await list.bringToFront();
    // O Chrome headless não alterna a visibilidade das abas. Envia o evento
    // de retorno à aba para o listener real do TanStack Query no window.
    await list.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
    await list.getByRole('button', { name: 'Nome salvo', exact: true }).waitFor({ timeout: 3000 });

    await list.evaluate(() => window.navigate('/away'));
    await renameAndSave('Nome revisado');
    await list.evaluate(() => window.navigate('/admin/flows'));
    await list.getByRole('button', { name: 'Nome revisado', exact: true }).waitFor({ timeout: 3000 });
    assert.deepEqual(writes, ['PUT', 'PUT'], 'Atualiza o nome sem publicar');
    assert.deepEqual(errors, []);
    console.log(`PASSOU: nome após salvar, voltar à aba e reabrir /admin/flows (${initialStatus})`);
    await context.close();
  }
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}

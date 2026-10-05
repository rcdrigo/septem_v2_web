import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.env.SEPTEM_WEB_ROOT ?? resolve(import.meta.dirname, '../..');
const require = createRequire(join(root, 'tools/uitest/package.json'));
const { build } = require(join(root, 'node_modules/esbuild'));
const { chromium } = require('playwright-core');
const dir = await mkdtemp(join(tmpdir(), 'septem-no-catalog-'));
let browser;
try {
  await build({
    stdin: {
      contents: `import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { MemoryRouter, Routes, Route } from 'react-router-dom';
        import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
        import { PlatformClientePage } from './src/pages/platform/PlatformClientePage';
        import { PlatformNovoClientePage } from './src/pages/platform/PlatformNovoClientePage';
        import { PlatformLayout } from './src/pages/platform/PlatformLayout';
        import { configurePlatformApi } from './src/lib/platform-api';
        import { usePlatformSession } from './src/stores/platform-session';
        configurePlatformApi({ getAccessToken: () => 'central', refresh: async () => null, logout: async () => {} });
        usePlatformSession.setState({ status: 'authenticated', identity: { id: 'super', name: 'Super Admin', email: 'super@example.test', roles: ['super_admin'], globalAccess: true } });
        createRoot(document.getElementById('root')).render(
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter initialEntries={[window.surface]}><Routes>
              <Route path='/platform' element={<PlatformLayout />}>
                <Route path='clients/new' element={<PlatformNovoClientePage />} />
                <Route path='clients/:id' element={<PlatformClientePage />} />
              </Route>
            </Routes></MemoryRouter>
          </QueryClientProvider>);`,
      resolveDir: root,
      loader: 'tsx',
    },
    bundle: true, outfile: join(dir, 'app.js'), format: 'iife', platform: 'browser',
    tsconfig: join(root, 'tsconfig.app.json'),
    define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://catalog-test.local' }) },
  });
  const css = (await Promise.all((await readdir(join(root, 'dist/assets')))
    .filter(name => name.endsWith('.css')).map(name => readFile(join(root, 'dist/assets', name), 'utf8')))).join('\n');
  browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  });
  for (const width of [1280, 375]) {
    const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 900 } });
    const page = await context.newPage();
    const errors = [], catalogRequests = [];
    let empty = false, clientMissing = false;
    await context.route('https://catalog-test.local/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>' });
      if (path.includes('/process-catalog')) {
        catalogRequests.push(path);
        return route.fulfill({ json: { items: [{ id: 'flow', key: 'license', name: 'Licenciamento', tenantId: 'source', clientName: 'Origem', version: 1, status: 'published', importable: true }], total: 1 } });
      }
      if (path.endsWith('/clients/acme')) return clientMissing
        ? route.fulfill({ status: 404, json: { detail: 'Cliente não encontrado' } })
        : route.fulfill({ json: {
          id: 'acme', name: 'Cliente Exemplo', status: 'active', canManageClient: true,
          environments: empty ? [] : ['production', 'staging'].map(purpose => ({
            tenantId: purpose === 'production' ? 'acme' : 'hml-acme', displayName: purpose === 'production' ? 'Produção Exemplo' : 'Homologação Exemplo',
            host: `${purpose}.example.test`, purpose, operatingMode: 'active', provisioningState: 'ready', clientCanEditCredentials: false,
          })), pendingOperations: [],
        } });
      if (path.endsWith('/metrics')) return route.fulfill({ json: { internalUsers: 8, externalUsers: 12, productionEnvironments: empty ? 0 : 1 } });
      if (path.endsWith('/provisioning-defaults')) return route.fulfill({ json: { displayName: 'Sistema', primaryColor: '#0f172a', baseDomain: 'example.test', initialSettings: {} } });
      if (path.endsWith('/features')) return route.fulfill({ json: { items: [{ key: 'forms', name: 'Formulários', implemented: true }] } });
      return route.fulfill({ json: { items: [] } });
    });
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(10000);
    async function open(surface) {
      await page.goto('https://catalog-test.local/');
      await page.evaluate(value => window.surface = value, surface);
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ path: join(dir, 'app.js') });
    }
    async function noCatalog() {
      assert.equal(await page.getByRole('heading', { name: /processos do catálogo/i }).count(), 0, 'O detalhamento ainda exibe processos do catálogo');
      assert.equal(await page.getByRole('button', { name: /^Importar / }).count(), 0);
      assert.equal(await page.locator('nav a[href*="process-catalog"]').count(), 0);
      assert.deepEqual(catalogRequests, [], 'A central ainda consulta o catálogo de processos');
    }
    await open('/platform/clients/acme');
    await page.getByRole('heading', { name: 'Cliente Exemplo', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Histórico do cliente' }).waitFor();
    await page.getByText('Ainda não há alterações registradas.', { exact: true }).waitFor();
    assert.equal(await page.getByTestId('platform-ambientes').locator('li').count(), 2);
    assert.equal(await page.getByRole('link', { name: 'Abrir ambiente', exact: true }).count(), 2);
    assert.equal(await page.getByRole('button', { name: 'Inativar cliente', exact: true }).count(), 1);
    await noCatalog();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: join(tmpdir(), `septem-client-no-catalog-${width}.png`), fullPage: true });
    empty = true;
    await open('/platform/clients/acme');
    await page.getByText('Este cliente ainda não tem ambientes.', { exact: true }).waitFor();
    await noCatalog();
    clientMissing = true;
    await open('/platform/clients/acme');
    await page.getByTestId('platform-cliente-404').waitFor();
    await noCatalog();
    await open('/platform/clients/new');
    await page.getByLabel('Nome do cliente', { exact: true }).fill('Novo Cliente');
    await page.getByRole('button', { name: 'Avançar', exact: true }).click();
    await page.getByLabel('Formulários', { exact: true }).waitFor();
    await noCatalog();
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}: detalhe com ambientes, vazio, 404 e cadastro sem catálogo ou requisições ao inventário.`);
    await context.close();
  }
} finally {
  await browser?.close();
  await rm(dir, { recursive: true, force: true });
}

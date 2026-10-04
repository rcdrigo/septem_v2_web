// Bootstrap real da sessão; a API simulada decide o destino, sem regra de host na SPA.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const directory = await mkdtemp(join(tmpdir(), 'septem-central-routing-'));
const apiOrigin = 'https://api.septemcompliance.com';
await build({
  stdin: {
    contents: `import {useSessionStore} from './src/stores/session';
      window.bootstrap = () => useSessionStore.getState().bootstrap();
      window.snapshot = () => useSessionStore.getState();`,
    resolveDir: root, loader: 'ts',
  },
  bundle: true, outfile: join(directory, 'app.js'), platform: 'browser', format: 'iife',
  tsconfig: join(root, 'tsconfig.app.json'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_API_URL: apiOrigin }) },
});

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
try {
  for (const central of [true, false]) {
    const origin = central ? 'https://new.admin.septemcompliance.com' : 'https://cliente.septemcompliance.com';
    const context = await browser.newContext();
    const calls = [];
    await context.route(`${apiOrigin}/**`, async route => {
      const request = route.request();
      assert.equal(request.headers().origin, origin);
      const headers = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'x-tenant,content-type',
      };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      calls.push(new URL(request.url()).pathname);
      assert.equal(calls.at(-1), '/api/tenant/config');
      await route.fulfill({ headers, json: central ? { redirectUrl: '/platform' } : {
        tenantId: 'cliente', clienteNome: 'Cliente', ambienteNome: 'Produção', primaryColor: '#123456', modulos: [],
      } });
    });
    await context.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body: '<div></div>' }));
    const page = await context.newPage();
    await page.goto(origin);
    if (central) await page.evaluate(() => localStorage.setItem('septem.accessToken', 'old-tenant-token'));
    await page.addScriptTag({ path: join(directory, 'app.js') });
    if (central) {
      // Um token de ambiente antigo também não deve disparar /me no host central.
      await page.evaluate(() => { void window.bootstrap(); });
      await page.waitForURL(`${origin}/platform`);
      assert.equal(await page.evaluate(() => localStorage.getItem('septem.tenant')), null);
    } else {
      await page.evaluate(() => window.bootstrap());
      const state = await page.evaluate(() => ({ status: window.snapshot().status, tenant: window.snapshot().tenant }));
      assert.equal(state.status, 'unauthenticated');
      assert.equal(state.tenant.tenantId, 'cliente');
      assert.equal(new URL(page.url()).pathname, '/');
    }
    assert.deepEqual(calls, ['/api/tenant/config']);
    console.log(`PASS bootstrap ${central ? 'central: /platform' : 'tenant: configuração preservada'}`);
    await context.close();
  }
} finally {
  await browser.close();
  await rm(directory, { recursive: true, force: true });
}

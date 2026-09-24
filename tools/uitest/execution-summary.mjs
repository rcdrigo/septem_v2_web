// Real list components with synthetic API responses; no persisted user data.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-inbox-'));
let browser;
try {
  await build({ stdin: { contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {TarefasPage} from './src/pages/TarefasPage';
import {InstanciasPage} from './src/pages/InstanciasPage';
import {useSessionStore} from './src/stores/session';
useSessionStore.setState({status:'authenticated',accessToken:'fixture',accessMode:'interno',user:{id:'actor',name:'Ana',isInternal:true,perms:['*'],accessProfiles:[]}});
const root=createRoot(document.getElementById('root')); let revision=0;
window.mount=kind=>root.render(<QueryClientProvider key={++revision} client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter>{kind==='tasks'?<TarefasPage/>:<InstanciasPage/>}</MemoryRouter></QueryClientProvider>);
`, resolveDir: root, loader: 'tsx' }, bundle: true, tsconfig: join(root, 'tsconfig.app.json'), outfile: join(dir, 'bundle.js'), platform: 'browser', format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } });
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(3000);
  const item = { id: 'one', executionId: 'one', name: 'Analisar', process: 'Processo', number: 100, processNumber: 100, status: 'em_andamento', createdAt: '2026-09-24T10:00:00Z', startedAt: '2026-09-24T10:00:00Z', tags: [], inboxText: 'Nome: Maria <Silva> & Filhos Prioridade alta', inboxHtml: '<b>Nome:</b> Maria &lt;Silva&gt; &amp; Filhos<br><em>Prioridade alta</em><script>window.inboxExecuted=true</script><img src=x onerror="window.inboxExecuted=true"><a href="javascript:alert(1)">Link</a>' };
  await page.route('https://inbox.test/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' });
    const items = [item, { ...item, id: 'two', executionId: 'two', inboxHtml: null, inboxText: 'Resumo da API anterior' }, { ...item, id: 'three', executionId: 'three', inboxHtml: null, inboxText: null }];
    return route.fulfill({ json: { items, processes: [], total: 3, page: 1, pageSize: 20 } });
  });
  await page.goto('https://inbox.test/');
  await page.addScriptTag({ path: join(dir, 'bundle.js') });
  for (const kind of ['tasks', 'requests']) {
    await page.evaluate(kind => window.mount(kind), kind);
    for (const mode of ['Cards', 'Tabela']) {
      await page.getByTitle(mode, { exact: true }).click();
      const container = page.locator(mode === 'Cards' ? 'article' : 'tbody tr').first();
      await container.waitFor();
      assert.equal(await container.locator('b').textContent(), 'Nome:', `${kind}/${mode}: preserves bold HTML`);
      assert.equal(await container.locator('em').textContent(), 'Prioridade alta');
      assert.equal(await container.locator('br').count(), 1);
      assert.ok((await container.textContent()).includes('Maria <Silva> & Filhos'));
      assert.equal(await container.locator('script,img,[onerror],[href^="javascript:"]').count(), 0);
      assert.equal(await page.evaluate(() => window.inboxExecuted), undefined);
      assert.ok(await page.getByText('Resumo da API anterior', { exact: true }).count() > 0);
      assert.ok(await page.getByText(kind === 'requests' && mode === 'Tabela' ? '—' : 'Sem resumo disponível.', { exact: true }).count() > 0);
      console.log(`PASS ${kind}/${mode}: HTML, literal values, safe content, text fallback and empty summary`);
    }
  }
} finally {
  await browser?.close();
  await rm(dir, { recursive: true, force: true });
}

// Exercises the real settings page and HTTP client with an isolated API fixture.
import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-settings-branding-'));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
let browser;
try {
  await build({ stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {MemoryRouter} from 'react-router-dom';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import {ParametrosPage} from './src/pages/admin/ParametrosPage';
    import {configureApi} from './src/lib/api';
    configureApi({getAccessToken:()=> 'tenant-token',refresh:async()=>null,logout:async()=>{}});
    const revoked=[]; const revoke=URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);}; window.revoked=revoked;
    createRoot(document.getElementById('root')).render(
      <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
        <MemoryRouter><ParametrosPage/></MemoryRouter>
      </QueryClientProvider>);
  `, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'app.js'), format: 'iife', platform: 'browser', tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://api.test' }) } });
  const css = (await Promise.all((await readdir(join(root, 'dist/assets'))).filter(f => f.endsWith('.css')).map(f => readFile(join(root, 'dist/assets', f), 'utf8')))).join('\n');
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  for (const width of [1280, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    let general = { tenantId: 'cliente', host: 'cliente.test', ambienteNome: 'Portal de serviços', logoUrl: null, heroImageUrl: null, primaryColor: '#0ea5e9', systemDescription: 'Serviços do município.', businessHourStart: 8, businessHourEnd: 18, businessDays: '1,2,3,4,5', stateCode: null, cityCode: null, cityName: null, timeZoneId: null };
    const uploads = [], saves = [];
    let releaseUpload, failUpload = false, refreshes = 0;
    await context.route('https://settings.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:auto!important;min-height:100%}#root>div{height:auto!important}#root>div>div{overflow:visible!important}</style><div id="root"></div>' }));
    await context.route('https://api.test/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
      if (request.method() === 'OPTIONS') return route.fulfill({ headers, body: '' });
      if (request.method() === 'POST' && path.includes('/settings/brand-assets/')) {
        uploads.push({ path, headers: request.headers(), body: request.postDataBuffer().toString() });
        await new Promise(resolve => { releaseUpload = resolve; });
        if (failUpload) return route.fulfill({ status: 400, headers, json: { detail: 'Imagem recusada. Tente outro arquivo.' } });
        return route.fulfill({ headers, json: { url: '/api/v1/branding/assets/' + uploads.length } });
      }
      if (request.method() === 'PUT' && path.endsWith('/settings/general')) {
        const payload = request.postDataJSON();
        saves.push(payload); general = { ...general, ...payload };
        return route.fulfill({ headers, json: { ok: true } });
      }
      if (path.includes('/branding/assets/')) return route.fulfill({ headers, contentType: 'image/png', body: png });
      if (path === '/api/tenant/config') { refreshes++; return route.fulfill({ headers, json: { tenantId: 'cliente', ...general } }); }
      if (path === '/api/v1/settings') return route.fulfill({ headers, json: { general, policies: {} } });
      if (path.endsWith('/locations/states')) return route.fulfill({ headers, json: { items: [] } });
      return route.fulfill({ headers, json: {} });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    async function open() {
      await page.goto('https://settings.test/');
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ path: join(dir, 'app.js') });
      await page.getByTestId('form-geral').waitFor();
    }
    async function waitUntil(predicate) {
      const deadline = Date.now() + 10000;
      while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(predicate(), 'expected API request reached its boundary');
    }
    await open();
    assert.equal(await page.locator('input[name=logoUrl][type=file]').count(), 1, 'logo must be an attachment');
    assert.equal(await page.locator('input[name=heroImageUrl][type=file]').count(), 1, 'hero must be an attachment');
    assert.equal(await page.locator('input[name=logoUrl]:not([type=file]), input[name=heroImageUrl]:not([type=file])').count(), 0, 'no URL text fields');
    const identity = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Identidade do sistema', exact: true }) }).first();
    assert.equal(await identity.locator('textarea[name=systemDescription]').count(), 1, 'description belongs to identity');
    assert.equal(await identity.getByRole('heading', { name: 'Tela de login', exact: true }).count(), 1, 'login is grouped under identity');
    for (const kind of ['logo', 'hero']) {
      releaseUpload = undefined;
      const input = page.locator(`input[name=${kind === 'logo' ? 'logoUrl' : 'heroImageUrl'}]`);
      await input.setInputFiles({ name: kind + '.png', mimeType: 'image/png', buffer: png });
      await page.getByText('Enviando imagem…', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Salvar', exact: true }).isDisabled(), true);
      assert.equal(await input.isDisabled(), true);
      assert.equal(await page.locator('fieldset[aria-busy=true]').count(), 1);
      await page.getByLabel('Nome do sistema', { exact: false }).press('Enter');
      assert.equal(saves.length, 0, 'Enter cannot save while upload is in flight');
      await waitUntil(() => releaseUpload); releaseUpload();
      await page.getByText(kind + '.png · Anexada', { exact: true }).waitFor();
      await page.waitForFunction(alt => document.querySelector(`img[alt="${alt}"]`)?.naturalWidth > 0,
        kind === 'logo' ? 'Prévia: logo do sistema' : 'Prévia: imagem de destaque');
      assert.equal(await input.inputValue(), '', 'same file can be selected again');
    }
    assert.ok(uploads.every(u => u.headers.authorization === 'Bearer tenant-token'));
    assert.ok(uploads.every(u => u.body.includes('name="file"') && u.headers['content-type'].includes('multipart/form-data; boundary=')));
    assert.deepEqual(uploads.map(u => u.path), ['/api/v1/settings/brand-assets/logo', '/api/v1/settings/brand-assets/hero']);
    const logo = page.getByAltText('Prévia: logo do sistema');
    const previousLogo = await logo.getAttribute('src');
    await page.locator('input[name=logoUrl]').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('text') });
    await page.getByRole('alert').filter({ hasText: 'Escolha uma imagem' }).waitFor();
    assert.equal(uploads.length, 2, 'invalid type never reaches upload API');
    failUpload = true; releaseUpload = undefined;
    await page.locator('input[name=logoUrl]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
    await waitUntil(() => releaseUpload); releaseUpload();
    await page.getByRole('alert').filter({ hasText: 'Imagem recusada' }).waitFor();
    assert.equal(await logo.getAttribute('src'), previousLogo, 'failed replacement preserves previous image');
    failUpload = false;
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await waitUntil(() => saves.length === 1);
    await waitUntil(() => refreshes === 1);
    await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
    assert.equal(saves[0].logoUrl, '/api/v1/branding/assets/1');
    assert.equal(saves[0].heroImageUrl, '/api/v1/branding/assets/2');
    assert.ok(!JSON.stringify(saves[0]).includes('blob:'), 'only persistent URLs are saved');
    await page.getByRole('button', { name: 'Remover logo', exact: true }).click();
    await logo.waitFor({ state: 'hidden' });
    assert.equal(await logo.count(), 0);
    assert.equal(await page.evaluate(() => window.revoked.length), 1, 'removed preview is released');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await waitUntil(() => saves.length === 2);
    await waitUntil(() => refreshes === 2);
    assert.equal(saves[1].logoUrl, null);
    assert.equal(saves[1].heroImageUrl, '/api/v1/branding/assets/2');
    await open();
    await page.waitForFunction(() => document.querySelector('img[alt="Prévia: imagem de destaque"]')?.naturalWidth > 0);
    assert.equal(await page.getByAltText('Prévia: logo do sistema').count(), 0, 'removal persists after reload');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no horizontal overflow');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(tmpdir(), `septem-settings-branding-${width}.png`), fullPage: true });
    console.log(`PASS ${width}: attachments, grouping, multipart upload, loading, validation, failure recovery, persistence, removal and responsive layout.`);
    await context.close();
  }
} finally {
  await browser?.close();
  await rm(dir, { recursive: true, force: true });
}

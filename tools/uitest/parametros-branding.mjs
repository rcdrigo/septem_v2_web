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
    const uploads = [], saves = [], otherSaves = [];
    let policies = Object.fromEntries(['email', 'storage', 'openrouter'].map(section => [section,{visible:true,editable:true}]));
    const sections = {
      email: {host:'smtp.test',port:587,useSsl:true,authMode:'none',user:null,passwordSet:false,fromAddress:'teste@cliente.test',fromName:'Cliente'},
      storage: {bucketName:'teste',region:null,endpoint:null,accessKey:null,secretKeySet:false,baseFolder:null,cdnUrl:null,useSignedUrls:true,urlExpirationMinutes:15,storageClass:'STANDARD',encryption:null,maxUploadMb:20,blockedExtensions:'exe'},
      openRouter: {model:'test/model',apiKeySet:false},
    };
    let releaseUpload, failUpload = false, refreshes = 0;
    await context.route('https://settings.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}</style><div id="root"></div>' }));
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
      if (request.method() === 'PUT' && path.startsWith('/api/v1/settings/')) {
        otherSaves.push({path,payload:request.postDataJSON()});
        return route.fulfill({headers,json:{ok:true}});
      }
      if (path === '/api/v1/settings') return route.fulfill({ headers, json: { general, ...sections, policies } });
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
    assert.equal(await page.getByRole('heading', { name: 'Horários úteis', exact: true }).count(), 0, 'hours card has only one main heading');
    assert.equal(await page.locator('legend:not(.sr-only)').filter({hasText:'Localização do ambiente'}).count(), 0, 'holiday card has no repeated visible title');
    const headerSave = page.locator('header').getByRole('button', {name:'Salvar',exact:true});
    assert.equal(await headerSave.count(), 1);
    assert.equal(await page.getByTestId('form-geral').locator('button[type=submit]').count(), 0);
    assert.equal(await headerSave.evaluate(button => button.form === document.querySelector('[data-testid=form-geral]')), true, 'header action retains native form validation');
    const initialSave = await headerSave.boundingBox();
    await page.getByTestId('settings-content').evaluate(el => {el.scrollTop = el.scrollHeight;});
    assert.deepEqual(await headerSave.boundingBox(), initialSave, 'saving stays in the same visible header position after scrolling');
    await page.screenshot({ path: join(tmpdir(), `septem-settings-calendar-${width}.png`) });
    await page.getByRole('heading', {name:'Horas úteis',exact:true}).evaluate(el => el.scrollIntoView({block:'start'}));
    await page.screenshot({ path: join(tmpdir(), `septem-settings-hours-${width}.png`) });
    await page.getByTestId('settings-content').evaluate(el => {el.scrollTop = 0;});
    await page.getByLabel('Nome do sistema', {exact:false}).fill('');
    await headerSave.click();
    assert.equal(saves.length, 0, 'header save enforces required fields');
    await page.getByLabel('Nome do sistema', {exact:false}).fill('Portal de serviços');
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
    assert.equal(await page.getByRole('button', {name:'Remover imagem',exact:true}).count(), 2);
    assert.equal(await page.getByRole('button', {name:'Remover imagem',exact:true}).first().locator('svg.lucide-trash-2').count(), 1);
    await page.getByRole('button', {name:'Remover imagem',exact:true}).first().scrollIntoViewIfNeeded();
    await page.screenshot({path:join(tmpdir(), `septem-settings-removal-${width}.png`)});
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
    await page.getByRole('group', { name: 'Logo do sistema', exact: true }).getByRole('button', { name: 'Remover imagem', exact: true }).click();
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
    await page.screenshot({ path: join(tmpdir(), `septem-settings-branding-${width}.png`) });
    for (const [tab,formName,label,endpoint] of [['E-mail','email','Testar e ativar','email'],['Arquivos','arquivos','Salvar','storage'],['OpenRouter','openrouter','Salvar','openrouter']]) {
      await page.getByRole('tab',{name:tab,exact:true}).click();
      const action = page.locator('header').getByRole('button',{name:label,exact:true});
      await action.waitFor();
      assert.equal(await page.locator('button[type=submit]').count(),1,'only active tab owns the header action');
      assert.equal(await action.evaluate((button, name) => button.form === document.querySelector(`[data-testid=form-${name}]`),formName),true);
      if(tab === 'E-mail') await page.getByRole('textbox',{name:'Destino do teste de e-mail',exact:true}).fill('teste@cliente.test');
      const previousCount = otherSaves.length;
      await action.click();
      await waitUntil(()=>otherSaves.length===previousCount+1);
      assert.equal(otherSaves.at(-1).path,`/api/v1/settings/${endpoint}`);
      await page.waitForFunction(()=>!document.querySelector('header button[type=submit]').disabled);
    }
    await page.getByRole('tab',{name:'Integrações',exact:true}).click();
    assert.equal(await page.locator('header button[type=submit]').count(),0,'read-only integrations have no save action');
    policies = Object.fromEntries(['email','storage','openrouter'].map(section => [section,{visible:true,editable:false}]));
    await open();
    for (const tab of ['E-mail','Arquivos','OpenRouter']) assert.equal(await page.getByRole('tab',{name:tab,exact:true}).count(),0,'uneditable integration tabs remain unavailable');
    console.log(`PASS ${width}: attachments, grouping, multipart upload, loading, validation, failure recovery, persistence, removal and responsive layout.`);
    await context.close();
  }
} finally {
  await browser?.close();
  await rm(dir, { recursive: true, force: true });
}

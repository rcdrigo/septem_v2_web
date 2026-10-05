import assert from 'node:assert/strict';
import { build } from '../../node_modules/esbuild/lib/main.js';
import { chromium } from 'playwright-core';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-login-branding-'));
const logo = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" rx="8" fill="#123456"/><text x="120" y="48" text-anchor="middle" fill="white" font-size="26">Cliente Teste</text></svg>';
const hero = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#46818a"/><circle cx="600" cy="300" r="230" fill="#a6d2cb"/></svg>';
let browser;
try {
  await build({ stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {MemoryRouter} from 'react-router-dom';
    import {LoginPage} from './src/pages/LoginPage';
    import {useSessionStore} from './src/stores/session';
    window.session = useSessionStore;
    const app = createRoot(document.getElementById('root'));
    window.unmount = () => app.unmount();
    const revoked = []; const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { revoked.push(url); revoke(url); }; window.revoked = revoked;
    app.render(<MemoryRouter initialEntries={['/login']}><LoginPage/></MemoryRouter>);
  `, resolveDir: root, loader: 'tsx' }, bundle: true, outfile: join(dir, 'app.js'), format: 'iife', platform: 'browser', tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://api.test', VITE_TENANT: 'hml-cliente', BASE_URL: '/' }) } });
  const css = (await Promise.all((await readdir(join(root, 'dist/assets'))).filter(f => f.endsWith('.css')).map(f => readFile(join(root, 'dist/assets', f), 'utf8')))).join('\n');
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  for (const width of [1280, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const images = [], errors = [];
    const tenant = { tenantId: 'hml-cliente', ambienteNome: 'Sistema Teste', primaryColor: '#123456', modulos: [], logoUrl: '/api/v1/branding/assets/logo', heroImageUrl: '/api/v1/branding/assets/hero', systemDescription: 'Serviços e processos do cliente em um só lugar.' };
    await context.route('https://hml-cliente.test/**', route => route.request().url().endsWith('/favicon.svg')
      ? route.fulfill({ contentType: 'image/svg+xml', body: logo })
      : route.request().url().includes('/api/')
        ? route.fulfill({ status: 404, body: 'API hosted separately' })
        : route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>' }));
    await context.route('https://images.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: hero }));
    await context.route('https://api.test/**', route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
      if (req.method() === 'OPTIONS') return route.fulfill({ headers, body: '' });
      if (path === '/api/tenant/config') return route.fulfill({ headers, json: tenant });
      if (path.startsWith('/api/v1/branding/assets/')) {
        images.push({ path, headers: req.headers() });
        if (req.headers()['x-tenant'] !== 'hml-cliente') return route.fulfill({ headers, status: 404 });
        return route.fulfill({ headers, contentType: 'image/svg+xml', body: path.endsWith('logo') ? logo : hero });
      }
      return route.fulfill({ headers, json: { items: [] } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://hml-cliente.test/login');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ path: join(dir, 'app.js') });
    await page.waitForFunction(() => window.session.getState().status === 'unauthenticated');
    try {
      await page.waitForFunction(() => [...document.querySelectorAll('.login-form-panel img, .login-tenant-brand img')].some(img => img.naturalWidth > 0));
    } catch {
      assert.fail('Logo do cliente não carregou no login com API em outra origem.');
    }
    const backgroundLoaded = await page.evaluate(async () => {
      const background = document.querySelector('[data-testid="login-hero"]').style.backgroundImage;
      const url = background.match(/^url\("?(.*?)"?\)$/)?.[1];
      if (!url) return false;
      return new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img.naturalWidth > 0); img.onerror = () => resolve(false); img.src = url; });
    });
    assert.ok(backgroundLoaded, 'Imagem de destaque carregou no hero');
    assert.equal(images.length, 2);
    assert.ok(images.every(image => image.headers['x-tenant'] === 'hml-cliente' && !image.headers.authorization), 'Imagens públicas recebem o tenant sem token de autenticação');
    if (!process.env.REPRO_ONLY) {
      assert.equal(await page.locator('.login-tenant-brand').count(), 0);
      assert.equal(await page.locator('.login-hero-panel img').count(), 0);
      assert.equal(await page.locator('.login-form-panel img').count(), 1);
      assert.equal(await page.locator('.login-hero-eyebrow').innerText(), tenant.ambienteNome);
      assert.equal(await page.locator('.login-hero-copy h2').innerText(), tenant.systemDescription);
      assert.equal(await page.getByText('Bem-vindo de volta', { exact: true }).count(), 0);
      assert.equal(await page.locator('.login-hero-copy p').count(), 0);
      assert.equal(await page.getByRole('heading', { name: 'Entrar', exact: true }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: join(tmpdir(), `septem-login-branding-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
      await page.getByRole('heading', { name: 'Esqueci minha senha' }).waitFor();
      await page.getByRole('button', { name: 'Voltar ao login', exact: true }).click();
      await page.evaluate(() => window.session.setState({ tenant: { ...window.session.getState().tenant, logoUrl: '/favicon.svg', heroImageUrl: 'https://images.test/hero.svg' } }));
      await page.waitForFunction(() => document.querySelector('.login-client-logo img')?.naturalWidth > 0 && document.querySelector('[data-testid="login-hero"]').style.backgroundImage.includes('images.test'));
      assert.equal(images.length, 2, 'Imagens externas e estáticas não passam pela API');
      await page.evaluate(() => window.session.setState({ tenant: { ...window.session.getState().tenant, logoUrl: null, heroImageUrl: null, systemDescription: null } }));
      await page.waitForFunction(() => !document.querySelector('.login-client-logo img'));
      assert.equal(await page.locator('.login-client-logo').innerText(), tenant.ambienteNome);
      assert.equal(await page.locator('.login-hero-copy h2').innerText(), 'Processos claros, conformidade em cada decisão.');
      assert.equal(await page.locator('.login-hero-overlay').count(), 0);
      await page.evaluate(value => window.session.setState({ tenant: { ...value, ambienteNome: 'Sistema de Gestão Integrada de Serviços e Processos do Cliente', systemDescription: 'Organize o atendimento e acompanhe todas as etapas dos serviços e processos da organização, com informações para orientar cada decisão e facilitar o trabalho diário das equipes.' } }), tenant);
      await page.waitForFunction(() => document.querySelector('.login-client-logo img')?.naturalWidth > 0 && document.querySelector('[data-testid="login-hero"]').style.backgroundImage.includes('blob:'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Nome e descrição longos não causam rolagem horizontal');
      await page.evaluate(() => window.unmount());
      assert.equal(await page.evaluate(() => window.revoked.length), 4, 'Imagens são liberadas na troca de configuração e ao desmontar a página');
      assert.deepEqual(errors, []);
    }
    console.log(`PASS ${width}: logo e hero carregados; identidade e layout do login verificados.`);
    await context.close();
  }
} finally {
  await browser?.close();
  await rm(dir, { recursive: true, force: true });
}

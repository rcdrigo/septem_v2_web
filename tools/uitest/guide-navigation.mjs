// Guia real com API simulada: histórico, hierarquia, busca por teclado e mobile.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright-core');
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dir = await mkdtemp(join(tmpdir(), 'septem-guide-'));
const manual = (id, title, parentId = null, order = 0, contentHtml = '<h2>Orientações</h2><p>Conteúdo do manual.</p>') => ({
  id, title, parentId, order, contentHtml, icon: null, audience: 'externo',
  categoryId: 'processos', categoryName: 'Processos', categoryOrder: 0,
});
const fixture = {
  tenantName: 'Septem', logoUrl: null, isInternal: true, canTechnical: true,
  welcome: { id: 'inicio', title: 'Como podemos ajudar?', description: 'Encontre orientações para usar o Septem.', categories: [] },
  external: [
    manual('pai', 'Criar processos'),
    manual('filho', 'Configurar tarefas', 'pai', 1),
    manual('neto', 'Publicação de processos', 'filho', 2,
      '<h2>Antes de publicar</h2><p>Faça a revisão das permissões e configurações do processo.</p>' +
      Array.from({ length: 16 }, () => '<p>Confira as informações, execute uma simulação e registre os resultados antes de publicar o processo.</p>').join('') +
      '<h2>Validação final</h2><p>Confirme a publicação.</p><h3>Permissões</h3><p>Somente pessoas autorizadas podem acessar.</p>' +
      '<pre>' + 'identificador_longo_'.repeat(30) + '</pre>' +
      '<table><tbody><tr><td>' + 'campo_longo_'.repeat(30) + '</td></tr></tbody></table>'),
    manual('outro', 'Consultar solicitações', null, 3),
    manual('orfao', 'Manual sem pai disponível', 'inexistente', 4),
  ],
  internal: [manual('interno', 'Rotinas internas')],
  technical: [
    manual('tecnico', 'Referência técnica'),
    manual('modelador-id-gerado', 'Modelador de processos', null, 1,
      '<h2>Responsáveis e prazos</h2><p>Defina a atribuição e o vencimento.</p>' +
      '<h2>Botões de ação</h2><p>Configure os resultados da tarefa.</p>' +
      '<h2>Salvando, testando e publicando</h2><p>Revise a versão antes de publicar.</p>'),
  ],
};
await build({
  stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {BrowserRouter} from 'react-router-dom';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import {GuidePage} from './src/pages/GuidePage';
    import {useSessionStore} from './src/stores/session';
    useSessionStore.setState({status:'unauthenticated'});
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><BrowserRouter><GuidePage/></BrowserRouter></QueryClientProvider>);
  `, resolveDir: root, loader: 'tsx' },
  bundle: true, outfile: join(dir, 'app.js'), platform: 'browser', format: 'iife',
  tsconfig: join(root, 'tsconfig.app.json'), define: { 'import.meta.env': '{}' },
});
const compiler = await compile(await readFile(join(root, 'src/styles/globals.css'), 'utf8'), {
  base: join(root, 'src/styles'), onDependency() {},
});
const scanner = new Scanner({ sources: [{ base: root, pattern: 'src/**/*.{tsx,ts}', negated: false }] });
const css = compiler.build(scanner.scan());
let componentCss = '';
try { await access(join(dir, 'app.css')); componentCss = await readFile(join(dir, 'app.css'), 'utf8'); } catch {}
const script = await readFile(join(dir, 'app.js'), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
let response = fixture;
await context.route('https://guide.local/**', route => {
  if (new URL(route.request().url()).pathname === '/api/v1/guide') return route.fulfill({ json: response });
  return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>' });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function open(path = '/guide') {
  await page.goto('https://guide.local' + path);
  await page.addStyleTag({ content: css + '\n' + componentCss });
  await page.addScriptTag({ content: script });
  await page.getByTestId('guide-busca').waitFor();
}
async function expectHeading(title) { await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor(); }
try {
  await open();
  await expectHeading(fixture.welcome.title);
  await page.locator('[data-testid="guide-menu-item"]:visible').filter({ hasText: 'Criar processos' }).click();
  await expectHeading('Criar processos');
  assert.ok(new URL(page.url()).search, 'Abrir manual deve atualizar URL');
  const parentUrl = page.url();
  await page.keyboard.press('Control+k');
  assert.equal(await page.getByTestId('guide-busca').evaluate(el => el === document.activeElement), true);
  await page.getByTestId('guide-busca').fill('publicacao');
  await page.getByTestId('guide-busca-resultado').first().waitFor();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expectHeading('Publicação de processos');
  const deepUrl = page.url();
  assert.notEqual(parentUrl, deepUrl);
  await page.locator('[data-testid="guide-menu-item"]:visible').filter({ hasText: 'Configurar tarefas' }).waitFor();
  await page.locator('[data-testid="guide-menu-item"]:visible').filter({ hasText: 'Publicação de processos' }).waitFor();
  await page.goBack();
  await expectHeading('Criar processos');
  await page.goForward();
  await expectHeading('Publicação de processos');
  await open(new URL(deepUrl).pathname + new URL(deepUrl).search);
  await expectHeading('Publicação de processos');
  const tocLink = page.getByTestId('guide-toc').getByRole('link', { name: 'Validação final', exact: true });
  await tocLink.click();
  await page.waitForFunction(() => location.hash.length > 1);
  const anchorUrl = page.url();
  await page.getByTestId('guide-toc').getByRole('link', { name: 'Antes de publicar', exact: true }).click();
  await page.goBack();
  await page.waitForFunction(() => {
    const heading = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const box = heading?.getBoundingClientRect();
    return box && box.top >= 0 && box.top < window.innerHeight;
  });
  assert.equal(page.url(), anchorUrl, 'Voltar entre seções deve restaurar hash');
  await open(new URL(anchorUrl).pathname + new URL(anchorUrl).search + new URL(anchorUrl).hash);
  await expectHeading('Publicação de processos');
  await page.waitForFunction(() => {
    const heading = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const box = heading?.getBoundingClientRect();
    return box && box.top >= 0 && box.top < window.innerHeight;
  });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedLink = text; } } });
  });
  await page.getByTestId('guide-copiar-link').click();
  assert.equal(await page.evaluate(() => window.copiedLink), page.url());
  await open(new URL(deepUrl).pathname + new URL(deepUrl).search + '#%');
  await expectHeading('Publicação de processos');
  console.log('PASSOU: links diretos, hierarquia, busca por teclado, histórico de artigos/seções e cópia de link');

  await open('/guide?tab=tecnico&manualKey=modelador-processos&section=responsaveis-prazos');
  await expectHeading('Modelador de processos');
  await page.waitForFunction(() => {
    const heading = [...document.querySelectorAll('h2')].find(item => item.textContent?.trim() === 'Responsáveis e prazos');
    const box = heading?.getBoundingClientRect();
    return box && box.top >= 0 && box.top < window.innerHeight;
  });
  assert.equal(new URL(page.url()).searchParams.get('manualKey'), 'modelador-processos');
  console.log('PASSOU: helper resolve chave estável e posiciona o capítulo técnico');

  await open(new URL(anchorUrl).pathname + new URL(anchorUrl).search + new URL(anchorUrl).hash);
  await expectHeading('Publicação de processos');
  await page.locator('#guide-scroll').evaluate(el => el.scrollTo({ top: 0 }));
  for (const width of [320, 375, 414, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow horizontal em ${width}px`);
    const article = await page.locator('article').boundingBox();
    assert.ok(article && article.width > Math.min(width - 50, 250), `Artigo sem espaço em ${width}px`);
    await page.screenshot({ path: join(dir, `guide-${width}.png`), fullPage: true });
    if (width === 375) await page.screenshot({ path: join(dir, 'guide-mobile.png'), fullPage: true });
    if (width === 1440) await page.screenshot({ path: join(dir, 'guide-desktop.png'), fullPage: true });
  }
  console.log('PASSOU: larguras 320, 375, 414, 768, 1024 e 1440');
  await page.setViewportSize({ width: 375, height: 900 });
  const tocSummary = page.getByTestId('guide-toc').locator('summary');
  assert.equal(await page.getByTestId('guide-toc').locator('details').getAttribute('open'), null);
  await tocSummary.click();
  await page.getByTestId('guide-toc').getByRole('link', {name:'Validação final', exact:true}).click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="guide-toc"] details').open);
  const menuButton = page.getByRole('button', { name: 'Menu', exact: true });
  await menuButton.click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement)), true, 'Foco deve entrar no menu');
  for (let i = 0; i < 18; i++) await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement)), true, 'Foco deve permanecer no menu');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await menuButton.evaluate(el => el === document.activeElement), true, 'Fechar menu deve devolver foco');
  console.log('PASSOU: menu mobile e foco');

  response = { ...fixture, isInternal: false, canTechnical: false, internal: [], technical: [] };
  await open('/guide?tab=tecnico&manualKey=modelador-processos&section=responsaveis-prazos');
  await expectHeading(fixture.welcome.title);
  assert.equal(await page.getByTestId('guide-tab-tecnico').count(), 0);
  assert.equal(await page.getByText('Referência técnica', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASSOU: público sem acesso às abas restritas');
  console.log('Capturas: ' + dir);
} finally {
  await browser.close();
}

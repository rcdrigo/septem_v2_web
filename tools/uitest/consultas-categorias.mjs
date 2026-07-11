import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

// ── 1. Consultas: agrupamento, cores e filtro ────────────────────────────────
await page.goto(BASE + '/consultas', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/consultas-desktop.png` });

const state = await page.evaluate(() => {
  const headers = [...document.querySelectorAll('section h2')].map((h) => h.textContent?.trim());
  const pills = [...document.querySelectorAll('button[aria-pressed]')].map((b) => b.textContent?.trim());
  const cards = [...document.querySelectorAll('section .grid > div')].map((c) => c.textContent ?? '');
  const openBtns = [...document.querySelectorAll('section button')].filter((b) => b.textContent?.includes('Abrir'));
  return { headers, pills, cards, colors: openBtns.map((b) => b.style.backgroundColor) };
});
check(state.headers.includes('Financeiro') && state.headers.includes('Sem categoria'), `agrupamentos: ${JSON.stringify(state.headers)}`);
check(state.pills.includes('Todas') && state.pills.includes('Financeiro'), `pílulas: ${JSON.stringify(state.pills)}`);
// #0e7490 = rgb(14, 116, 144)
check(state.colors.some((c) => c === 'rgb(14, 116, 144)'), `botão Abrir herda cor da categoria: ${JSON.stringify(state.colors)}`);
check(!state.cards.some((t) => t.includes('Financeiro')), 'nome da categoria NÃO aparece dentro do card');

await page.locator('button[aria-pressed]', { hasText: 'Financeiro' }).click();
await page.waitForTimeout(300);
const filtered = await page.evaluate(() => [...document.querySelectorAll('section h2')].map((h) => h.textContent?.trim()));
check(filtered.length === 1 && filtered[0] === 'Financeiro', `filtro mostra só o grupo: ${JSON.stringify(filtered)}`);

// mobile
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(400);
const mobOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
check(!mobOverflow, 'consultas mobile sem scroll horizontal');
await page.screenshot({ path: `${OUT}/consultas-mobile.png` });
await page.setViewportSize({ width: 1280, height: 900 });

// ── 2. Menu: Categorias sumiu do grupo Relatórios ────────────────────────────
await page.goto(BASE + '/admin/relatorios', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const menuItems = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('aside li')];
  const rel = groups.find((li) => li.querySelector('button span')?.textContent?.trim() === 'Relatórios e Dashboards');
  return [...(rel?.querySelectorAll('ul a') ?? [])].map((a) => a.textContent?.trim());
});
check(!menuItems.includes('Categorias'), `menu Relatórios sem "Categorias": ${JSON.stringify(menuItems)}`);

// ── 3. Modal de categorias de relatórios: criar, editar, excluir ─────────────
await page.locator('main button, header button', { hasText: 'Categorias' }).first().click().catch(async () => {
  await page.locator('button', { hasText: 'Categorias' }).first().click();
});
await page.waitForSelector('text=Categorias de relatórios', { timeout: 5000 });
await page.screenshot({ path: `${OUT}/categorias-relatorios-modal.png` });

await page.locator('[role=dialog] button', { hasText: 'Nova categoria' }).click();
await page.fill('[role=dialog] input[placeholder="ex: Obras Públicas"]', 'Produtividade');
await page.fill('[role=dialog] input[placeholder="#0ea5e9"]', '#65a30d');
await page.locator('[role=dialog] button', { hasText: 'Criar categoria' }).click();
await page.waitForTimeout(600);
let names = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] li p.truncate')].map((p) => p.textContent?.trim()));
check(names.includes('Produtividade'), `categoria de relatório criada: ${JSON.stringify(names)}`);

// excluir em uso → bloqueado (Financeiro tem relatório publicado)
await page.locator('[role=dialog] button[aria-label="Excluir Financeiro"]').click();
await page.locator('button', { hasText: 'Excluir' }).last().click();
await page.waitForTimeout(600);
names = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] li p.truncate')].map((p) => p.textContent?.trim()));
check(names.includes('Financeiro'), 'excluir categoria de relatório em uso é bloqueado (409)');

// excluir livre → some
await page.locator('[role=dialog] button[aria-label="Excluir Produtividade"]').click();
await page.locator('button', { hasText: 'Excluir' }).last().click();
await page.waitForTimeout(600);
names = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] li p.truncate')].map((p) => p.textContent?.trim()));
check(!names.includes('Produtividade'), `categoria livre excluída: ${JSON.stringify(names)}`);
await page.keyboard.press('Escape');

// ── 4. Form do relatório tem o campo Categoria ───────────────────────────────
await page.locator('button', { hasText: 'Novo relatório' }).click();
await page.waitForSelector('text=Novo relatório', { timeout: 5000 });
const hasCategoryField = await page.locator('[role=dialog] label', { hasText: 'Categoria' }).count();
check(hasCategoryField > 0, 'form do relatório tem campo "Categoria"');
await page.keyboard.press('Escape');

console.log(failures === 0 ? 'PASSOU (todos os casos)' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

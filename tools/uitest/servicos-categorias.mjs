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

// ── 1. Serviços: agrupamento, cores e filtro ─────────────────────────────────
await page.goto(BASE + '/servicos', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/servicos-desktop.png` });

const state = await page.evaluate(() => {
  const headers = [...document.querySelectorAll('main section h2, section h2')].map((h) => h.textContent?.trim());
  const pills = [...document.querySelectorAll('button[aria-pressed]')].map((b) => b.textContent?.trim());
  const cards = [...document.querySelectorAll('section .grid > div')].map((c) => c.textContent ?? '');
  const startBtns = [...document.querySelectorAll('section button')].filter((b) => b.textContent?.includes('Iniciar'));
  const colors = startBtns.map((b) => b.style.backgroundColor);
  return { headers, pills, cards, colors };
});
check(state.headers.includes('Pagamentos') && state.headers.includes('Sem categoria'), `agrupamentos: ${JSON.stringify(state.headers)}`);
check(state.pills.includes('Todas') && state.pills.includes('Pagamentos'), `pílulas de filtro: ${JSON.stringify(state.pills)}`);
// #7c3aed = rgb(124, 58, 237)
check(state.colors.some((c) => c === 'rgb(124, 58, 237)'), `botão Iniciar herda cor da categoria: ${JSON.stringify(state.colors)}`);
check(!state.cards.some((t) => t.includes('Pagamentos')), 'nome da categoria NÃO aparece dentro do card');

// filtro: clica em "Pagamentos" → só o grupo dela fica visível
await page.locator('button[aria-pressed]', { hasText: 'Pagamentos' }).click();
await page.waitForTimeout(300);
const filtered = await page.evaluate(() => [...document.querySelectorAll('section h2')].map((h) => h.textContent?.trim()));
check(filtered.length === 1 && filtered[0] === 'Pagamentos', `filtro ativo mostra só o grupo: ${JSON.stringify(filtered)}`);
await page.screenshot({ path: `${OUT}/servicos-filtrado.png` });
// clica de novo → volta pra "Todas"
await page.locator('button[aria-pressed]', { hasText: 'Pagamentos' }).click();
await page.waitForTimeout(300);

// mobile
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(400);
const mobOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
check(!mobOverflow, 'serviços mobile sem scroll horizontal');
await page.screenshot({ path: `${OUT}/servicos-mobile.png` });
await page.setViewportSize({ width: 1280, height: 900 });

// ── 2. Menu: Categorias sumiu do grupo Processos ─────────────────────────────
await page.goto(BASE + '/admin/processos', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const menuItems = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('aside li')];
  const proc = groups.find((li) => li.querySelector('button span')?.textContent?.trim() === 'Processos');
  return [...(proc?.querySelectorAll('ul a') ?? [])].map((a) => a.textContent?.trim());
});
check(!menuItems.includes('Categorias'), `menu Processos sem "Categorias": ${JSON.stringify(menuItems)}`);

// ── 3. Modal de categorias: criar, editar, excluir ───────────────────────────
await page.locator('button', { hasText: 'Categorias' }).first().click();
await page.waitForSelector('text=Categorias de processos', { timeout: 5000 });
await page.screenshot({ path: `${OUT}/categorias-modal.png` });
const listed = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] li p.truncate')].map((p) => p.textContent?.trim()));
check(listed.includes('Pagamentos') && listed.includes('Protocolo'), `modal lista categorias: ${JSON.stringify(listed)}`);

// criar
await page.locator('[role=dialog] button', { hasText: 'Nova categoria' }).click();
await page.fill('[role=dialog] input[placeholder="ex: Obras Públicas"]', 'Obras');
await page.fill('[role=dialog] input[placeholder="#0ea5e9"]', '#ea580c');
await page.locator('[role=dialog] button', { hasText: 'Criar categoria' }).click();
await page.waitForTimeout(600);
let names = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] li p.truncate')].map((p) => p.textContent?.trim()));
check(names.includes('Obras'), `categoria criada aparece: ${JSON.stringify(names)}`);

// editar
await page.locator('[role=dialog] button[aria-label="Editar Obras"]').click();
await page.fill('[role=dialog] input[placeholder="ex: Obras Públicas"]', 'Obras e Serviços');
await page.locator('[role=dialog] button', { hasText: 'Salvar alterações' }).click();
await page.waitForTimeout(600);
names = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] li p.truncate')].map((p) => p.textContent?.trim()));
check(names.includes('Obras e Serviços'), `categoria renomeada: ${JSON.stringify(names)}`);

// excluir em uso → bloqueado (Pagamentos tem processo publicado)
await page.locator('[role=dialog] button[aria-label="Excluir Pagamentos"]').click();
await page.locator('button', { hasText: 'Excluir' }).last().click();
await page.waitForTimeout(600);
names = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] li p.truncate')].map((p) => p.textContent?.trim()));
check(names.includes('Pagamentos'), 'excluir categoria em uso é bloqueado (409)');

// excluir livre → some
await page.locator('[role=dialog] button[aria-label="Excluir Obras e Serviços"]').click();
await page.locator('button', { hasText: 'Excluir' }).last().click();
await page.waitForTimeout(600);
names = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] li p.truncate')].map((p) => p.textContent?.trim()));
check(!names.includes('Obras e Serviços'), `categoria livre excluída: ${JSON.stringify(names)}`);

// mobile: modal usável
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(400);
const modalClipped = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[role=dialog] button, [role=dialog] input')];
  const vw = document.documentElement.clientWidth;
  return els.filter((el) => { const r = el.getBoundingClientRect(); return r.right > vw + 1 || r.left < -1; }).length;
});
check(modalClipped === 0, 'modal de categorias mobile sem controles cortados');
await page.screenshot({ path: `${OUT}/categorias-modal-mobile.png` });

console.log(failures === 0 ? 'PASSOU (todos os casos)' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

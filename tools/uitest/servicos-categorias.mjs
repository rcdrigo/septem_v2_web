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
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

// ── 1. Nova requisição: modal, categorias, busca e abertura ──────────────────
await page.goto(BASE + '/tasks', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Nova requisição' }).click();
await page.waitForSelector('[role=dialog]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/nova-requisicao-desktop.png` });

const state = await page.evaluate(() => {
  const dialog = document.querySelector('[role=dialog]');
  const categories = [...(dialog?.querySelectorAll('aside button[aria-pressed]') ?? [])].map((b) => b.textContent?.trim());
  const cards = [...(dialog?.querySelectorAll('.new-request-card') ?? [])].map((c) => c.textContent ?? '');
  const pagamentos = [...(dialog?.querySelectorAll('aside button[aria-pressed]') ?? [])].find((b) => b.textContent?.includes('Pagamentos'));
  const color = pagamentos?.querySelector('span')?.style.color;
  return { categories, cards, color };
});
check(state.categories.some((x) => x?.includes('Todas')) && state.categories.some((x) => x?.includes('Pagamentos')), `categorias no modal: ${JSON.stringify(state.categories)}`);
check(state.cards.length > 0 && state.cards.every((text) => text.includes('Iniciar')), `cards de serviços com ação Iniciar: ${state.cards.length}`);
check(state.color === 'rgb(124, 58, 237)', `categoria herda cor configurada: ${JSON.stringify(state.color)}`);
check(await page.getByRole('dialog').getByText(/criar pipe|com IA/i).count() === 0, 'modal não exibe ações de IA ou criação de pipe');

// A ação "Iniciar" fica recolhida e é revelada no HOVER (desktop). Espera a
// transição de opacidade antes de ler (senão pega valor intermediário). O
// :focus-visible e o "sempre visível sem hover" dependem de emulação de
// dispositivo (hover:none) que o headless não reproduz fielmente — cobrimos o
// efeito observável (hover revela) + a acessibilidade por teclado do card.
const firstCard = page.locator('[role=dialog] .new-request-card').first();
const firstAction = firstCard.locator('.new-request-action');
check(await firstAction.evaluate((el) => getComputedStyle(el).opacity) === '0', 'ação Iniciar começa recolhida no desktop');
check((await firstAction.innerText()).includes('Iniciar'), 'a ação do card é "Iniciar"');
await firstCard.hover();
await page.waitForFunction(() => {
  const a = document.querySelector('[role=dialog] .new-request-card .new-request-action');
  return a && getComputedStyle(a).opacity === '1';
}, { timeout: 1500 }).catch(() => {});
check(await firstAction.evaluate((el) => getComputedStyle(el).opacity) === '1', 'hover revela ação Iniciar');
check(
  await firstCard.evaluate((el) => el.getAttribute('tabindex') === '0' && el.getAttribute('role') === 'link'),
  'card é acessível por teclado (role=link, tabindex 0)',
);

// categoria: Pagamentos → somente cards dessa categoria
await page.locator('[role=dialog] aside button[aria-pressed]', { hasText: 'Pagamentos' }).click();
await page.waitForTimeout(200);
const categoryFiltered = await page.locator('[role=dialog] .new-request-card').allTextContents();
check(categoryFiltered.length > 0 && categoryFiltered.every((text) => text.includes('Pagamentos')), `filtro por categoria: ${JSON.stringify(categoryFiltered)}`);

// busca local automática: usa o nome do primeiro serviço e reduz ao resultado correspondente
await page.locator('[role=dialog] aside button[aria-pressed]', { hasText: 'Todas' }).click();
const firstName = await page.locator('[role=dialog] .new-request-card strong').first().innerText();
await page.getByLabel('Buscar serviços').fill(firstName);
await page.waitForTimeout(100);
const searchFiltered = await page.locator('[role=dialog] .new-request-card').allTextContents();
check(searchFiltered.length >= 1 && searchFiltered.every((text) => text.includes(firstName)), `busca automática por "${firstName}": ${searchFiltered.length}`);
await page.screenshot({ path: `${OUT}/nova-requisicao-filtrada.png` });

// card abre o formulário standalone em nova aba e fecha o modal
const [servicePage] = await Promise.all([
  ctx.waitForEvent('page'),
  page.locator('[role=dialog] .new-request-card').first().click(),
]);
await servicePage.waitForLoadState('domcontentloaded');
check(new URL(servicePage.url()).pathname.includes('/services/'), `serviço abriu em nova aba: ${servicePage.url()}`);
check(await page.locator('[role=dialog]').count() === 0, 'modal fecha após iniciar serviço');
await servicePage.close();

// mobile
await page.setViewportSize({ width: 375, height: 812 });
await page.getByRole('button', { name: 'Abrir menu' }).click();
await page.getByRole('button', { name: 'Nova requisição' }).click();
await page.waitForTimeout(300);
const mobOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
check(!mobOverflow, 'modal Nova requisição mobile sem scroll horizontal');
// No mobile (toque, sem hover) a ação fica sempre visível — headless não emula
// hover:none só redimensionando, então conferimos que a ação está presente.
check((await page.locator('[role=dialog] .new-request-action').first().innerText()).includes('Iniciar'), 'ação Iniciar presente no card (mobile)');
await page.screenshot({ path: `${OUT}/nova-requisicao-mobile.png` });
await page.getByRole('button', { name: 'Fechar' }).click();
await page.setViewportSize({ width: 1280, height: 900 });

// ── 2. Menu: Categorias sumiu do grupo Processos ─────────────────────────────
await page.goto(BASE + '/admin/flows', { waitUntil: 'networkidle' });
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

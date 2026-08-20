// Ajustes 26/07 — layout: botões do menu (min-h-8 + mb-5), card de requisições
// (sem categoria/pendências, sem títulos de rodapé, status+datas numa linha com
// ícones) e header do relatório do processo (sem "Categoria:"). Web 1280 + mobile 375.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (t, p) => {
  const r = await fetch(API + p, { headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${t}` } });
  return r.json().catch(() => null);
};
const { accessToken: token } = await (await fetch(API + '/api/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x' },
  body: JSON.stringify({ identifier: 'admin@prefeitura-x.local', password: 'admin123' }),
})).json();

// Precisa de uma instância para o card e para o relatório.
const inst = await api(token, '/api/v1/workflow/instances?mine=false&status=em_andamento&pageSize=1');
const instanceId = inst?.items?.[0]?.id;
check(!!instanceId, `[setup] existe requisição em andamento para testar (${instanceId ? 'ok' : 'nenhuma'})`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}

for (const view of [{ name: 'web', width: 1280, height: 900 }, { name: 'mobile', width: 375, height: 812 }]) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const mobile = view.name === 'mobile';
  await login(page);

  // ── Itens 8 e 9: botões do menu (Buscar / Nova requisição) ──
  if (mobile) await page.click('button[aria-label="Abrir menu"]');
  const btnBusca = page.getByRole('button', { name: /Buscar no Septem/ }).first();
  const btnNova = page.getByRole('button', { name: /Nova requisição/ }).first();
  await btnBusca.waitFor({ state: 'visible', timeout: 8000 });
  const mhBusca = await btnBusca.evaluate((el) => getComputedStyle(el).minHeight);
  const mhNova = await btnNova.evaluate((el) => getComputedStyle(el).minHeight);
  check(mhBusca === '32px', `[${view.name}] botão Buscar min-h-8 (32px) — obtido ${mhBusca}`);
  check(mhNova === '32px', `[${view.name}] botão Nova requisição min-h-8 (32px) — obtido ${mhNova}`);
  const mb = await btnBusca.evaluate((el) => getComputedStyle(el.parentElement).marginBottom);
  check(mb === '20px', `[${view.name}] div dos botões mb-5 (20px) — obtido ${mb}`);
  if (mobile) await page.keyboard.press('Escape'); // fecha o menu off-canvas

  // ── Itens 15-18: card de requisições ──
  await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
  // Garante a visão em cards (no web o default pode ser tabela).
  const cardsToggle = page.locator('button[title="Cards"]');
  if (await cardsToggle.count()) await cardsToggle.first().click();
  await page.waitForSelector('[data-testid=req-card]', { timeout: 12000 });
  const card = page.locator('[data-testid=req-card]').first();
  const cardText = await card.innerText();
  check(!/Pend[êe]ncias/i.test(cardText), `[${view.name}] card SEM "Pendências" (item 15)`);
  check(!/Sem categoria/i.test(cardText), `[${view.name}] card SEM linha de categoria (item 15)`);

  const footer = card.locator('[data-testid=req-card-footer]');
  check(await footer.count() === 1, `[${view.name}] card tem o rodapé consolidado`);
  const footerDisplay = await footer.evaluate((el) => getComputedStyle(el).display);
  check(footerDisplay === 'flex', `[${view.name}] rodapé é uma ÚNICA linha (flex, não grid) — item 17 (${footerDisplay})`);
  // Títulos removidos: nenhuma linha do rodapé é exatamente um rótulo.
  const footerText = await footer.innerText();
  const titulos = ['Status', 'Pendências', 'Pendencias', 'Início', 'Inicio', 'Fim'];
  const temTitulo = footerText.split('\n').map((l) => l.trim()).some((l) => titulos.includes(l));
  check(!temTitulo, `[${view.name}] rodapé sem títulos (item 16) — "${footerText.replace(/\n/g, ' | ')}"`);
  // Ícones das datas (item 18): dois SVGs de calendário no rodapé (início + conclusão).
  const svgCount = await footer.locator('svg').count();
  check(svgCount >= 2, `[${view.name}] rodapé tem ícones para as datas (item 18) — ${svgCount} svg`);

  // ── Item 10: sem gap nos "switchers" ──
  const statusGap = await page.locator('[aria-label="Status das requisições"]').evaluate((el) => getComputedStyle(el).columnGap);
  check(statusGap === '0px' || statusGap === 'normal', `[${view.name}] grupo de status sem gap (item 10) — ${statusGap}`);
  const togglePad = await page.locator('button[title="Cards"]').evaluate((el) => getComputedStyle(el.parentElement).padding);
  check(togglePad === '0px', `[${view.name}] toggle de visão sem padding/gap (item 10) — ${togglePad}`);

  // Layout objetivo: sem overflow horizontal.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!overflow, `[${view.name}] página de requisições sem overflow horizontal`);
  await page.screenshot({ path: `${OUT}/ajustes-card-${view.name}.png`, fullPage: false });

  // ── Item 11: header do relatório sem "Categoria:" ──
  if (instanceId) {
    await page.goto(BASE + `/requests/${instanceId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 12000 });
    const header = await page.locator('header').first().innerText();
    check(!/Categoria:/i.test(header), `[${view.name}] header do relatório SEM "Categoria:" (item 11) — "${header.replace(/\n/g, ' | ').slice(0, 80)}"`);
    await page.screenshot({ path: `${OUT}/ajustes-relatorio-${view.name}.png`, fullPage: false });
  }

  await ctx.close();
}

// ── Itens 15-16 (tabela alinhada ao card): sem categoria e sem coluna "Pendentes" ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
  const tabelaToggle = page.locator('button[title="Tabela"]');
  if (await tabelaToggle.count()) await tabelaToggle.first().click();
  await page.waitForSelector('table', { timeout: 12000 });
  const ths = await page.locator('table thead th').allInnerTexts();
  check(!ths.some((t) => /Pendentes/i.test(t)), `[web-tabela] sem coluna "Pendentes" (item 15) — [${ths.map((t) => t.trim()).filter(Boolean).join(', ')}]`);
  const bodyText = await page.locator('table tbody').innerText().catch(() => '');
  check(!/Sem categoria/i.test(bodyText), '[web-tabela] tabela sem "Sem categoria" no subtítulo (item 15)');
  await ctx.close();
}

// ── Item 10: navbar de abas do Guia sem gap ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(BASE + '/guide', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=guide-navbar]', { timeout: 12000 });
  const navGap = await page.locator('[data-testid=guide-navbar]').evaluate((el) => getComputedStyle(el).columnGap);
  check(navGap === '0px' || navGap === 'normal', `[web] navbar de abas do Guia sem gap (item 10) — ${navGap}`);
  await ctx.close();
}

await browser.close();
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

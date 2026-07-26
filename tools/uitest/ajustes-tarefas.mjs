// Ajustes 26/07 — tarefas:
//  (12) (des)personificar atualiza o summary de pendentes;
//  (13) focar a página de Tarefas atualiza summary + lista;
//  (14) o popover de prazos (DuePill) NÃO é recortado (portal + fixed).
// Web 1280 + mobile 375.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

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

  // Conta chamadas ao summary de pendentes (para provar os itens 12 e 13).
  let summaryHits = 0;
  page.on('response', (r) => { if (/\/workflow\/tasks\/summary/.test(r.url())) summaryHits++; });

  await login(page);
  await page.waitForTimeout(800); // deixa o badge inicial buscar

  // ── Item 13: focar a página de Tarefas atualiza o summary ──
  await page.goto(BASE + '/requisicoes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  summaryHits = 0; // zera antes de entrar em Tarefas
  await page.goto(BASE + '/tarefas', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check(summaryHits >= 1, `[${view.name}] entrar em Tarefas dispara refetch do summary (item 13) — ${summaryHits}`);

  const vis = await page.evaluate(() => document.visibilityState);
  summaryHits = 0;
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1000);
  check(vis !== 'visible' || summaryHits >= 1, `[${view.name}] focar a aba dispara refetch do summary (item 13) — visibility=${vis}, hits=${summaryHits}`);

  // ── Item 14: popover de prazos não é recortado ──
  // Visão em cards (padrão), primeiro pill VISÍVEL — perto do topo, onde o balão
  // subia e era cortado pelo header/overflow.
  const cardsToggle = page.locator('button[title="Cards"]');
  if (await cardsToggle.count()) await cardsToggle.first().click();
  await page.waitForTimeout(600);
  const pill = page.locator('button[aria-describedby^="deadline-"]:visible').first();
  await pill.waitFor({ state: 'visible', timeout: 12000 });
  await pill.scrollIntoViewIfNeeded();
  await pill.hover();
  // openNow no focus é instantâneo; força o foco para não esperar o delay de hover.
  await pill.focus();
  const pop = page.locator('[data-testid=due-popover]');
  await pop.waitFor({ state: 'visible', timeout: 4000 });
  const info = await pop.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      childOfBody: el.parentElement === document.body,
      top: Math.round(r.top), left: Math.round(r.left), bottom: Math.round(r.bottom), right: Math.round(r.right),
      vw: window.innerWidth, vh: window.innerHeight,
      hasMarcos: el.textContent.includes('Recebimento') && el.textContent.includes('Prazo da tarefa'),
    };
  });
  check(info.childOfBody, `[${view.name}] popover de prazos é renderizado em PORTAL no body (item 14)`);
  check(info.top >= 0 && info.left >= -1, `[${view.name}] popover não é cortado no topo/esquerda (top=${info.top}, left=${info.left})`);
  check(info.bottom <= info.vh + 1 && info.right <= info.vw + 1, `[${view.name}] popover cabe no viewport (bottom=${info.bottom}/${info.vh}, right=${info.right}/${info.vw})`);
  check(info.hasMarcos, `[${view.name}] popover mostra os marcos (Recebimento/Prazo da tarefa)`);
  await page.screenshot({ path: `${OUT}/ajustes-popover-${view.name}.png`, fullPage: false });

  await ctx.close();
}

// ── Item 12: (des)personificar atualiza o summary (só web; fluxo de personificação é desktop) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  let impSummaryHits = 0;
  let impersonatePost = false;
  page.on('response', (r) => {
    if (/\/workflow\/tasks\/summary/.test(r.url())) impSummaryHits++;
    if (/\/impersonate\//.test(r.url()) && r.request().method() === 'POST') impersonatePost = true;
  });
  await login(page);
  await page.waitForTimeout(1000);

  // Abre o diálogo de personificação e escolhe um usuário.
  await page.locator('aside button', { hasText: 'Personificar' }).first().click();
  await page.waitForSelector('[role=dialog]', { timeout: 8000 });
  await page.waitForTimeout(800);
  impSummaryHits = 0; // zera antes de confirmar a personificação
  // Escolhe o primeiro usuário selecionável da lista (evita o próprio admin).
  const alvo = page.locator('[role=dialog] button').filter({ hasText: /@|Externo|Cidad|Servidor|Maxim/ }).first();
  if (await alvo.count()) await alvo.click();
  else await page.locator('[role=dialog] button').nth(1).click();
  await page.waitForTimeout(2500);
  check(impersonatePost, '[web] personificação chamou o endpoint /impersonate');
  check(impSummaryHits >= 1, `[web] personificar dispara refetch do summary de pendentes (item 12) — ${impSummaryHits}`);

  // Despersonificar pelo banner.
  impSummaryHits = 0;
  const sair = page.locator('aside .bg-amber-50 button', { hasText: 'Sair' });
  if (await sair.count()) {
    await sair.first().click();
    await page.waitForTimeout(2500);
    check(impSummaryHits >= 1, `[web] despersonificar dispara refetch do summary (item 12) — ${impSummaryHits}`);
  } else {
    check(false, '[web] banner de personificação com botão Sair não encontrado');
  }
  await ctx.close();
}

await browser.close();
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

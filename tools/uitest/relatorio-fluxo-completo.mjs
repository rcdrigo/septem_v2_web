import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const NAME = `Indicadores de RH ${Date.now().toString(36)}`;
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

// ── Fluxo real: criar relatório pela UI escolhendo a categoria ───────────────
await page.goto(BASE + '/admin/relatorios', { waitUntil: 'networkidle' });
await page.locator('button', { hasText: 'Novo relatório' }).click();
await page.waitForSelector('[role=dialog] form#report-form', { timeout: 5000 });
await page.fill('[role=dialog] form input:first-of-type', NAME);
// Combobox de categoria: abre, pesquisa, seleciona "Financeiro"
await page.locator('[role=dialog] label', { hasText: 'Categoria' }).locator('button').first().click();
await page.fill('input[placeholder="Pesquisar…"]', 'finan');
await page.waitForTimeout(250);
await page.locator('li button', { hasText: 'Financeiro' }).first().click();
// fonte de dados (publicar exige origem com schema)
await page.locator('[role=dialog] label', { hasText: 'Fonte de dados' }).locator('button').first().click();
await page.fill('input[placeholder="Pesquisar…"]', 'Despesas');
await page.waitForTimeout(250);
await page.locator('li button', { hasText: 'Despesas fixas' }).first().click();
await page.screenshot({ path: `${OUT}/relatorio-form-categoria.png` });
await page.locator('[role=dialog] button', { hasText: 'Criar' }).click();
await page.waitForTimeout(700);
const row = page.locator('tr', { hasText: NAME });
check((await row.count()) === 1, 'relatório criado pela UI aparece na lista');

// publica pela UI (botão Publicar da linha)
await row.locator('button[title="Publicar"]').click();
await page.waitForTimeout(700);
check((await page.locator('tr', { hasText: NAME }).locator('text=Publicado').count()) === 1, 'publicado pela UI');

// reabre o relatório e confere que a categoria ficou salva (hidrata o combobox)
await page.locator('tr', { hasText: NAME }).locator('button[title="Editar dados básicos"]').click();
await page.waitForTimeout(600);
const comboText = await page.locator('[role=dialog] label', { hasText: 'Categoria' }).locator('button span').first().textContent();
check(comboText?.trim() === 'Financeiro', `categoria persistida no relatório: "${comboText?.trim()}"`);
await page.keyboard.press('Escape');

// ── Consultas: o novo relatório entra no grupo Financeiro com a cor ──────────
await page.goto(BASE + '/consultas', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const fin = await page.evaluate(() => {
  const secs = [...document.querySelectorAll('section')];
  const s = secs.find((x) => x.querySelector('h2')?.textContent?.trim() === 'Financeiro');
  const cards = [...(s?.querySelectorAll('.grid > article') ?? [])].map((c) => c.querySelector('p')?.textContent?.trim());
  const btn = [...(s?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes('Abrir') && b.closest('article')?.textContent?.includes('Indicadores de RH'));
  return { cards, btnColor: btn?.style.backgroundColor ?? null };
});
check(fin.cards.some((c) => c?.startsWith('Indicadores de RH')), `card no grupo Financeiro: ${JSON.stringify(fin.cards)}`);
check(fin.btnColor === 'rgb(14, 116, 144)', `botão Abrir com a cor da categoria: ${fin.btnColor}`);
await page.screenshot({ path: `${OUT}/consultas-fluxo-completo.png` });

// limpeza: inativa o relatório criado (volta ao estado anterior)
await page.goto(BASE + '/admin/relatorios', { waitUntil: 'networkidle' });
await page.locator('tr', { hasText: NAME }).locator('button[title="Inativar"]').click();
await page.locator('button', { hasText: 'Inativar' }).last().click();
await page.waitForTimeout(600);

console.log(failures === 0 ? 'PASSOU (fluxo completo real)' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

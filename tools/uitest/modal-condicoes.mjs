import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const SUFFIX = process.env.SUFFIX || '';

async function openModal(page) {
  // Login
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  if (await page.locator('input[type=email]').count()) {
    await page.fill('input[type=email]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
  }
  // Modelador com o processo de teste
  await page.goto(BASE + '/processos/editar?key=teste_condicoes_ui', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-element-id="G1"]', { timeout: 20000 });
  await page.click('[data-element-id="G1"]');
  const btn = page.locator('li', { hasText: '006.' }).locator('button', { hasText: 'Configurar' }).first();
  await btn.waitFor({ timeout: 10000 });
  await btn.click();
  await page.waitForSelector('text=Quando este caminho é seguido', { timeout: 10000 });
  await page.waitForTimeout(400);
}

async function diagnose(page, label) {
  const info = await page.evaluate(() => {
    const dialog = document.querySelector('[role=dialog] > div');
    const rows = [...document.querySelectorAll('[role=dialog] [class*="grid-cols"]')];
    const clipped = [...document.querySelectorAll('[role=dialog] select, [role=dialog] input, [role=dialog] button')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        return { tag: el.tagName, aria: el.getAttribute('aria-label') || el.getAttribute('placeholder') || '', left: Math.round(r.left), right: Math.round(r.right), vw, out: r.right > vw + 1 || r.left < -1 };
      })
      .filter((c) => c.out);
    const selects = [...document.querySelectorAll('[role=dialog] select')].map((s) => ({
      aria: s.getAttribute('aria-label') || '',
      value: s.value,
      shown: s.selectedOptions[0]?.label ?? '',
      w: Math.round(s.getBoundingClientRect().width),
    }));
    return {
      dialogW: dialog ? Math.round(dialog.getBoundingClientRect().width) : null,
      pageHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      rows: rows.map((r) => ({ clientW: r.clientWidth, scrollW: r.scrollWidth, overflows: r.scrollWidth > r.clientWidth + 1, children: r.children.length })),
      clipped,
      selects,
    };
  });
  console.log(`[${label}]`, JSON.stringify(info, null, 1));
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));

try {
  await openModal(page);
  await page.screenshot({ path: `${OUT}/modal-desktop${SUFFIX}.png` });
  await diagnose(page, 'desktop-1280');

  // Combobox de campo: abre o da 1ª regra, pesquisa e seleciona
  const combo = page.locator('[role=dialog] button', { hasText: 'Selecione o campo' }).first();
  if (await combo.count()) {
    await combo.click();
    await page.fill('input[placeholder="Pesquisar…"]', 'saldo');
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/modal-combobox${SUFFIX}.png` });
    const opts = await page.$$eval('body > div:last-child li button', (els) => els.map((e) => e.textContent?.trim()));
    console.log('[combobox] opções filtradas por "saldo":', JSON.stringify(opts));
    const placeholdersBefore = await page.locator('[role=dialog] button', { hasText: 'Selecione o campo' }).count();
    await page.locator('li button', { hasText: 'Saldo de empenho' }).first().click();
    await page.waitForTimeout(250);
    const placeholdersAfter = await page.locator('[role=dialog] button', { hasText: 'Selecione o campo' }).count();
    const selectedShown = await page.locator('[role=dialog] button', { hasText: 'Saldo de empenho' }).count();
    console.log(`[combobox] placeholders antes=${placeholdersBefore} depois=${placeholdersAfter}; botão mostrando "Saldo de empenho": ${selectedShown}`);
    await page.screenshot({ path: `${OUT}/modal-selecionado${SUFFIX}.png` });
  } else {
    console.log('[combobox] NÃO ENCONTRADO — campos do formulário não carregaram?');
  }

  // Mobile: mantém o modal aberto e estreita a viewport (equivale a abrir em tela pequena)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/modal-mobile${SUFFIX}.png`, fullPage: false });
  await diagnose(page, 'mobile-375');
} catch (e) {
  console.log('FALHOU:', e.message);
  await page.screenshot({ path: `${OUT}/modal-error${SUFFIX}.png`, fullPage: true }).catch(() => {});
}
await ctx.close();
await browser.close();

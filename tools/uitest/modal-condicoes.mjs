import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const SUFFIX = process.env.SUFFIX || '';

async function openModal(page) {
  // Login
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  if (await page.locator('input[name=identifier]').count()) {
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
  }
  // Modelador com o processo de teste
  await page.goto(BASE + '/flows/edit?key=teste_condicoes_ui', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-element-id="G1"]', { timeout: 20000 });
  await page.click('[data-element-id="G1"]');
  const btn = page.locator('li', { hasText: '006.' }).locator('button', { hasText: 'Configurar' }).first();
  await btn.waitFor({ timeout: 10000 });
  await btn.click();
  await page.waitForSelector('text=Quando este caminho é seguido', { timeout: 10000 });
  await page.waitForTimeout(400);
}

let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

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
  const overflow = info.rows.some((r) => r.overflows);
  check(!overflow, `[${label}] nenhuma linha com overflow`);
  check(info.clipped.length === 0, `[${label}] nenhum controle cortado (clipped: ${info.clipped.length})`);
  return info;
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));

try {
  await openModal(page);
  await page.screenshot({ path: `${OUT}/modal-desktop${SUFFIX}.png` });
  const dInfo = await diagnose(page, 'desktop-1280');

  // Fase 5e — os selects de parênteses "(" e ")" precisam ser largos o bastante para
  // não cortar o caractere atrás da seta do <select> (antes: 3.25rem + px-2 vs pr-8 →
  // cortava). Agora as colunas são 4rem. Mede a largura real e o conteúdo mostrado.
  const abre = dInfo.selects.find((s) => s.aria === 'Abrir grupo');
  const fecha = dInfo.selects.find((s) => s.aria === 'Fechar grupo');
  console.log('[5e] parênteses:', JSON.stringify({ abre, fecha }));
  check(!!abre && abre.w >= 56, `[desktop-1280] select "abrir grupo" largo o bastante (${abre?.w}px ≥ 56)`);
  check(!!fecha && fecha.w >= 56, `[desktop-1280] select "fechar grupo" largo o bastante (${fecha?.w}px ≥ 56)`);
  // Seleciona "(" e confirma que o caractere aparece de fato (não fica escondido).
  await page.locator('[role=dialog] select[aria-label="Abrir grupo"]').first().selectOption('(');
  await page.waitForTimeout(150);
  const abreShown = await page.locator('[role=dialog] select[aria-label="Abrir grupo"]').first().evaluate((s) => s.selectedOptions[0]?.label ?? '');
  check(abreShown === '(', `[desktop-1280] o parêntese "(" é exibido no select (mostrado="${abreShown}")`);

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
console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
process.exit(failures === 0 ? 0 : 1);

import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

await page.goto('http://localhost:5173/processos/editar?key=teste_condicoes_ui', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
await page.waitForTimeout(800);
await page.click('[data-element-id="T005"]');
await page.waitForSelector('text=Botões de ação', { timeout: 10000 });
await page.waitForTimeout(400);

// sem editor inline: nenhuma toolbar de rich-text visível no painel
const inlineToolbars = await page.evaluate(() => document.querySelectorAll('aside [contenteditable], [class*="rich"] [contenteditable]').length);
check(inlineToolbars === 0, `painel sem editor rich-text inline (${inlineToolbars})`);

// Ícone e Orientações lado a lado; botão abre o modal
const side = await page.evaluate(() => {
  const t = document.body.innerText.toUpperCase();
  return t.includes('ÍCONE') && t.includes('ORIENTAÇÕES');
});
check(side, 'Ícone e Orientações presentes no painel');
await page.screenshot({ path: `${OUT}/botao-orientacoes-painel.png` });

await page.locator('button', { hasText: /Definir…|Editar…/ }).first().click();
await page.waitForSelector('[role=dialog]', { timeout: 5000 });
check(await page.evaluate(() => document.querySelector('[role=dialog]')?.textContent?.includes('Orientações do botão')), 'modal de orientações abre');
await page.locator('[role=dialog] [contenteditable]').click();
await page.keyboard.type('Confira o empenho antes de enviar.');
await page.screenshot({ path: `${OUT}/botao-orientacoes-modal.png` });
await page.locator('[role=dialog] button', { hasText: 'Concluído' }).click();
await page.waitForTimeout(400);

// indicador vira "Editar…" (orientação persistida no XML do botão)
check((await page.locator('button', { hasText: 'Editar…' }).count()) > 0, 'após salvar, botão mostra "Editar…" (persistido)');

// reabre o modal e confere o conteúdo
await page.locator('button', { hasText: 'Editar…' }).first().click();
await page.waitForTimeout(400);
check(await page.evaluate(() => document.querySelector('[role=dialog] [contenteditable]')?.textContent?.includes('Confira o empenho')), 'conteúdo persiste ao reabrir o modal');
await page.locator('[role=dialog] button', { hasText: 'Concluído' }).click();

// mobile: painel sem controles cortados
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(500);
const clipped = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const scrollable = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth) return true;
    }
    return false;
  };
  return [...document.querySelectorAll('button, input')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + 1 || r.left < -1) && !scrollable(el);
  }).length;
});
check(clipped === 0, `mobile sem controles cortados (${clipped})`);

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

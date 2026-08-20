import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 200)); });
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

// abre o modelador e vai DIRETO para Tarefas × Campos (sem abrir Formulário)
await page.goto('http://localhost:5173/flows/edit?key=teste_condicoes_ui', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
await page.waitForTimeout(600);
await page.locator('header button', { hasText: 'Campos' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/tarefas-campos.png`, fullPage: true });

const state = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    hasFields: ['Nome do requisitante', 'CPF', 'Saldo de empenho'].every((f) => text.includes(f)),
    hasTasks: text.includes('005.') && text.includes('006.'),
    empty: text.includes('Configure o formulário do processo primeiro') || text.includes('Nenhum campo'),
    pageHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    // colunas de tarefa cortadas fora de contêiner rolável?
    clippedHeads: [...document.querySelectorAll('th, [class*="col"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      if (!(r.width > 0 && r.right > vw + 1)) return false;
      for (let n = el.parentElement; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth) return false;
      }
      return true;
    }).length,
  };
});
check(state.hasFields, 'campos do formulário aparecem sem abrir a aba Formulário');
check(state.hasTasks, 'colunas das tarefas 005/006 presentes');
check(!state.empty, 'sem empty-state indevido');
check(!state.pageHScroll || state.clippedHeads === 0, `conteúdo largo rola em contêiner próprio (cortados fora de scroll: ${state.clippedHeads})`);

// mobile
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(600);
const mob = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
check(!mob, 'mobile sem scroll horizontal da página');
await page.screenshot({ path: `${OUT}/tarefas-campos-mobile.png`, fullPage: true });

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

await page.goto('http://localhost:5173/servico/teste_condicoes_ui', { waitUntil: 'networkidle' });
await page.waitForSelector('h1', { timeout: 15000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/servico-header.png` });

const h = await page.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent?.trim(),
  processLine: [...document.querySelectorAll('header span')].map((s) => s.textContent?.trim()),
}));
check(h.h1 === 'Preencher solicitação de pagamento', `h1 = nome da tarefa de início ("${h.h1}")`);
check(h.processLine.includes('Teste Condicoes UI'), `linha do processo presente (${JSON.stringify(h.processLine)})`);

// mobile
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(500);
const mobOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
check(!mobOverflow, 'tela de início mobile sem scroll horizontal');
await page.screenshot({ path: `${OUT}/servico-header-mobile.png` });

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

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

await page.goto('http://localhost:5173/servico/inicio_com_fonte', { waitUntil: 'networkidle' });
await page.waitForSelector('h1', { timeout: 15000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/fonte-campo-inicio.png` });

const state = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input, textarea')].map((i) => ({ value: i.value }));
  return {
    filled: inputs.some((i) => i.value === 'Administrador'),
    dash: document.body.innerText.includes('Requisitante') && document.body.innerText.split('Requisitante')[1]?.trim().startsWith('—'),
  };
});
check(state.filled, 'campo Requisitante veio preenchido com "Administrador" (fonte + placeholder resolvidos)');
check(!state.dash, 'sem o "—" de valor vazio');
console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

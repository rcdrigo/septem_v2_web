import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
// pior caso: browser limpo, sem localStorage de forms anteriores
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

await page.goto('http://localhost:5173/flows/edit?key=teste_condicoes_ui', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
await page.waitForTimeout(1000);
// vai direto para a aba Formulário
await page.getByRole('button', { name: 'Formulário', exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/formulario-tab.png`, fullPage: false });

const state = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    emptyBuilder: text.includes('Build your form'),
    hasFields: ['Nome do requisitante', 'Saldo de empenho'].every((f) => text.includes(f)),
    removedButtons: text.includes('Limpar formulário') || text.includes('Modelo com agrupamento'),
    keptButtons: text.includes('Pré-visualizar') && text.includes('Máscaras') && text.includes('Empilhados'),
  };
});
check(!state.emptyBuilder, 'builder NÃO está no empty-state "Build your form"');
check(state.hasFields, 'campos do formulário renderizados no canvas do builder');
check(!state.removedButtons, 'botões "Limpar formulário" e "Modelo com agrupamento" removidos');
check(state.keptButtons, 'Pré-visualizar, Máscaras e Empilhados/Abas mantidos');
console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

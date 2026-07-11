import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
// contexto NOVO (sem localStorage) = pior caso: nada salvo da aba Formulário
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

// abre o modelador direto no fluxo e clica na TAREFA (sem nunca abrir a aba Formulário)
await page.goto('http://localhost:5173/processos/editar?key=teste_condicoes_ui', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
await page.waitForTimeout(800);
await page.click('[data-element-id="T005"]');
await page.waitForSelector('text=Configuração do formulário', { timeout: 10000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/task-form-fields.png` });

const state = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    emptyState: text.includes('Configure o formulário do processo primeiro'),
    hasFields: ['Nome do requisitante', 'Saldo de empenho', 'CPF'].every((f) => text.includes(f)),
  };
});
check(!state.emptyState, 'seção NÃO mostra o empty-state "configure o formulário primeiro"');
check(state.hasFields, 'campos do formulário aparecem na primeira abertura, sem tocar na aba Formulário');

// mobile spot-check: painel da tarefa
console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

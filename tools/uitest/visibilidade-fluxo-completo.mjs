import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

// ── 1. Modelador: matriz — T005: grupo Solicitante OCULTO, grupo Pagamento VISÍVEL ──
await page.goto('http://localhost:5173/processos/editar?key=teste_condicoes_ui', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
await page.waitForTimeout(800);
await page.locator('header button', { hasText: 'Campos' }).click();
await page.waitForTimeout(1000);

// coluna da T005 = índice da coluna cujo cabeçalho contém "005."
const colIndex = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('thead th')];
  return ths.findIndex((th) => th.textContent?.includes('005.')) - 1; // -1: primeira col é "Campo"
});
check(colIndex >= 0, `coluna da tarefa 005 localizada (índice ${colIndex})`);

// linha do grupo SOLICITANTE → botão OCULTO (1º); linha PAGAMENTO → VISÍVEL (2º)
const solRow = page.locator('tbody tr', { hasText: 'SOLICITANTE' }).first();
await solRow.locator('td').nth(colIndex).locator('button').nth(0).click();
const pagRow = page.locator('tbody tr', { hasText: 'PAGAMENTO' }).first();
await pagRow.locator('td').nth(colIndex).locator('button').nth(1).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/vis-matriz.png`, fullPage: true });

// ── 2. Salvar e Publicar pela UI ─────────────────────────────────────────────
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Publicar', exact: true }).click();
await page.waitForTimeout(2000);
check(await page.evaluate(() => document.body.innerText.includes('publicad') || document.body.innerText.includes('Publicad')), 'fluxo publicado pela UI');

// ── 3. Iniciar instância pela UI (tela de início) ────────────────────────────
await page.goto('http://localhost:5173/servico/teste_condicoes_ui', { waitUntil: 'networkidle' });
await page.waitForSelector('h1', { timeout: 15000 });
await page.waitForTimeout(1200);
await page.locator('footer button').first().click(); // "Enviar requisição"
await page.waitForTimeout(2000);
check(await page.evaluate(() => document.body.innerText.includes('sucesso')), 'instância iniciada pela UI');

// ── 4. A tela de conclusão auto-navega para a tarefa seguinte (T005) ────────
await page.waitForURL(/\/tarefa\//, { timeout: 15000 });
await page.waitForSelector('text=005.', { timeout: 15000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/vis-tarefa.png`, fullPage: true });
const taskPage = page;

const state = await taskPage.evaluate(() => {
  const text = document.body.innerText;
  const enabledInputs = [...document.querySelectorAll('main input, main textarea')]
    .filter((i) => !i.disabled && i.type !== 'hidden').length;
  return {
    solicitanteSumiu: !text.includes('Solicitante') && !text.includes('Nome do requisitante') && !text.includes('CPF'),
    pagamentoPresente: text.includes('Pagamento') && text.includes('Valor da solicitação') && text.includes('Saldo de empenho'),
    enabledInputs,
  };
});
check(state.solicitanteSumiu, 'grupo "Solicitante" (todo oculto) SUMIU — inclusive campos e aba');
check(state.pagamentoPresente, 'grupo "Pagamento" presente com os campos');
check(state.enabledInputs === 0, `campos "visível" estão SOMENTE LEITURA (inputs editáveis: ${state.enabledInputs})`);

console.log(failures === 0 ? 'PASSOU (fluxo completo na UI)' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

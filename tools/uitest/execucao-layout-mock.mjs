// Teste visual isolado dos componentes de execução. Intercepta a API para não
// depender do backend e cobre os breakpoints 320/375/414/768 + desktop.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (condition, message) => (condition ? ok.push(message) : bad.push(message));

const tenant = {
  tenantId: 'mock', clienteNome: 'Ambiente que não deve aparecer', ambienteNome: 'Teste',
  primaryColor: '#0f172a', modulos: [],
};
const schema = {
  components: [
    { type: 'datetime', key: 'prazo', label: 'Prazo', properties: { septemDateMode: 'date', septemDateLimit: 'noPast' } },
    { type: 'datetime', key: 'horario', label: 'Horário', properties: { septemDateMode: 'time' } },
    { type: 'datetime', key: 'agenda', label: 'Agendamento', properties: { septemDateMode: 'datetime', septemDateLimit: 'noFuture' } },
  ],
};

async function mockedContext(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => localStorage.setItem('septem.accessToken', 'mock-token'));
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    let body = {};
    if (url.pathname === '/api/tenant/config') body = tenant;
    else if (url.pathname.endsWith('/process-definitions/mock-process/form')) body = {
      formSchema: schema, buttons: [{ id: 'start', label: 'Iniciar solicitação', validateForm: true }],
      data: {}, processName: 'Processo de Compras', startTaskName: 'Preencher solicitação',
      startTaskAlias: 'INIC', startTaskSector: 'Protocolo',
    };
    else if (url.pathname.endsWith('/process-definitions/mock-process')) body = {
      id: 1, publicId: 'flow', key: 'mock-process', name: 'Processo de Compras', version: 1,
      versions: [1], status: 'published', bpmnXml: '', createdAt: '', updatedAt: '', category: null, area: null,
    };
    else if (url.pathname.endsWith('/workflow/tasks/mock-task')) body = {
      id: 'mock-task', name: 'Analisar solicitação', status: 'pendente', executionId: 'execution-1',
      process: 'Processo de Compras', processNumber: 321, alias: 'ANAL', sector: 'Financeiro',
      formSchema: schema, data: {}, fieldOptions: {}, buttons: [
        { id: 'approve', label: 'Aprovar', validateForm: true, primaryColor: '#166534', textColor: '#ffffff' },
        { id: 'return', label: 'Devolver', validateForm: false },
      ],
    };
    else if (route.request().method() === 'POST') body = { taskStatus: 'pendente' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return context;
}

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });
try {
  for (const width of [320, 375, 414, 768]) {
    const context = await mockedContext(browser, { width, height: 812 });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log(`[pageerror start ${width}] ${error.message}`));
    page.on('requestfailed', (request) => console.log(`[requestfailed start ${width}] ${request.url()} ${request.failure()?.errorText}`));
    await page.goto(`${BASE}/servico/mock-process`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 5000 });

    check((await page.locator('h1').innerText()).trim() === 'INIC · Preencher solicitação', `[start ${width}] sigla prefixa a tarefa`);
    check(await page.getByText('Processo de Compras', { exact: true }).count() === 1, `[start ${width}] processo aparece uma vez como pill`);
    check(await page.getByText('Setor: Protocolo', { exact: true }).count() === 1, `[start ${width}] setor secundário presente`);
    check(await page.getByText('Ambiente que não deve aparecer', { exact: true }).count() === 0, `[start ${width}] ambiente removido`);
    check(!await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `[start ${width}] sem overflow horizontal`);

    const date = page.locator('.septem-date-picker-input').first();
    await date.focus();
    check(await page.locator('.flatpickr-calendar.open').count() === 1, `[start ${width}] datepicker moderno abre por foco`);
    await page.keyboard.press('Escape');

    if (width === 375) {
      const pickers = page.locator('.septem-date-picker-input');
      check(await pickers.count() === 3, '[start 375] renderiza os modos data, hora e data/hora');
      check(await page.locator('.septem-date-picker > input:visible').count() === 3, '[start 375] oculta os inputs ISO técnicos');
      await pickers.nth(0).fill('20/07/2026');
      await pickers.nth(0).blur();
      await pickers.nth(1).fill('14:35');
      await pickers.nth(1).blur();
      await pickers.nth(2).fill('17/07/2026 10:30');
      await pickers.nth(2).blur();
      const isoValues = await page.locator('.septem-date-picker > input:not(.septem-date-picker-input)').evaluateAll((inputs) => inputs.map((input) => input.value));
      check(isoValues[0] === '2026-07-20', `[start 375] data mantém ISO (${isoValues[0]})`);
      check(isoValues[1] === '14:35', `[start 375] hora mantém ISO (${isoValues[1]})`);
      check(isoValues[2] === '2026-07-17T10:30', `[start 375] data/hora mantém ISO (${isoValues[2]})`);
    }

    if (width < 640) {
      check(await page.getByRole('button', { name: 'Iniciar solicitação' }).count() === 0, `[start ${width}] conclusão direta oculta`);
      await page.getByRole('button', { name: 'Botões de conclusão' }).click();
      const action = page.getByRole('button', { name: 'Iniciar solicitação' });
      check(await action.count() === 1, `[start ${width}] lista mostra conclusão`);
      const box = await action.boundingBox();
      check(!!box && box.width >= width - 40, `[start ${width}] ação ocupa largura total`);
      check(await page.getByRole('button', { name: 'Salvar', exact: true }).count() === 0, `[start ${width}] início sem Salvar`);
      if (width === 375) await page.screenshot({ path: `${OUT}/execucao-inicio-sheet-mobile.png`, fullPage: true });
      await page.getByRole('button', { name: 'Voltar ao formulário' }).click();
    }
    if (width === 375) await page.screenshot({ path: `${OUT}/execucao-inicio-mobile.png`, fullPage: true });
    await context.close();
  }

  for (const view of [{ name: 'desktop', width: 1280 }, { name: 'mobile', width: 375 }]) {
    const context = await mockedContext(browser, { width: view.width, height: 812 });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log(`[pageerror task ${view.name}] ${error.message}`));
    page.on('requestfailed', (request) => console.log(`[requestfailed task ${view.name}] ${request.url()} ${request.failure()?.errorText}`));
    await page.goto(`${BASE}/tarefa/mock-task`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 5000 });

    check((await page.locator('h1').innerText()).trim() === 'ANAL · Analisar solicitação', `[task ${view.name}] sigla prefixa a tarefa`);
    check(await page.getByText('Setor: Financeiro', { exact: true }).count() === 1, `[task ${view.name}] setor presente`);
    check(await page.getByRole('button', { name: 'Ver relatório do processo 321' }).count() === 1, `[task ${view.name}] número clicável presente`);

    if (view.name === 'desktop') {
      check(await page.getByRole('button', { name: 'Aprovar', exact: true }).count() === 1, '[task desktop] conclusões permanecem visíveis');
      check(await page.getByRole('button', { name: 'Salvar', exact: true }).count() === 1, '[task desktop] Salvar permanece visível');
    } else {
      check(await page.getByRole('button', { name: 'Aprovar', exact: true }).count() === 0, '[task mobile] conclusões diretas ocultas');
      await page.getByRole('button', { name: 'Botões de conclusão' }).click();
      check(await page.getByRole('button', { name: 'Aprovar', exact: true }).count() === 1, '[task mobile] sheet mostra Aprovar');
      check(await page.getByRole('button', { name: 'Devolver', exact: true }).count() === 1, '[task mobile] sheet mostra Devolver');
      check(await page.getByRole('button', { name: 'Salvar', exact: true }).count() === 1, '[task mobile] sheet mostra Salvar');
      check(await page.getByRole('button', { name: 'Cancelar', exact: true }).count() === 1, '[task mobile] sheet mostra Cancelar');
      await page.screenshot({ path: `${OUT}/execucao-tarefa-sheet-mobile.png`, fullPage: true });
      await page.getByRole('button', { name: 'Voltar ao formulário' }).click();
      await page.screenshot({ path: `${OUT}/execucao-tarefa-mobile.png`, fullPage: true });
    }
    check(!await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `[task ${view.name}] sem overflow horizontal`);
    await context.close();
  }
} finally {
  await browser.close();
}

ok.forEach((message) => console.log(`✓ ${message}`));
bad.forEach((message) => console.log(`✗ ${message}`));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Teste visual isolado dos componentes de execução. Intercepta a API para não
// depender do backend e cobre os breakpoints 320/375/414/768 + desktop.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (condition, message) => (condition ? ok.push(message) : bad.push(message));

function relativeDate(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return { digits: `${day}${month}${year}`, display: `${day}/${month}/${year}`, iso: `${year}-${month}-${day}` };
}

const tenant = {
  tenantId: 'mock', clienteNome: 'Ambiente que não deve aparecer', ambienteNome: 'Teste',
  primaryColor: '#0f172a', modulos: [],
};
const schema = {
  septemGroupLayout: 'tabs',
  components: [{
    type: 'group', key: 'dados_com_chave_legada', label: 'Dados', components: [
      { type: 'datetime', subtype: 'datetime', key: 'prazo', label: 'Prazo', properties: { septemDateMode: 'date', septemDateLimit: 'noPast', septemWidth: '150' } },
      { type: 'datetime', subtype: 'time', key: 'horario', label: 'Horário', properties: {} },
      { type: 'datetime', subtype: 'datetime', key: 'agenda', label: 'Agendamento', properties: { septemDateLimit: 'noFuture' } },
    ],
  }],
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
    await page.goto(`${BASE}/services/mock-process`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 5000 });

    check((await page.locator('h1').innerText()).trim() === 'INIC · Preencher solicitação · Protocolo', `[start ${width}] sigla e setor compõem o título`);
    check(await page.getByRole('tab', { name: /^Dados/ }).count() === 1, `[start ${width}] agrupamento com key continua sendo exibido como aba`);
    check(await page.locator('header p', { hasText: /^Processo de Compras$/ }).count() === 1, `[start ${width}] processo aparece como texto secundário`);
    check(await page.getByText('Setor: Protocolo', { exact: true }).count() === 0, `[start ${width}] prefixo Setor removido`);
    check(await page.getByText('Ambiente que não deve aparecer', { exact: true }).count() === 0, `[start ${width}] ambiente removido`);
    check(!await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), `[start ${width}] sem overflow horizontal`);

    const date = page.locator('[data-date-picker-input]').first();
    await date.focus();
    check(await page.locator('[data-date-picker-popover]').count() === 1, `[start ${width}] calendário shadcn Base abre ao focar o campo`);
    check(await date.evaluate((input) => document.activeElement === input), `[start ${width}] foco permanece no input para digitação manual`);
    const dateBox = await date.locator('xpath=..').boundingBox();
    check(!!dateBox && dateBox.width >= Math.min(260, width - 72), `[start ${width}] campo de data respeita uma largura legível`);
    if (width === 375) await page.screenshot({ path: `${OUT}/execucao-datepicker-mobile.png`, fullPage: true });
    await page.keyboard.press('Escape');

    if (width === 375) {
      const pickers = page.locator('[data-date-picker-input]');
      check(await pickers.count() === 3, '[start 375] renderiza os modos data, hora e data/hora');
      check(await page.locator('[data-date-picker-trigger]').count() === 3, '[start 375] os três modos possuem seletor visual');
      const modes = await page.locator('[data-date-picker-mode]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-date-picker-mode')));
      check(modes.join(',') === 'date,time,datetime', `[start 375] aplica os subtipos no runtime (${modes.join(',')})`);
      await pickers.nth(1).focus();
      await page.waitForTimeout(250);
      check(await page.locator('[data-date-picker-popover] [data-date-picker-time]').count() === 1, '[start 375] somente hora abre listas de horas e minutos');
      check(await page.locator('[data-date-picker-popover] [role="grid"]').count() === 0, '[start 375] somente hora não exibe calendário');
      await page.keyboard.press('Escape');
      await pickers.nth(2).focus();
      check(await page.locator('[data-date-picker-popover] [data-date-picker-time]').count() === 1, '[start 375] data e hora abre calendário com horário');
      await page.screenshot({ path: `${OUT}/execucao-datetime-mobile.png`, fullPage: true });
      await page.keyboard.press('Escape');
      check(await page.locator('[data-date-picker-iso]:visible').count() === 0, '[start 375] oculta os inputs ISO técnicos');
      const tomorrow = relativeDate(1);
      const yesterday = relativeDate(-1);
      await pickers.nth(0).fill(tomorrow.digits);
      await pickers.nth(0).blur();
      check(await pickers.nth(0).inputValue() === tomorrow.display, '[start 375] aplica máscara de data durante digitação manual');
      check(await pickers.nth(0).evaluate((input) => input.scrollWidth <= input.clientWidth + 1), '[start 375] valor completo da data não fica truncado');
      await pickers.nth(1).fill('1435');
      await pickers.nth(1).blur();
      check(await pickers.nth(1).inputValue() === '14:35', '[start 375] aplica máscara de hora durante digitação manual');
      await pickers.nth(2).fill(`${yesterday.digits}1030`);
      await pickers.nth(2).blur();
      check(await pickers.nth(2).inputValue() === `${yesterday.display} 10:30`, '[start 375] aplica máscara de data/hora durante digitação manual');
      const isoValues = await page.locator('[data-date-picker-iso]').evaluateAll((inputs) => inputs.map((input) => input.value));
      check(isoValues[0] === tomorrow.iso, `[start 375] data mantém ISO (${isoValues[0]})`);
      check(isoValues[1] === '14:35', `[start 375] hora mantém ISO (${isoValues[1]})`);
      check(isoValues[2] === `${yesterday.iso}T10:30`, `[start 375] data/hora mantém ISO (${isoValues[2]})`);

      await pickers.nth(2).focus();
      await page.getByRole('listbox', { name: 'Hora' }).getByRole('option', { name: '23', exact: true }).click();
      await page.getByRole('listbox', { name: 'Minuto' }).getByRole('option', { name: '59', exact: true }).click();
      check(await pickers.nth(2).inputValue() === `${yesterday.display} 23:59`, '[start 375] horário do popover atualiza a data/hora');
      check(await page.locator('[data-date-picker-iso]').nth(2).inputValue() === `${yesterday.iso}T23:59`, '[start 375] horário do popover preserva ISO');
      await page.getByRole('button', { name: 'Aplicar' }).click();

      await pickers.nth(0).fill('31022026');
      await pickers.nth(0).blur();
      check(await pickers.nth(0).getAttribute('aria-invalid') === 'true', '[start 375] rejeita data inexistente');
      check(await page.locator('[data-date-picker-iso]').nth(0).inputValue() === '', '[start 375] data inválida não chega ao valor ISO');

      await pickers.nth(0).fill(yesterday.digits);
      await pickers.nth(0).blur();
      check(await pickers.nth(0).getAttribute('aria-invalid') === 'true', '[start 375] limite impede data passada');
      await pickers.nth(2).fill(`${tomorrow.digits}1030`);
      await pickers.nth(2).blur();
      check(await pickers.nth(2).getAttribute('aria-invalid') === 'true', '[start 375] limite impede data/hora futura');

      await page.getByRole('button', { name: 'Botões de conclusão' }).click();
      await page.getByRole('button', { name: 'Iniciar solicitação' }).click();
      check(await page.locator('span.text-rose-600').count() >= 2, '[start 375] datas inválidas bloqueiam a conclusão e aparecem no formulário');
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
    await page.goto(`${BASE}/tasks/mock-task`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 5000 });

    check((await page.locator('h1').innerText()).trim() === 'ANAL · Analisar solicitação · Financeiro', `[task ${view.name}] setor aparece como sufixo`);
    check(await page.getByText('Setor: Financeiro', { exact: true }).count() === 0, `[task ${view.name}] prefixo Setor removido`);
    check(await page.getByRole('button', { name: 'Ver relatório do processo 321' }).count() === 1, `[task ${view.name}] número clicável presente`);
    const pillBox = await page.locator('[data-process-number-pill]').boundingBox();
    check(!!pillBox && pillBox.height <= 24, `[task ${view.name}] pill do processo está compacto`);

    if (view.name === 'desktop') {
      check(await page.getByRole('button', { name: 'Aprovar', exact: true }).count() === 1, '[task desktop] conclusões permanecem visíveis');
      check(await page.getByRole('button', { name: 'Salvar', exact: true }).count() === 1, '[task desktop] Salvar permanece visível');
      const actionBox = await page.getByRole('button', { name: 'Aprovar', exact: true }).boundingBox();
      check(!!actionBox && actionBox.height <= 36, '[task desktop] conclusão recupera o tamanho compacto original');
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

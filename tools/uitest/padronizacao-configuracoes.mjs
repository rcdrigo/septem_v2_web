// Padronização das configurações do modelador: helpers compartilhados, switches,
// placeholders operacionais e cabeçalhos enxutos.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (condition, message) => (condition ? ok.push(message) : bad.push(message));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();

try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 15000 });

  await page.goto(`${BASE}/flows/edit?key=teste_condicoes_ui`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
  await page.locator('[data-element-id="T005"]').click();
  await page.waitForTimeout(700);

  // O modelador tem dois asides (config do elemento + config do campo de formulário);
  // este teste é sobre o painel do ELEMENTO.
  const aside = page.locator('aside').filter({ hasText: 'Informações gerais' }).first();
  check(await aside.locator('header p').count() === 0, '[elemento] cabeçalho não mostra o tipo BPMN');
  check(await aside.getByRole('switch').count() >= 5, '[elemento] opções booleanas da tarefa usam switches');
  check(await aside.locator('input:not([type=checkbox]):not([type=radio])[placeholder], textarea[placeholder]').count() === 0, '[elemento] inputs e textareas não usam placeholders instrutivos');

  const validateHelp = aside.getByRole('button', { name: 'Ajuda: Validar campos' });
  await validateHelp.focus();
  check(await page.getByRole('tooltip').filter({ hasText: 'todos os campos obrigatórios' }).count() === 1, '[elemento] helper abre por foco e exibe a orientação');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.waitForSelector('h2:has-text("Configurações do processo")');
  const configRoot = page.locator('h2:has-text("Configurações do processo")').locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")][1]');
  check(await configRoot.locator('header p').count() === 0, '[processo] cabeçalho mantém somente o título');
  check(await configRoot.getByRole('switch').count() === 3, '[processo] as três permissões usam switches');
  check(await configRoot.locator('input[type=text][placeholder], input[type=url][placeholder], textarea[placeholder]').count() === 0, '[processo] campos textuais não usam placeholders instrutivos');
  check(await configRoot.locator('button', { hasText: 'Selecione a unidade' }).count() >= 1, '[processo] placeholder operacional da unidade foi preservado');

  const nameHelp = configRoot.getByRole('button', { name: 'Ajuda: Nome' });
  await nameHelp.focus();
  check(await page.getByRole('tooltip').filter({ hasText: 'barra superior' }).count() === 1, '[processo] helper de identificação abre por foco');
  await page.keyboard.press('Escape');

  await configRoot.getByRole('button', { name: 'Controle de acesso' }).click();
  const accessHelp = configRoot.getByRole('button', { name: 'Ajuda: Controle de acesso' });
  await accessHelp.focus();
  check(await page.getByRole('tooltip').filter({ hasText: 'Bloquear é exceção' }).count() === 1, '[processo] orientação de controle de acesso foi movida para helper');

  const overflow = await configRoot.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  check(!overflow, '[processo] configurações sem overflow horizontal');
  await page.screenshot({ path: `${OUT}/padronizacao-configuracoes.png`, fullPage: true });
} finally {
  await browser.close();
}

ok.forEach((message) => console.log('✓ ' + message));
bad.forEach((message) => console.log('✗ ' + message));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

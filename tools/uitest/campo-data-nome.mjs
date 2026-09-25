// Bug (3): "o NOME do campo de data não muda". Depois da troca do editor de formulário
// (form-js → editor NATIVO), o nome deixou de ser um par dateLabel/timeLabel e virou o
// `label` do elemento nativo — mas o que se cobra é o mesmo: renomear no painel muda o
// que aparece na LISTA de campos e no formulário renderizado. Bug (4): o seletor de data
// abre o calendário ao focar. Modelador é desktop → 1280.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log(`${c ? '✓' : '✗'} ${m}`); };

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  // Processo novo → aba Formulário. Um processo novo nasce com formulário nativo
  // (`createNativeForm`): uma aba, um agrupamento, nenhum campo.
  await page.goto(`${BASE}/flows/edit`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 15000 });
  await page.locator('header button, nav button', { hasText: 'Formulário' }).first().click();
  await page.locator('[data-native-editor]').waitFor({ timeout: 15000 });

  // Adiciona o campo "Data / Hora" pelo catálogo do agrupamento. O `addField` já
  // seleciona o campo novo e foca o "Nome" no painel de propriedades.
  await page.getByRole('button', { name: /^Adicionar campo em / }).first().click();
  await page.getByRole('button', { name: 'Data / Hora', exact: true }).click();
  await page.waitForTimeout(600);
  check(await page.locator('[data-field-id]').count() === 1, '[web] o campo entra no agrupamento');

  // Renomeia no painel e confirma que a LISTA de campos passa a mostrar o novo nome.
  const nomeInput = page.locator('[data-native-properties] input[aria-label="Nome"]');
  await nomeInput.waitFor({ timeout: 8000 });
  const NOVO = 'Nascimento ABC';
  await nomeInput.fill(NOVO);
  await nomeInput.blur();
  await page.waitForTimeout(800);
  check(await page.locator('[data-field-id]', { hasText: NOVO }).count() === 1,
    `[web] o nome do campo de data muda na lista ("${NOVO}")`);
  // O commit do Nome deriva a CHAVE enquanto ela não foi personalizada — sem chave o
  // campo não tem resposta e não chega ao formulário.
  const chave = await page.locator('[data-native-properties] input[aria-label="Chave (identificador)"]').inputValue();
  check(/\w/.test(chave), `[web] e a chave é derivada do nome ("${chave}")`);

  // Prévia → ReactForm com o seletor de data novo (default = data e hora).
  await page.locator('button', { hasText: 'Prévia' }).first().click();
  const dateSel = '[role=dialog] .septem-date-picker-input';
  await page.waitForSelector(dateSel, { timeout: 8000 });
  check(await page.locator('[role=dialog]').getByText(NOVO).count() >= 1,
    '[web] o formulário renderizado exibe o novo nome');
  check(await page.locator('[role=dialog] [data-date-picker-mode="datetime"]').count() === 1,
    '[web] campo novo mantém o subtipo data e hora');
  await page.locator(dateSel).focus();
  await page.waitForTimeout(300);
  check(await page.locator('[data-date-picker-popover]').count() > 0,
    '[web] o calendário abre ao focar o campo');
  check(await page.locator('[data-date-picker-time]').count() === 1,
    '[web] o subtipo data e hora exibe o seletor de horário');
  await page.screenshot({ path: `${OUT}/campo-data-nome.png` });
} finally { await browser.close(); }
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

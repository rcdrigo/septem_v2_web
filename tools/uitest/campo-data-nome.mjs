// Bugs: (3) "o NOME do campo de data não muda" — form-js exibe o datetime por
// dateLabel/timeLabel, não por label; o painel só gravava label. Fix: para datetime,
// grava label+dateLabel+timeLabel. (4) O preview usa o datepicker compartilhado e
// abre seu calendário ao focar. Modelador é desktop → 1280.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  // Processo novo → Formulário.
  await page.goto(`${BASE}/processos/editar`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.locator('header button, nav button', { hasText: 'Formulário' }).first().click();
  await page.waitForTimeout(1500);

  // Adiciona o campo "Data / Hora" pela paleta. O addField já AUTO-SELECIONA o novo
  // campo (form-js selection.set) → o painel de configuração abre sozinho.
  await page.locator('button', { hasText: 'Data / Hora' }).first().click();
  await page.waitForTimeout(1200);

  // Muda o "Nome" no painel de configuração e confirma que o canvas reflete (bug 3).
  const nomeInput = page.locator('aside label', { hasText: 'Nome' }).locator('xpath=following-sibling::input[1]').first();
  await nomeInput.waitFor({ timeout: 8000 });
  const NOVO = 'Nascimento ABC';
  await nomeInput.fill(NOVO);
  await nomeInput.blur();
  await page.waitForTimeout(800);
  const canvasMostra = await page.evaluate((txt) => {
    const canvas = document.querySelector('.fjs-container') || document.body;
    return canvas.textContent?.includes(txt) ?? false;
  }, NOVO);
  check(canvasMostra, `[web] o nome do campo de data muda no canvas ("${NOVO}")`);
  // Confirma no schema serializado que dateLabel foi gravado (não só label).
  const schemaOk = await page.evaluate((txt) => {
    // saveSchema não é exposto no window; checa via o texto do canvas do form-js,
    // que renderiza o subtítulo do datetime por dateLabel.
    const els = [...document.querySelectorAll('.fjs-element')];
    return els.some((e) => e.textContent?.includes(txt));
  }, NOVO);
  check(schemaOk, `[web] o datetime passa a exibir o novo nome (dateLabel aplicado)`);

  // Pré-visualização → ReactForm com datepicker moderno (default = data e hora).
  await page.locator('button', { hasText: 'Pré-visualizar' }).first().click();
  const dateSel = '[role=dialog] .septem-date-picker-input';
  await page.waitForSelector(dateSel, { timeout: 8000 });
  await page.locator('[role=dialog] [data-date-picker-trigger]').first().click();
  const abriu = await page.locator('[data-date-picker-popover]').count() > 0;
  check(abriu, '[web] o calendário shadcn Base abre pelo botão');
  await page.screenshot({ path: `${OUT}/campo-data-nome.png` });
} finally { await browser.close(); }
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

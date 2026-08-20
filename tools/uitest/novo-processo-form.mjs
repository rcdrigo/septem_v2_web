// Bug: "Ao criar um processo NOVO, aparece o FORMULÁRIO do processo anterior." Causa:
// sem ?key= o form caía no localStorage do processo anterior. Fix: fallback do
// localStorage só com ?key=; builder é esvaziado no processo novo. Prova: (A) processo
// existente ainda carrega seu form (não regrediu); (B) com um form "fantasma" no
// localStorage, o processo NOVO NÃO o exibe. Modelador é desktop → 1280.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

async function irFormulario(page) {
  await page.locator('header button, nav button', { hasText: 'Formulário' }).first().click();
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  // (A) Processo EXISTENTE ainda carrega o próprio formulário (regressão).
  await page.goto(`${BASE}/flows/edit?key=teste_condicoes_ui`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-element-id="G1"]', { timeout: 20000 });
  await irFormulario(page);
  const existenteCarrega = await page.evaluate(() => document.body.innerText.includes('Nome do requisitante'));
  check(existenteCarrega, '[web] processo existente ainda carrega seu formulário (Nome do requisitante)');

  // Semeia um form "fantasma" no localStorage (simula o processo anterior).
  await page.evaluate(() => {
    const ghost = { components: [{ type: 'textfield', key: 'fantasma', label: 'CampoFantasmaXYZ' }] };
    window.localStorage.setItem('septem.modelador.form', JSON.stringify(ghost));
  });

  // (B) Processo NOVO (sem ?key=): NÃO deve exibir o form fantasma do localStorage.
  await page.goto(`${BASE}/flows/edit`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await irFormulario(page);
  const mostraFantasma = await page.evaluate(() => document.body.innerText.includes('CampoFantasmaXYZ'));
  check(!mostraFantasma, '[web] processo NOVO NÃO herda o formulário anterior (sem "CampoFantasmaXYZ")');
  await page.screenshot({ path: `${OUT}/novo-processo-form.png`, fullPage: true });
} finally { await browser.close(); }
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

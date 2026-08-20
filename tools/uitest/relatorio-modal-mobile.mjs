// Correção (mobile 375): o modal de configuração do componente deve empilhar as
// duas colunas (config em cima, preview embaixo), sem estouro horizontal, e
// continuar funcional (preview ao vivo + salvar). Regra: toda UI nova funciona
// em web E mobile.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));
const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;
const rid = Math.floor(Math.random() * 1e9);

const ds = await api(token, '/api/v1/data-sources', 'POST', {
  name: `Fonte mobile ${rid}`, scope: 'report', type: 'fixed',
  config: { items: [{ value: '10', label: 'Obras' }, { value: '30', label: 'Obras' }, { value: '5', label: 'Saúde' }] },
});
const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `Relatório Mobile ${rid}`, sourceType: 'dataSource', dataSourceId: ds.body.id, definitionJson: JSON.stringify({ blocks: [] }),
});
const key = novo.body.key;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  await page.goto(`${BASE}/reports/edit?key=${key}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Componentes do relatório', { timeout: 15000 });
  await page.waitForTimeout(600);

  await page.getByRole('button', { name: 'Adicione um componente' }).click();
  await page.waitForSelector('[role=dialog]', { timeout: 8000 });
  const dlg = page.locator('[role=dialog]');

  // Config e preview empilhados: o container de 2 colunas vira 1 no mobile.
  await dlg.getByRole('button', { name: 'KPI / Card' }).click();
  await dlg.locator('label:has-text("Agregação") select').selectOption('sum');
  await dlg.locator('label:has-text("Campo de valor") select').selectOption('value');
  await page.waitForTimeout(1500);
  check(/\b45\b/.test(await dlg.innerText()), '[mobile] preview ao vivo renderiza no 375 (soma=45)');

  // Sem estouro horizontal: nada mais largo que a viewport (375).
  const overflow = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    let worst = 0, culprit = '';
    for (const el of document.querySelectorAll('[role=dialog] *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1 && r.right - vw > worst) {
        worst = r.right - vw; culprit = `${el.tagName}.${(el.className || '').toString().slice(0, 40)}`;
      }
    }
    return { vw, worst: Math.round(worst), culprit, docScroll: document.documentElement.scrollWidth > vw + 1 };
  });
  check(overflow.worst === 0, `[mobile] modal não estoura a largura (pior=${overflow.worst}px ${overflow.culprit})`);

  await page.screenshot({ path: `${OUT}/relatorio-modal-mobile.png`, fullPage: false });

  // Rola até o rodapé e salva — botão acessível no mobile.
  await dlg.getByRole('button', { name: 'Salvar' }).scrollIntoViewIfNeeded();
  await dlg.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(500);
  check(await page.locator('[role=dialog]').count() === 0, '[mobile] salvar fecha o modal');
  check(await page.locator('.grid-cols-12 > div').count() === 1, '[mobile] o componente entra no grid');
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Correção: adicionar componente ao relatório abre um MODAL de 2 colunas —
// esquerda configura (tipo, colunas, agregação, tamanho no grid), direita monta
// um PREVIEW ao vivo conforme os parâmetros mudam. Salvar coloca o card no grid
// de 12 colunas; o tamanho (w×h) persiste no rascunho. Modelador = desktop 1280.
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

// Fonte de dados fixa (label + value) para o preview ter o que agregar.
const ds = await api(token, '/api/v1/data-sources', 'POST', {
  name: `Fonte modal ${rid}`, scope: 'report', type: 'fixed',
  config: { items: [
    { value: '10', label: 'Obras' }, { value: '30', label: 'Obras' }, { value: '5', label: 'Saúde' },
  ] },
});
check(ds.status === 201, `[api] fonte de dados criada (${ds.status})`);

const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `Relatório Modal ${rid}`, sourceType: 'dataSource', dataSourceId: ds.body.id,
  definitionJson: JSON.stringify({ blocks: [] }),
});
check(novo.status === 201, `[api] relatório criado com a fonte (${novo.status})`);
const key = novo.body.key;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  await page.goto(`${BASE}/relatorios/editar?key=${key}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Componentes do relatório', { timeout: 15000 });
  await page.waitForTimeout(600);

  // CTA do empty state abre o MODAL.
  await page.getByRole('button', { name: 'Adicione um componente' }).click();
  await page.waitForSelector('[role=dialog]', { timeout: 8000 });
  const dlg = page.locator('[role=dialog]');
  check(await dlg.getByText('Adicionar componente').count() >= 1, '[web] modal "Adicionar componente" abriu');
  // Duas colunas: os tiles de tipo à esquerda, o preview à direita.
  check(await dlg.getByRole('button', { name: 'KPI / Card' }).count() === 1, '[web] tiles de tipo presentes (esquerda)');

  // Escolhe KPI e configura soma de "value" → preview deve mostrar 45 (10+30+5).
  await dlg.getByRole('button', { name: 'KPI / Card' }).click();
  await page.waitForTimeout(300);
  await dlg.locator('label:has-text("Agregação") select').selectOption('sum');
  await dlg.locator('label:has-text("Campo de valor") select').selectOption('value');
  // preview é debounced (~450ms) e faz round-trip no backend.
  await page.waitForTimeout(1500);
  const previewTxt = await dlg.innerText();
  check(/\b45\b/.test(previewTxt), `[web] preview ao vivo calcula o KPI (soma=45) — encontrado: ${/\b45\b/.test(previewTxt)}`);

  // Tamanho no grid: largura 4 colunas, altura 2 linhas.
  await dlg.locator('input[aria-label="Largura em colunas"]').fill('4');
  await dlg.locator('input[aria-label="Altura em linhas"]').fill('2');
  await dlg.getByRole('textbox').first().fill(`KPI Soma ${rid}`); // título
  await page.screenshot({ path: `${OUT}/relatorio-modal-componente.png`, fullPage: false });

  // Salvar → card entra no grid e o modal fecha.
  await dlg.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(500);
  check(await page.locator('[role=dialog]').count() === 0, '[web] modal fecha ao salvar');
  const card = page.locator('.grid-cols-12 > div', { hasText: `KPI Soma ${rid}` });
  check(await card.count() === 1, '[web] o componente aparece como card no grid');
  check((await card.innerText()).includes('4×2'), '[web] o card mostra o tamanho no grid (4×2)');

  // Salva o rascunho e confere que w/h persistem na definição.
  await page.locator('header button', { hasText: 'Salvar rascunho' }).first().click();
  await page.waitForTimeout(1500);
  const det = await api(token, `/api/v1/reports/${key}`);
  const def = JSON.parse(det.body?.definitionJson || '{}');
  const blk = (def.blocks || [])[0] || {};
  check(blk.type === 'kpi' && blk.w === 4 && blk.h === 2,
    `[api] w/h persistem no rascunho (type=${blk.type} w=${blk.w} h=${blk.h})`);

  // Reabrir pelo ✎ traz a config salva (edição).
  await card.locator('button[aria-label="Editar componente"]').click({ force: true });
  await page.waitForSelector('[role=dialog]', { timeout: 8000 });
  check(await page.locator('[role=dialog]').getByText('Editar componente').count() >= 1,
    '[web] ✎ reabre o modal em modo edição');
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

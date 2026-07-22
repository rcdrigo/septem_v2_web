// Fase 7 — config no modal: tile "Mapa de calor" (F7.10), campos do KPI ícone/cor/
// evolução (F7.11) e ordenação por várias colunas (F7.7). Prova que a config chega
// à definição salva. Modelador = desktop 1280.
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
  name: `Fonte F7m ${rid}`, scope: 'report', type: 'fixed',
  config: { items: [{ value: '10', label: 'Obras' }, { value: '5', label: 'Saúde' }] },
});
const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `Relatório F7m ${rid}`, sourceType: 'dataSource', dataSourceId: ds.body.id, definitionJson: JSON.stringify({ blocks: [] }),
});
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
  await page.waitForSelector('text=Origem dos dados', { timeout: 15000 });
  await page.locator('nav button', { hasText: 'Blocos' }).click();
  await page.waitForTimeout(400);

  // ── Componente 1: Mapa de calor (F7.10) ──────────────────────────────
  await page.getByRole('button', { name: 'Adicione um componente' }).click();
  await page.waitForSelector('[role=dialog]', { timeout: 8000 });
  let dlg = page.locator('[role=dialog]');
  check(await dlg.getByRole('button', { name: 'Mapa de calor' }).count() === 1, '[F7.10] o modal tem o tile "Mapa de calor"');
  await dlg.getByRole('button', { name: 'Mapa de calor' }).click();
  await page.waitForTimeout(200);
  await dlg.locator('label:has-text("Agrupar por") select').selectOption('label');
  check((await dlg.locator('label:has-text("Nº de cards") ').count()) >= 1, '[F7.10] heatmap mostra "Nº de cards (top-N)"');
  await page.waitForTimeout(1200);
  check(await dlg.locator('.bg-amber-50').count() >= 1, '[F7.10] preview do heatmap renderiza cards laranja');
  await dlg.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(400);

  // ── Componente 2: KPI com ícone/cor/evolução + multi-sort (F7.11/F7.7) ─
  await page.getByRole('button', { name: 'Adicionar componente' }).click();
  await page.waitForSelector('[role=dialog]', { timeout: 8000 });
  dlg = page.locator('[role=dialog]');
  await dlg.getByRole('button', { name: 'KPI / Card' }).click();
  await page.waitForTimeout(200);
  check(await dlg.locator('label:has-text("Ícone") select').count() === 1, '[F7.11] KPI tem seletor de ícone');
  check(await dlg.locator('input[aria-label="Cor do KPI"]').count() === 1, '[F7.11] KPI tem seletor de cor');
  check(await dlg.locator('label:has-text("Evolução por") select').count() === 1, '[F7.11] KPI tem campo de evolução (sparkline)');
  await dlg.locator('label:has-text("Ícone") select').selectOption('dollar');
  await dlg.locator('input[aria-label="Cor do KPI"]').fill('#e11d48');
  await dlg.locator('label:has-text("Agregação") select').selectOption('sum');
  await dlg.locator('label:has-text("Campo de valor") select').selectOption('value');

  // Multi-sort: adiciona uma 2ª coluna de ordenação (F7.7).
  await dlg.getByRole('button', { name: 'Adicionar ordenação' }).click();
  await page.waitForTimeout(150);
  await dlg.getByRole('button', { name: 'Adicionar ordenação' }).click();
  await page.waitForTimeout(150);
  const sortRows = await dlg.locator('select[aria-label^="Ordenar por"]').count();
  check(sortRows >= 2, `[F7.7] dá para adicionar mais de uma ordenação (${sortRows})`);
  await dlg.locator('select[aria-label="Ordenar por 1"]').selectOption('label');
  await dlg.locator('select[aria-label="Ordenar por 2"]').selectOption('value');

  await dlg.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(400);
  await page.locator('header button', { hasText: 'Salvar rascunho' }).click();
  await page.waitForTimeout(1500);

  // Confere que tudo persistiu na definição.
  const det = await api(token, `/api/v1/reports/${key}`);
  const def = JSON.parse(det.body?.definitionJson || '{}');
  const heat = (def.blocks || []).find((b) => b.type === 'heatmap');
  const kpi = (def.blocks || []).find((b) => b.type === 'kpi');
  check(!!heat && heat.groupBy === 'label', '[F7.10] o mapa de calor persiste com o agrupamento');
  check(!!kpi && kpi.icon === 'dollar' && !!kpi.color, `[F7.11] KPI persiste ícone/cor (icon=${kpi?.icon})`);
  check(Array.isArray(kpi?.sorts) && kpi.sorts.length >= 2, `[F7.7] a ordenação múltipla persiste (${kpi?.sorts?.length} níveis)`);
  await page.screenshot({ path: `${OUT}/relatorio-f7-modal.png`, fullPage: false });
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

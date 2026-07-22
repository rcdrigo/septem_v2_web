// Fase 7 — viewer (F7.8 filtros, F7.9 olho, F7.10 mapa de calor, F7.11 KPI ícone/cor).
// Monta um relatório publicado (fonte de dados) com KPI colorido + heatmap + tabela
// com coluna oculta, abre a consulta em aba própria e confere a renderização.
// Web 1280 + checagem de overflow no mobile 375.
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
  name: `Fonte F7v ${rid}`, scope: 'report', type: 'fixed',
  config: { items: [{ value: '10', label: 'Obras' }, { value: '30', label: 'Obras' }, { value: '5', label: 'Saúde' }] },
});
const def = {
  columnLabels: { label: 'Setor', value: 'Valor' },
  blocks: [
    { id: 'k', type: 'kpi', title: 'Total', agg: 'sum', valueField: 'value', icon: 'dollar', color: '#e11d48' },
    { id: 'h', type: 'heatmap', title: 'Por setor', groupBy: 'label', agg: 'count' },
    { id: 't', type: 'table', title: 'Detalhe', columns: [{ key: 'label' }, { key: 'value', visible: false }] },
  ],
};
const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `Relatório F7v ${rid}`, sourceType: 'dataSource', dataSourceId: ds.body.id, definitionJson: JSON.stringify(def),
});
const key = novo.body.key;
const pub = await api(token, `/api/v1/reports/${key}/publish`, 'POST', {});
check(pub.status === 200, `[api] publicado (${pub.status})`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  await page.goto(`${BASE}/consultas/ver?key=${key}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Detalhe', { timeout: 15000 });
  await page.waitForTimeout(1200);

  // F7.11 — KPI com ícone (svg) e cor aplicada no valor.
  check(/\bR?\$?\s?45\b|45/.test(await page.locator('body').innerText()), '[F7.11] KPI mostra o total (45)');
  const kpiColored = await page.evaluate(() => {
    const el = [...document.querySelectorAll('p')].find((p) => /(^|\s)45(\s|$)/.test(p.textContent || ''));
    if (!el) return false;
    const c = getComputedStyle(el).color;
    return c.includes('225') && c.includes('29') && c.includes('72'); // rgb(225,29,72) = #e11d48
  });
  check(kpiColored, '[F7.11] o valor do KPI usa a cor configurada (#e11d48)');
  check(await page.locator('section:has-text("Total") svg').count() >= 1, '[F7.11] o KPI tem ícone');

  // F7.10 — mapa de calor: cards laranja + "Ver todos os registros".
  const heat = page.locator('section:has-text("Por setor")');
  check(await heat.locator('.bg-amber-50').count() >= 2, '[F7.10] heatmap tem mini-cards (Obras/Saúde)');
  check(await heat.getByText('Ver todos os registros').count() === 1, '[F7.10] card "Ver todos os registros"');

  // F7.9 — coluna oculta liga o botão de olho "Visualizar detalhamento".
  check(await page.locator('button[aria-label="Visualizar detalhamento"]').count() >= 1, '[F7.9] botão de olho nas linhas com coluna oculta');

  // F7.8 — filtros no viewer: botão Filtrar → filtra a tabela por coluna.
  const table = page.locator('section:has-text("Detalhe")');
  const rowsAntes = await table.locator('tbody:not(.hidden) tr').count();
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.waitForTimeout(300);
  const filtro = table.locator('input[aria-label="Filtrar Setor"]');
  check(await filtro.count() === 1, '[F7.8] linha de filtro aparece por coluna');
  await filtro.fill('saude'); // sem acento e minúsculo → deve casar "Saúde"
  await page.waitForTimeout(300);
  const rowsDepois = await table.locator('tbody:not(.hidden) tr').count();
  check(rowsDepois === 1 && rowsDepois < rowsAntes, `[F7.8] filtro sem acento/caixa reduz as linhas (${rowsAntes}→${rowsDepois})`);
  await page.screenshot({ path: `${OUT}/relatorio-f7-viewer.png`, fullPage: true });

  // Mobile 375 — sem overflow horizontal.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(over <= 1, `[mobile] viewer sem overflow horizontal (${over}px)`);
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

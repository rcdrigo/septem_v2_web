// F7.1 — a Consulta (relatório publicado) abre em ABA PRÓPRIA (link direto
// /reports/view?key=), não mais embutida no catálogo. Prova: (a) o botão Abrir
// dispara window.open para a rota standalone; (b) a rota standalone renderiza o
// viewer com os dados. Testa web 1280 e a rota no mobile 375.
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
  name: `Fonte consulta ${rid}`, scope: 'report', type: 'fixed',
  config: { items: [{ value: '10', label: 'Obras' }, { value: '5', label: 'Saúde' }] },
});
const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `Consulta Aba ${rid}`, sourceType: 'dataSource', dataSourceId: ds.body.id,
  definitionJson: JSON.stringify({ blocks: [{ id: 'k', type: 'kpi', agg: 'sum', valueField: 'value' }] }),
});
const key = novo.body.key;
const pub = await api(token, `/api/v1/reports/${key}/publish`, 'POST', {});
check(pub.status === 200, `[api] relatório publicado (${pub.status})`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// Captura o window.open (com noopener o evento popup do playwright é instável).
await ctx.addInitScript(() => { window.__opened = []; const o = window.open.bind(window); window.open = (u, ...r) => { window.__opened.push(String(u)); try { return o(u, ...r); } catch { return null; } }; });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  // Catálogo de Consultas: o card do relatório publicado + botão Abrir.
  await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
  const card = page.locator('article', { hasText: `Consulta Aba ${rid}` });
  await card.waitFor({ timeout: 10000 });
  check(await card.count() === 1, '[web] o relatório publicado aparece no catálogo de Consultas');

  // F7.1 — clicar Abrir NÃO embute na página; dispara window.open para a rota standalone.
  await card.getByRole('button', { name: 'Abrir' }).click();
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => window.__opened || []);
  check(opened.some((u) => u.includes(`reports/view?key=${key}`)), `[F7.1] Abrir dispara aba própria (${opened.join(',') || 'nada'})`);
  // A página do catálogo continua sendo o catálogo (não virou o viewer embutido).
  check(await page.locator('h1', { hasText: 'Consultas' }).count() === 1, '[F7.1] o catálogo permanece (sem embed inline)');

  // A rota standalone renderiza o viewer com o KPI (soma 10+5=15).
  await page.goto(`${BASE}/reports/view?key=${key}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check(await page.locator('h1', { hasText: `Consulta Aba ${rid}` }).count() === 1, '[F7.1] rota standalone mostra o nome do relatório');
  check(/\b15\b/.test(await page.locator('body').innerText()), '[F7.1] rota standalone renderiza os dados (KPI soma=15)');
  await page.screenshot({ path: `${OUT}/consulta-aba-propria.png`, fullPage: false });

  // Mobile 375: a rota standalone continua utilizável (sem overflow horizontal).
  const m = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  // replica a sessão no novo contexto
  const store = await page.evaluate(() => JSON.stringify(window.localStorage));
  await m.addInitScript((s) => { const d = JSON.parse(s); for (const k in d) window.localStorage.setItem(k, d[k]); }, store);
  await m.goto(`${BASE}/reports/view?key=${key}`, { waitUntil: 'networkidle' });
  await m.waitForTimeout(1500);
  const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(over <= 1, `[F7.1][mobile] rota standalone sem overflow horizontal (${over}px)`);
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

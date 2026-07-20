// Correção: ao criar um relatório novo (sem blocos), o container central da aba
// "Blocos" deve mostrar um empty state — ícone + texto com CTA "Adicione um
// componente" — e clicar no CTA adiciona o primeiro bloco (tabela).
// Modelador de relatório é desktop → web 1280.
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

// Relatório novo, sem definição (definitionJson vazio → sem blocos).
const novo = await api(token, '/api/v1/reports/', 'POST', { name: `Relatório Vazio ${rid}`, sourceType: 'dataSource' });
check(novo.status === 201, `[api] relatório novo criado (${novo.status})`);
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
  await page.waitForSelector('text=Blocos do relatório', { timeout: 15000 });
  await page.waitForTimeout(500);

  // O empty state substitui o texto miúdo antigo: ícone + CTA.
  const cta = page.getByRole('button', { name: 'Adicione um componente' });
  check(await cta.count() === 1, '[web] empty state exibe o CTA "Adicione um componente"');
  const svgAntes = await page.locator('section:has-text("Blocos do relatório") .border-dashed svg').count();
  check(svgAntes >= 1, '[web] empty state tem o ícone ilustrativo');
  await page.screenshot({ path: `${OUT}/relatorio-empty-state.png`, fullPage: false });

  // Clicar no CTA adiciona o primeiro bloco (tabela) e o empty state some.
  await cta.click();
  await page.waitForTimeout(400);
  check(await page.getByRole('button', { name: 'Adicione um componente' }).count() === 0,
    '[web] após clicar, o empty state some');
  const temTabela = await page.locator('section:has-text("Blocos do relatório")').getByText('Tabela', { exact: true }).count();
  check(temTabela >= 1, '[web] o CTA adicionou um bloco de Tabela');

  // Remover o bloco traz o empty state de volta.
  await page.locator('button[aria-label="Remover bloco"]').first().click();
  await page.waitForTimeout(300);
  check(await page.getByRole('button', { name: 'Adicione um componente' }).count() === 1,
    '[web] remover o último bloco reexibe o empty state');
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

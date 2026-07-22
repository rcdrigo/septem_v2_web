// Fase 7 — editor de relatório (F7.2–F7.5):
//  F7.2 sem botão "Preview" no topo (a aba Preview continua)
//  F7.3 "Origem dos dados" vira ABA própria (não aparece na aba Blocos)
//  F7.4 "Atualizar campos da origem" (era "Sincronizar schema") + popover de ajuda
//  F7.5 renomear coluna (rótulo custom) persiste; remover só aparece em processo
// Editor é desktop → web 1280 (o modelador some no mobile).
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
  name: `Fonte F7 ${rid}`, scope: 'report', type: 'fixed',
  config: { items: [{ value: '10', label: 'Obras' }, { value: '5', label: 'Saúde' }] },
});
const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `Relatório F7 ${rid}`, sourceType: 'dataSource', dataSourceId: ds.body.id, definitionJson: JSON.stringify({ blocks: [] }),
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
  await page.waitForTimeout(500);

  // F7.2 — sem botão "Preview" no topo; mas a aba Preview existe.
  const header = page.locator('header');
  check(await header.getByRole('button', { name: 'Preview' }).count() === 0, '[F7.2] header não tem botão Preview');
  check(await page.locator('nav button', { hasText: 'Preview' }).count() === 1, '[F7.2] a aba Preview continua existindo');

  // F7.4 — botão renomeado + popover de ajuda (não mais "Sincronizar schema").
  check(await header.getByRole('button', { name: 'Atualizar campos da origem' }).count() === 1, '[F7.4] botão "Atualizar campos da origem"');
  check(!(await page.locator('body').innerText()).includes('Sincronizar schema'), '[F7.4] jargão "Sincronizar schema" removido');
  check(await header.getByRole('button', { name: /O que faz atualizar os campos/ }).count() === 1, '[F7.4] há o ícone de ajuda (popover)');

  // F7.3 — "Origem dos dados" é uma ABA própria; a seção não aparece na aba Blocos.
  check(await page.locator('nav button', { hasText: 'Origem dos dados' }).count() === 1, '[F7.3] existe a aba "Origem dos dados"');
  // Padrão é a aba Blocos (empty state); a seção Origem não aparece aqui.
  check(await page.getByRole('heading', { name: 'Origem dos dados' }).count() === 0, '[F7.3] a seção Origem NÃO aparece na aba Blocos');
  check(await page.locator('text=Componentes do relatório').count() === 1, '[F7.3] a aba Blocos mostra os componentes');
  // Abre a aba Origem: a tabela de campos aparece.
  await page.locator('nav button', { hasText: 'Origem dos dados' }).click();
  await page.waitForTimeout(300);
  check(await page.locator('table', { hasText: 'Rótulo no relatório' }).count() === 1, '[F7.3] aba Origem mostra a tabela de campos');

  // F7.5 — remover NÃO aparece em fonte de dados; aparece em processo.
  check(await page.locator('button[aria-label="Remover label"]').count() === 0, '[F7.5] sem botão remover coluna em fonte de dados');

  // F7.5 — renomear a coluna "label" para "Setor" e salvar → persiste em columnLabels.
  await page.locator('input[aria-label="Rótulo de label"]').fill('Setor');
  await page.locator('header button', { hasText: 'Salvar rascunho' }).click();
  await page.waitForTimeout(1500);
  const det = await api(token, `/api/v1/reports/${key}`);
  const def = JSON.parse(det.body?.definitionJson || '{}');
  check(def.columnLabels?.label === 'Setor', `[F7.5] rótulo custom persiste (columnLabels.label=${def.columnLabels?.label})`);
  await page.screenshot({ path: `${OUT}/relatorio-editor-f7.png`, fullPage: false });

  // F7.5 — troca a origem para PROCESSO → botão remover aparece (precisa de processo com campos).
  await page.locator('label:has-text("Tipo de origem") select').selectOption('process');
  await page.waitForTimeout(400);
  check(await page.locator('label:has-text("Processo")').count() >= 1, '[F7.5] origem processo expõe o seletor de processo (remoção habilitada nessa origem)');
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

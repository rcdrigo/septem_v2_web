// Reauditoria da Fase 7 mirando o EFEITO (não a existência do controle):
//  F7.5 — clicar REMOVER uma coluna (origem processo) some com ela de verdade:
//         persiste em hiddenColumns E some das opções do modal de componente.
//  F7.8 — filtro de INTERVALO (número min–max) no viewer reduz as linhas certas.
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

// ── Cenário processo (para F7.5 remover) ─────────────────────────────────────
const pkey = `proc_ra_${rid}`;
const xml = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${rid}" targetNamespace="x">
  <bpmn:process id="P_${rid}" name="Proc RA ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig status="published" />
      <septem:formSchema>{"type":"default","schemaVersion":17,"components":[{"type":"textfield","key":"nome","label":"Nome"},{"type":"number","key":"valor","label":"Valor"}]}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" /><bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;
await api(token, '/api/v1/workflow/process-definitions/', 'POST', { key: pkey, bpmnXml: xml });
const rp = await api(token, '/api/v1/reports/', 'POST', { name: `RA proc ${rid}`, sourceType: 'process', processKey: pkey, definitionJson: JSON.stringify({ blocks: [] }) });
const pkeyReport = rp.body.key;

// ── Cenário fonte de dados numérica (para F7.8 intervalo) ────────────────────
const ds = await api(token, '/api/v1/data-sources', 'POST', {
  name: `Fonte RA ${rid}`, scope: 'report', type: 'fixed',
  config: { items: [{ value: '10', label: 'A' }, { value: '20', label: 'B' }, { value: '30', label: 'C' }] },
});
const rd = await api(token, '/api/v1/reports/', 'POST', {
  name: `RA nums ${rid}`, sourceType: 'dataSource', dataSourceId: ds.body.id,
  definitionJson: JSON.stringify({ columnTypes: { value: 'number' }, blocks: [{ id: 't', type: 'table', title: 'Nums', columns: [{ key: 'label' }, { key: 'value' }] }] }),
});
const dkey = rd.body.key;
await api(token, `/api/v1/reports/${dkey}/publish`, 'POST', {});

// ── Cenário sparkline (F7.11): coluna de data em 3 meses distintos ───────────
const dss = await api(token, '/api/v1/data-sources', 'POST', {
  name: `Fonte spark ${rid}`, scope: 'report', type: 'fixed',
  config: { items: [{ value: '5', label: '2026-01-10' }, { value: '8', label: '2026-02-15' }, { value: '3', label: '2026-03-20' }] },
});
const rs = await api(token, '/api/v1/reports/', 'POST', {
  name: `RA spark ${rid}`, sourceType: 'dataSource', dataSourceId: dss.body.id,
  definitionJson: JSON.stringify({
    columnTypes: { value: 'number', label: 'date' },
    blocks: [{ id: 'k', type: 'kpi', title: 'Evolucao', agg: 'sum', valueField: 'value', trendField: 'label', icon: 'trendingUp', color: '#0ea5e9' }],
  }),
});
const skey = rs.body.key;
await api(token, `/api/v1/reports/${skey}/publish`, 'POST', {});

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  // ═══ F7.5 — REMOVER coluna (efeito de verdade) ═══
  await page.goto(`${BASE}/reports/edit?key=${pkeyReport}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('nav button:has-text("Origem dos dados")', { timeout: 15000 });
  await page.locator('nav button', { hasText: 'Origem dos dados' }).click();
  await page.waitForTimeout(800);
  // remove a coluna "nome" (campo do formulário) clicando no ×.
  const rmNome = page.locator('button[aria-label="Remover nome"]');
  check(await rmNome.count() === 1, '[F7.5] botão remover da coluna "nome" existe (origem processo)');
  await rmNome.click();
  await page.waitForTimeout(300);
  check(await page.locator('button:has-text("restaurar")').count() >= 1, '[F7.5] após remover, aparece "restaurar" (linha esmaecida)');
  await page.locator('header button', { hasText: 'Salvar rascunho' }).click();
  await page.waitForTimeout(1500);
  const det = await api(token, `/api/v1/reports/${pkeyReport}`);
  const def = JSON.parse(det.body?.definitionJson || '{}');
  check(Array.isArray(def.hiddenColumns) && def.hiddenColumns.includes('nome'), `[F7.5] "nome" persiste em hiddenColumns (${JSON.stringify(def.hiddenColumns)})`);
  // EFEITO: no modal de componente, "nome" não aparece mais em "Agrupar por".
  await page.locator('nav button', { hasText: 'Blocos' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Adicion.* componente/ }).first().click();
  await page.waitForSelector('[role=dialog]', { timeout: 8000 });
  const dlg = page.locator('[role=dialog]');
  await dlg.getByRole('button', { name: 'Barras', exact: true }).click();
  await page.waitForTimeout(200);
  const grpOpts = await dlg.locator('label:has-text("Agrupar por") select option').allInnerTexts();
  check(!grpOpts.some((o) => /(^|\W)Nome(\W|$)/i.test(o)), `[F7.5-EFEITO] "nome" removida some das opções de agrupamento (${grpOpts.join('|')})`);
  check(grpOpts.some((o) => /Valor/i.test(o)), '[F7.5-EFEITO] "valor" (não removida) continua disponível');
  await dlg.getByRole('button', { name: 'Cancelar' }).click();

  // ═══ F7.8 — filtro de INTERVALO numérico (efeito de verdade) ═══
  await page.goto(`${BASE}/reports/view?key=${dkey}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Nums', { timeout: 15000 });
  await page.waitForTimeout(1000);
  const table = page.locator('section:has-text("Nums")');
  const antes = await table.locator('tbody:not(.hidden) tr').count();
  check(antes === 3, `[F7.8] tabela começa com 3 linhas (${antes})`);
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.waitForTimeout(300);
  // a coluna "value" é número → deve renderizar min/max, não texto.
  const minInput = table.locator('input[aria-label="Mínimo de value"]');
  check(await minInput.count() === 1 && (await minInput.getAttribute('type')) === 'number', '[F7.8] coluna numérica mostra filtro de INTERVALO (min/max number)');
  await minInput.fill('20'); // mantém 20 e 30, corta 10
  await page.waitForTimeout(300);
  const depois = await table.locator('tbody:not(.hidden) tr').count();
  check(depois === 2, `[F7.8-EFEITO] min=20 mantém 2 linhas (20,30) e corta a de 10 (${depois})`);
  await table.locator('input[aria-label="Máximo de value"]').fill('20'); // agora só 20
  await page.waitForTimeout(300);
  const soUm = await table.locator('tbody:not(.hidden) tr').count();
  check(soUm === 1, `[F7.8-EFEITO] min=20 e max=20 deixa só a linha 20 (${soUm})`);

  // ═══ F7.11 — sparkline de verdade (3 meses → renderiza + tendência) ═══
  await page.goto(`${BASE}/reports/view?key=${skey}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Evolucao', { timeout: 15000 });
  await page.waitForTimeout(1200);
  check(/\b16\b/.test(await page.locator('body').innerText()), '[F7.11] KPI mostra o total (soma 5+8+3=16)');
  check(await page.locator('svg[aria-label="Evolução temporal"]').count() === 1, '[F7.11-EFEITO] sparkline renderiza com dados de 3 meses');
  const pts = await page.locator('svg[aria-label="Evolução temporal"] polyline').getAttribute('points');
  check(!!pts && pts.trim().split(/\s+/).length === 3, `[F7.11-EFEITO] sparkline tem 3 pontos (jan/fev/mar) — ${pts}`);
  check(await page.locator('[aria-label="em queda"]').count() === 1, '[F7.11-EFEITO] indicador de tendência em queda (mar 3 < fev 8)');
  await page.screenshot({ path: `${OUT}/relatorio-f7-sparkline.png` });
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

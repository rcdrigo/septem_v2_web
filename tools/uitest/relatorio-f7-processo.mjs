// F7.6 — origem processo com as colunas certas: nº, tarefa atual, e botão "Abrir"
// para o relatório do processo. Cria processo + instância (gera tarefa pendente),
// monta relatório por processo com essas colunas, publica e confere no viewer.
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
const pkey = `proc_f7_${rid}`;

const xml = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${rid}" targetNamespace="x">
  <bpmn:process id="P_${rid}" name="Processo F7 ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig status="published" />
      <septem:formSchema>{"type":"default","schemaVersion":17,"components":[{"type":"textfield","key":"nome","label":"Nome"}]}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;
const save = await api(token, '/api/v1/workflow/process-definitions/', 'POST', { key: pkey, bpmnXml: xml });
check(save.status === 201, `[api] processo criado (${save.status})`);
const inst = await api(token, '/api/v1/workflow/instances', 'POST', { key: pkey, data: { nome: 'Fulano' } });
check(inst.status === 201, `[api] instância criada — gera tarefa pendente (${inst.status})`);

const def = { blocks: [{ id: 't', type: 'table', title: 'Processos', columns: [{ key: '_numero' }, { key: '_tarefa_atual' }, { key: '_abrir' }] }] };
const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `Relatório Proc F7 ${rid}`, sourceType: 'process', processKey: pkey, definitionJson: JSON.stringify(def),
});
const key = novo.body.key;
const pub = await api(token, `/api/v1/reports/${key}/publish`, 'POST', {});
check(pub.status === 200, `[api] relatório por processo publicado (${pub.status})`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  await page.goto(`${BASE}/reports/view?key=${key}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Processos', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const table = page.locator('section:has-text("Processos")');
  const txt = await table.innerText();
  check(txt.includes('Analisar'), '[F7.6] coluna "Tarefa atual" mostra a tarefa pendente (Analisar)');
  check(await table.getByRole('button', { name: 'Abrir' }).count() >= 1, '[F7.6] cada linha tem o botão "Abrir" o processo');
  // O botão abre a solicitação em aba própria.
  const opened = await page.evaluate(() => { window.__op = []; const o = window.open.bind(window); window.open = (u) => { window.__op.push(String(u)); return null; }; return true; });
  void opened;
  await table.getByRole('button', { name: 'Abrir' }).first().click();
  await page.waitForTimeout(300);
  const urls = await page.evaluate(() => window.__op || []);
  check(urls.some((u) => u.includes('solicitacao/')), `[F7.6] "Abrir" leva ao relatório do processo (${urls.join(',') || 'nada'})`);
  await page.screenshot({ path: `${OUT}/relatorio-f7-processo.png`, fullPage: false });
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

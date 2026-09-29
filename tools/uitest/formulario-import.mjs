// Fase 4d — Importar formulário via planilha. No MODELADOR: baixar o modelo, subir
// a planilha e SOBRESCREVER o formulário; planilha inválida lista os erros; o botão
// é DESABILITADO quando o processo já tem instâncias. Web 1280 (+ modal no mobile 375).
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (token, path, method = 'GET', body) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;

// Processo MONTADO AQUI, com DI (o bpmn-js não monta sem BPMNDiagram) e formulário NATIVO
// vazio. Copiar a fixture `teste_condicoes_ui` não serve: a matriz de tarefas dela aponta
// para as chaves do formulário ANTIGO e o backend recusa com 422 `native-field-reference`.
const rid = Math.floor(Math.random() * 1e9);
const nativoVazio = JSON.stringify({ format: 'septem-native', schemaVersion: 1, id: `fi_${rid}`,
  tabs: [{ id: `ti_${rid}`, label: 'Principal', groups: [{ id: `gi_${rid}`, label: 'Dados', type: 'group', fields: [] }] }] });
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dimp${rid}" targetNamespace="x">
  <bpmn:process id="PIMP${rid}" name="Import Teste ${rid}" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${nativoVazio}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="SIMP${rid}"><bpmn:outgoing>i1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T005" name="Analisar"><bpmn:incoming>i1</bpmn:incoming><bpmn:outgoing>i2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="EIMP${rid}"><bpmn:incoming>i2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="i1" sourceRef="SIMP${rid}" targetRef="T005" />
    <bpmn:sequenceFlow id="i2" sourceRef="T005" targetRef="EIMP${rid}" />
  </bpmn:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="DIMP${rid}"><bpmndi:BPMNPlane id="PlIMP${rid}" bpmnElement="PIMP${rid}">
    <bpmndi:BPMNShape id="ShS${rid}" bpmnElement="SIMP${rid}"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="150" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="ShT${rid}" bpmnElement="T005"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="240" y="78" width="100" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="ShE${rid}" bpmnElement="EIMP${rid}"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="400" y="100" width="36" height="36" /></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xml });
check(saved.status === 201, `[api] processo com formulário nativo criado (${saved.status})`);
const key = saved.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

// Baixa o modelo (planilha válida) para reenviar como "preenchida".
const tmplResp = await fetch(`${API}/api/v1/workflow/form-import/template`, { headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` } });
const template = Buffer.from(await tmplResp.arrayBuffer());
check(template.length > 0 && tmplResp.headers.get('content-type')?.includes('spreadsheet'), '[api] baixar modelo devolve um .xlsx');

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

const abrirFormulario = async (page) => {
  await page.goto(`${BASE}/flows/edit?key=${key}`, { waitUntil: 'networkidle' });
  // No mobile o canvas BPMN fica oculto (limitação conhecida): basta o elemento existir.
  await page.waitForSelector('[data-element-id="T005"]', { state: 'attached', timeout: 20000 });
  await page.getByRole('button', { name: 'Formulário', exact: true }).click();
  await page.locator('[data-native-editor]').waitFor({ timeout: 40000 });
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);
  await abrirFormulario(page);

  // Sem instâncias → botão Importar HABILITADO.
  // O botão convive com o "Importar JSON" do editor nativo, então o nome ficou explícito.
  check(await page.locator('[data-testid=importar-planilha]').count() > 0, '[web] botão "Importar planilha" habilitado (processo sem instâncias)');
  await page.locator('[data-testid=importar-planilha]').click();
  await page.waitForSelector('[data-testid=import-input]', { state: 'attached', timeout: 8000 });

  // Clicar em "Baixar modelo" de fato dispara o download do .xlsx (exercita o botão).
  const download = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    page.getByRole('button', { name: /Baixar modelo/ }).click(),
  ]).then(([d]) => d).catch(() => null);
  check(!!download && /\.xlsx$/.test(download.suggestedFilename()), '[web] "Baixar modelo" baixa o modelo .xlsx');

  // Planilha INVÁLIDA (bytes que não são xlsx) → lista de erros.
  await page.setInputFiles('[data-testid=import-input]', { name: 'ruim.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('isto nao e uma planilha') });
  await page.waitForSelector('[data-testid=import-erros]', { timeout: 8000 });
  check(await page.locator('[data-testid=import-erros]').count() > 0, '[web] planilha inválida lista os erros');
  await page.screenshot({ path: `${OUT}/import-erros.png`, fullPage: true });

  // Planilha VÁLIDA (o próprio modelo) → sobrescreve o formulário com os campos de exemplo.
  await page.setInputFiles('[data-testid=import-input]', { name: 'modelo.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: template });
  await page.waitForTimeout(2500);
  // O efeito se lê na LISTA do editor nativo (o canvas do form-js não existe mais) — e a
  // planilha tem de virar formulário NATIVO, senão o modelador não abriria o que importou.
  const editor = await page.locator('[data-native-editor]').innerText();
  check(/Nome completo/i.test(editor) && /DADOS DO REQUERENTE/i.test(editor),
    '[web] importar sobrescreve o formulário com os campos da planilha');
  const campos = await page.locator('[data-field-id]').count();
  check(campos >= 2, `[web] os campos da planilha entram como campos nativos (${campos})`);
  await page.screenshot({ path: `${OUT}/import-ok.png`, fullPage: true });
  await ctx.close();

  // ── Modal responsivo no mobile ────────────────────────────────────────────
  const mob = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const mpage = await mob.newPage();
  await login(mpage);
  await abrirFormulario(mpage);
  await mpage.locator('[data-testid=importar-planilha]').click();
  await mpage.waitForSelector('[data-testid=import-input]', { state: 'attached', timeout: 8000 });
  const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!overflow, '[mobile] modal de importação sem overflow horizontal');
  await mob.close();

  // ── Botão DESABILITADO quando há instâncias ───────────────────────────────
  await api(token, '/api/v1/workflow/instances', 'POST', { key, data: {} });
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page2 = await ctx2.newPage();
  await login(page2);
  await abrirFormulario(page2);
  check(await page2.locator('[data-testid=import-btn-disabled]').count() > 0,
    '[web] com instâncias iniciadas, o "Importar planilha" fica desabilitado (não sobrescreve)');
  await page2.screenshot({ path: `${OUT}/import-desabilitado.png`, fullPage: true });
  await ctx2.close();
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

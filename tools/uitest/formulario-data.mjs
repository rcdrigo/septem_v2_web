// Fase 4b — Campo de data: subtipo (data/hora/ambos) e regras de passado/futuro.
// (1) PREENCHIMENTO: o campo "só data" abre datepicker (input type=date); uma data
// no futuro dá erro em vermelho e BLOQUEIA concluir (a regra é do servidor); uma
// data no passado conclui. (2) MODELADOR: um campo Data/Hora tem "Tipo" (Aparência)
// e "Restrição de data" (Validação). Web 1280 + mobile 375.
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

// Processo com um campo de data "só data" que NÃO permite futuro.
const FORM = { components: [{ type: 'datetime', key: 'prazo', label: 'Data do protocolo', properties: { septemDateMode: 'date', septemDateLimit: 'noFuture' } }] };
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="Data UI" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${JSON.stringify(FORM)}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Informar data">
      <bpmn:extensionElements><septem:actionButtons><septem:actionButton id="ok" label="Concluir" /></septem:actionButtons></bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
const key = saved.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

try {
  for (const view of [{ name: 'web', w: 1280, h: 900 }, { name: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);

    const inst = await api(token, '/api/v1/workflow/instances', 'POST', { key, data: {} });
    const taskId = inst.body.tasks[0].id;
    await page.goto(`${BASE}/tarefa/${taskId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input', { timeout: 15000 });
    await page.waitForTimeout(500);

    const campo = page.locator('input').first();
    // "Só data" → input nativo type=date (abre o datepicker ao clicar).
    const tipo = await campo.getAttribute('type');
    check(tipo === 'date', `[${view.name}] campo "só data" usa datepicker (input type=${tipo})`);

    // Data no futuro → erro em vermelho + bloqueia concluir.
    await campo.fill('2099-01-01');
    await page.getByRole('button', { name: 'Concluir' }).click();
    await page.waitForTimeout(500);
    const erro = await page.locator('text=/não pode ser no futuro/i').count();
    check(erro > 0, `[${view.name}] data no futuro mostra erro "não pode ser no futuro"`);
    const aberta = (await api(token, `/api/v1/workflow/tasks/${taskId}`)).status === 200;
    check(aberta, `[${view.name}] data no futuro NÃO concluiu a tarefa`);
    await page.screenshot({ path: `${OUT}/data-futuro-${view.name}.png`, fullPage: true });

    // Data no passado → conclui.
    await campo.fill('2000-01-01');
    await page.getByRole('button', { name: 'Concluir' }).click();
    await page.waitForTimeout(1500);
    const concluiu = await page.locator('text=/conclu/i').count();
    check(concluiu > 0, `[${view.name}] data no passado conclui a tarefa`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!overflow, `[${view.name}] preenchimento sem overflow horizontal`);
    await ctx.close();
  }

  // ── Modelador: adicionar um campo Data/Hora e ver "Tipo" + "Restrição de data" ─
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);
  try {
    await page.goto(`${BASE}/processos/editar?key=teste_condicoes_ui`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
    await page.getByRole('button', { name: 'Formulário', exact: true }).click();
    await page.waitForTimeout(2500);
    // A paleta é de botões: clicar em "Data / Hora" adiciona o campo E já o
    // seleciona, abrindo o painel de config.
    await page.getByRole('button', { name: 'Data / Hora' }).click();
    await page.waitForTimeout(1000);
    await page.locator('button', { hasText: 'Aparência' }).first().click({ timeout: 5000 });
    await page.waitForTimeout(300);
    check(await page.getByText('Tipo', { exact: true }).count() > 0, '[modelador] campo de data tem "Tipo" (data/hora/ambos) na Aparência');
    check(await page.locator('option', { hasText: 'Somente data' }).count() > 0, '[modelador] o "Tipo" oferece Somente data / Somente hora');
    await page.locator('button', { hasText: 'Validação' }).first().click({ timeout: 3000 });
    await page.waitForTimeout(300);
    check(await page.getByText('Restrição de data').count() > 0, '[modelador] campo de data tem "Restrição de data" na Validação');
    check(await page.locator('option', { hasText: /não permitir data no futuro/i }).count() > 0, '[modelador] a restrição oferece passado/futuro');
    await page.screenshot({ path: `${OUT}/data-modelador.png`, fullPage: true });
  } catch (e) {
    check(false, `[modelador] falhou: ${String(e.message).slice(0, 90)}`);
  }
  await ctx.close();
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

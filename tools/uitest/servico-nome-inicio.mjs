// Bug: "Ao iniciar um serviço, exibe o NOME DO PROCESSO em vez do nome da TAREFA de
// início." Causa: start event sem nome → startTaskName nulo → cabeçalho caía no
// processo. Fix (backend): startTaskName cai na 1ª tarefa humana quando o início não
// tem nome. Prova: cria processo com startEvent SEM nome + 1ª tarefa nomeada, publica,
// abre /servico/:key e confere que o H1 é o nome da TAREFA, não do processo.
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
const PROC = `Processo Longo ${rid}`;
const TAREFA = `Preencher pedido ${rid}`;
// startEvent SEM name; 1ª userTask COM name.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="${PROC}" isExecutable="true">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="${TAREFA}"><bpmn:extensionElements><septem:actionButtons><septem:actionButton id="ok" label="Concluir" /></septem:actionButtons></bpmn:extensionElements><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;
const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(saved.status === 201, `[api] processo criado (${saved.status})`);
const key = saved.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

// [api] o form de início devolve startTaskName = nome da tarefa (não do processo).
const form = await api(token, `/api/v1/workflow/process-definitions/${key}/form`);
check(form.body?.startTaskName === TAREFA, `[api] startTaskName = tarefa ("${form.body?.startTaskName}")`);
check(form.body?.processName === PROC, `[api] processName = processo ("${form.body?.processName}")`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
  const page = await (await browser.newContext({ viewport: { width: vp.w, height: vp.h } })).newPage();
  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
    await page.goto(`${BASE}/servico/${key}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 15000 });
    await page.waitForTimeout(600);
    const h1 = (await page.locator('h1').first().innerText()).trim();
    check(h1 === TAREFA, `[${vp.n}] H1 mostra o nome da TAREFA de início ("${h1}")`);
    check(h1 !== PROC, `[${vp.n}] H1 NÃO mostra o nome do processo`);
    if (vp.n === 'web') await page.screenshot({ path: `${OUT}/servico-nome-inicio.png` });
  } finally { await page.context().close(); }
}
await browser.close();
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

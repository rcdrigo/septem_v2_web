// Bug: "Ao iniciar um serviço, exibe o NOME DO PROCESSO em vez do nome da TAREFA de
// início." Causa: start event sem nome → startTaskName nulo → cabeçalho caía no
// processo. Fix (backend): startTaskName cai na 1ª tarefa humana quando o início não
// tem nome. Prova: cria processo com startEvent SEM nome + 1ª tarefa nomeada, publica,
// abre /services/:key e confere que o H1 é o nome da TAREFA, não do processo.
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
// startEvent SEM name; 1ª userTask COM name. Ambas carregam os metadados do header.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="${PROC}" isExecutable="true">
    <bpmn:startEvent id="S"><bpmn:extensionElements><septem:alias value="INIC" /><septem:setor value="Protocolo" /></bpmn:extensionElements><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="${TAREFA}"><bpmn:extensionElements><septem:alias value="ANAL" /><septem:setor value="Análise" /><septem:actionButtons><septem:actionButton id="ok" label="Concluir" /></septem:actionButtons></bpmn:extensionElements><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
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
check(form.body?.startTaskAlias === 'INIC', `[api] startTaskAlias = INIC ("${form.body?.startTaskAlias}")`);
check(form.body?.startTaskSector === 'Protocolo', `[api] startTaskSector = Protocolo ("${form.body?.startTaskSector}")`);

const inst = await api(token, '/api/v1/workflow/instances', 'POST', { key, data: {} });
const taskId = inst.body?.tasks?.[0]?.id;
const taskDetail = await api(token, `/api/v1/workflow/tasks/${taskId}`);
check(taskDetail.body?.alias === 'ANAL', `[api] tarefa comum devolve alias ("${taskDetail.body?.alias}")`);
check(taskDetail.body?.sector === 'Análise', `[api] tarefa comum devolve setor ("${taskDetail.body?.sector}")`);
check(Number(taskDetail.body?.processNumber) > 0, `[api] tarefa comum devolve número (${taskDetail.body?.processNumber})`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
  const page = await (await browser.newContext({ viewport: { width: vp.w, height: vp.h } })).newPage();
  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
    await page.goto(`${BASE}/services/${key}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 15000 });
    await page.waitForTimeout(600);
    const h1 = (await page.locator('h1').first().innerText()).trim();
    check(h1 === `INIC · ${TAREFA} · Protocolo`, `[${vp.n}] H1 mostra sigla + nome da TAREFA de início + setor ("${h1}")`);
    check(h1 !== PROC, `[${vp.n}] H1 NÃO mostra o nome do processo`);
    check(await page.locator('header p', { hasText: new RegExp(`^${PROC}$`) }).count() === 1, `[${vp.n}] mostra processo como texto secundário`);
    check((await page.title()).startsWith(`${TAREFA} ·`), `[${vp.n}] título da aba usa a tarefa inicial`);
    if (vp.n === 'web') await page.screenshot({ path: `${OUT}/servico-nome-inicio.png` });
  } finally { await page.context().close(); }
}

for (const vp of [{ n: 'web-task', w: 1280, h: 900 }, { n: 'mobile-task', w: 375, h: 812 }]) {
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await context.newPage();
  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
    await page.goto(`${BASE}/tasks/${taskId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 15000 });

    check((await page.locator('h1').innerText()).trim() === `ANAL · ${TAREFA} · Análise`, `[${vp.n}] tarefa mostra sigla + nome + setor`);
    check(await page.locator('header p', { hasText: new RegExp(`^${PROC}$`) }).count() === 1, `[${vp.n}] tarefa mostra processo como texto secundário`);
    const numberButton = page.getByRole('button', { name: new RegExp(`processo ${taskDetail.body.processNumber}$`, 'i') });
    check(await numberButton.count() === 1, `[${vp.n}] tarefa mostra número clicável`);

    if (vp.n === 'web-task') {
      const opened = context.waitForEvent('page');
      await numberButton.click();
      const report = await opened;
      await report.waitForLoadState('domcontentloaded');
      check(report.url().includes(`/requests/${taskDetail.body.executionId}`), '[web-task] número abre relatório da execução');
      await report.close();
      check(await page.getByRole('button', { name: 'Salvar', exact: true }).count() === 1, '[web-task] desktop mantém Salvar visível');
    } else {
      check(await page.getByRole('button', { name: 'Concluir', exact: true }).count() === 0, '[mobile-task] ações ficam ocultas antes de abrir a lista');
      await page.getByRole('button', { name: 'Botões de conclusão' }).click();
      check(await page.getByRole('button', { name: 'Concluir', exact: true }).count() === 1, '[mobile-task] lista mostra conclusão');
      check(await page.getByRole('button', { name: 'Salvar', exact: true }).count() === 1, '[mobile-task] lista mostra Salvar');
      check(await page.getByRole('button', { name: 'Cancelar', exact: true }).count() === 1, '[mobile-task] lista mostra Cancelar');
      await page.getByRole('button', { name: 'Voltar ao formulário' }).click();
      check(await page.getByRole('dialog', { name: 'Botões de conclusão' }).count() === 0, '[mobile-task] volta ao formulário');
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!overflow, `[${vp.n}] sem overflow horizontal`);
  } finally { await context.close(); }
}
await browser.close();
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Bug: "Ao SALVAR (rascunho) uma tarefa não deve obrigar o preenchimento; só ao
// CONCLUIR por botão com 'Validar campos' marcado." Fix: saveDraft usa getData() (não
// submit() → não pinta obrigatórios). Prova: tarefa com campo obrigatório vazio —
// Salvar NÃO marca erro (toast "Rascunho salvo"); Concluir MARCA (validação segue).
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
const FORM = { components: [{ type: 'textfield', key: 'obrig', label: 'Campo Obrigatório', validate: { required: true } }] };
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="Salvar Sem Validar ${rid}" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${JSON.stringify(FORM)}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Preencher"><bpmn:extensionElements><septem:actionButtons><septem:actionButton id="ok" label="Concluir" validateForm="true" /></septem:actionButtons></bpmn:extensionElements><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;
const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(saved.status === 201, `[api] processo criado (${saved.status})`);
const key = saved.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });
const inst = await api(token, '/api/v1/workflow/instances', 'POST', { key, data: {} });
check(inst.status === 200 || inst.status === 201, `[api] instância iniciada com dados vazios (${inst.status})`);
const taskId = inst.body?.tasks?.[0]?.id;
check(!!taskId, `[api] tarefa criada (${taskId})`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
  await page.goto(`${BASE}/tasks/${taskId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Campo Obrigatório', { timeout: 15000 });
  await page.waitForTimeout(500);

  // SALVAR sem preencher → NÃO deve pintar "Campo obrigatório"; deve dar "Rascunho salvo".
  // O toast é transiente: espera o SINAL assim que aparece, não um tempo fixo.
  await page.locator('footer button', { hasText: 'Salvar' }).click();
  const toastSalvo = await page.waitForFunction(
    () => document.body.innerText.includes('Rascunho salvo'),
    { timeout: 8000 },
  ).then(() => true).catch(() => false);
  const erroAposSalvar = await page.evaluate(() => document.body.innerText.includes('Campo obrigatório.'));
  check(!erroAposSalvar, '[web] SALVAR não marca campos obrigatórios como erro');
  check(toastSalvo, '[web] SALVAR mostra "Rascunho salvo"');
  await page.waitForTimeout(1500); // deixa o toast sumir antes do próximo passo

  // CONCLUIR sem preencher → a validação SEGUE valendo (bloqueia + avisa).
  await page.locator('footer button', { hasText: 'Concluir' }).click();
  await page.waitForTimeout(1000);
  const bloqueou = await page.evaluate(() =>
    document.body.innerText.includes('Preencha os campos obrigatórios') || document.body.innerText.includes('Campo obrigatório.'));
  check(bloqueou, '[web] CONCLUIR (botão com "Validar campos") ainda exige os obrigatórios');
  await page.screenshot({ path: `${OUT}/salvar-sem-validar.png` });
} finally { await browser.close(); }
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

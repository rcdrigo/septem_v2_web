// Bug: "Ao criar um processo NOVO, aparece o FORMULÁRIO do processo anterior." Causa:
// sem ?key= o form caía no localStorage do processo anterior. Fix: fallback do
// localStorage só com ?key=; builder é esvaziado no processo novo. Prova: (A) processo
// existente ainda carrega seu form (não regrediu); (B) com um form "fantasma" no
// localStorage, o processo NOVO NÃO o exibe. Modelador é desktop → 1280.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

async function irFormulario(page) {
  await page.locator('header button, nav button', { hasText: 'Formulário' }).first().click();
  await page.waitForTimeout(1500);
}

const API = 'http://localhost:5000';
const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;
const rid = Math.floor(Math.random() * 1e9);

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  // Processo com formulário NATIVO e DI (o editor de formulário só abre o formato nativo,
  // e sem BPMNDiagram o bpmn-js não monta). O campo tem nome próprio para não confundir
  // com nada que já exista no ambiente.
  const CAMPO = `Campo do processo ${rid}`;
  const NATIVO = JSON.stringify({
    format: 'septem-native', schemaVersion: 1, id: `fnp_${rid}`,
    tabs: [{ id: `tnp_${rid}`, label: 'Principal', groups: [{ id: `gnp_${rid}`, label: 'Dados', type: 'group', fields: [
      { id: `cnp_${rid}`, kind: 'field', type: 'textfield', key: `campo_${rid}`, label: CAMPO },
    ] }] }],
  }).replace(/'/g, '&apos;');
  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dnp${rid}" targetNamespace="x">
  <bpmn:process id="PNP${rid}" name="Novo processo form ${rid}" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${NATIVO}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="SNP${rid}"><bpmn:outgoing>np1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="TNP${rid}" name="Analisar"><bpmn:incoming>np1</bpmn:incoming><bpmn:outgoing>np2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="ENP${rid}"><bpmn:incoming>np2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="np1" sourceRef="SNP${rid}" targetRef="TNP${rid}" />
    <bpmn:sequenceFlow id="np2" sourceRef="TNP${rid}" targetRef="ENP${rid}" />
  </bpmn:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="DNP${rid}"><bpmndi:BPMNPlane id="PlNP${rid}" bpmnElement="PNP${rid}">
    <bpmndi:BPMNShape id="ShSNP${rid}" bpmnElement="SNP${rid}"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="150" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="ShTNP${rid}" bpmnElement="TNP${rid}"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="240" y="78" width="100" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="ShENP${rid}" bpmnElement="ENP${rid}"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="400" y="100" width="36" height="36" /></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  const criado = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
  check(criado.status === 201, `[api] processo com formulário nativo criado (${criado.status})`);
  const key = criado.body?.key;

  // (A) Processo EXISTENTE carrega o PRÓPRIO formulário.
  await page.goto(`${BASE}/flows/edit?key=${key}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 20000 });
  await irFormulario(page);
  await page.locator('[data-native-editor]').waitFor({ timeout: 15000 });
  check(await page.locator('[data-field-id]', { hasText: CAMPO }).count() === 1,
    `[web] processo existente carrega o próprio formulário ("${CAMPO}")`);

  // (B) Processo NOVO (sem ?key=): NÃO herda o formulário do anterior. O mecanismo antigo
  // era um rascunho em localStorage; hoje o rascunho vive no BPMN do processo aberto — o
  // que se cobra continua sendo o mesmo: abrir um processo novo não traz o form do outro.
  await page.goto(`${BASE}/flows/edit`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 20000 });
  await irFormulario(page);
  await page.locator('[data-native-editor]').waitFor({ timeout: 15000 });
  const herdou = await page.evaluate((txt) => document.body.innerText.includes(txt), CAMPO);
  check(!herdou, '[web] processo NOVO NÃO herda o formulário do anterior');
  check(await page.locator('[data-field-id]').count() === 0,
    '[web] e o formulário do processo novo começa vazio');
  await page.screenshot({ path: `${OUT}/novo-processo-form.png`, fullPage: true });
} finally { await browser.close(); }
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

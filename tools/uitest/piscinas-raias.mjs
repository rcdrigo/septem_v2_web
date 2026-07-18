// Fase 5c — Piscinas e raias no toolbox do modelador.
// O modelador tinha só os 12 elementos de fluxo; agora a paleta oferece "Piscina
// (raias/setores)". As RAIAS saem do context pad padrão do bpmn-js ao selecionar a
// piscina. Este teste exercita a paleta de verdade: cria a piscina, adiciona uma
// raia pelo context pad, Salva, e verifica o EFEITO — participant + lane sobrevivem
// no XML persistido (round-trip pelo backend). A ponte raia→campo Setor já é coberta
// por informacoes-tarefa.mjs (5b). Modelador é desktop (canvas some no mobile) → 1280.
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

// Processo VÁLIDO (start→task→end, com DI) para abrir no modelador. Precisa ser válido
// porque o Salvar (PUT) valida — um diagrama incompleto seria rejeitado e a piscina não
// chegaria a persistir. Isolado (nome único) para não poluir processos seedados.
const rid = Math.floor(Math.random() * 1e9);
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="Piscina ${rid}" isExecutable="true">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T"/>
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Di"><bpmndi:BPMNPlane id="Pl" bpmnElement="P">
    <bpmndi:BPMNShape id="S_di" bpmnElement="S"><dc:Bounds x="230" y="120" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="T_di" bpmnElement="T"><dc:Bounds x="330" y="98" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="E_di" bpmnElement="E"><dc:Bounds x="530" y="120" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint x="266" y="138"/><di:waypoint x="330" y="138"/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="F2_di" bpmnElement="F2"><di:waypoint x="430" y="138"/><di:waypoint x="530" y="138"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
if (saved.status !== 201) { console.log('✗ setup: POST do processo válido falhou', saved.status, JSON.stringify(saved.body)); process.exit(1); }
const key = saved.body.key;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  // Abre o processo válido recém-criado (key conhecida → round-trip determinístico).
  await page.goto(`${BASE}/processos/editar?key=${key}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 15000 });
  await page.waitForSelector('[data-element-id="T"]', { timeout: 15000 });
  await page.waitForTimeout(1200);

  // (1) A paleta oferece a piscina.
  const poolEntry = page.locator('.djs-palette [title="Piscina (raias/setores)"]');
  check((await poolEntry.count()) > 0, '[web] a paleta do modelador tem a entrada "Piscina (raias/setores)"');

  // (2) Cria a piscina: clica na entrada (entra em modo create) e clica numa área vazia
  // ABAIXO do fluxo existente para posicionar. bpmn-js envolve o processo numa colaboração.
  const canvas = page.locator('.djs-container svg').first();
  const cbox = await canvas.boundingBox();
  await poolEntry.click();
  await page.waitForTimeout(300);
  await page.mouse.move(cbox.x + cbox.width * 0.45, cbox.y + cbox.height * 0.72);
  await page.mouse.click(cbox.x + cbox.width * 0.45, cbox.y + cbox.height * 0.72);
  await page.waitForTimeout(1000);

  const temPool = await page.locator('.djs-element[data-element-id^="Participant"]').count();
  check(temPool > 0, `[web] clicar na paleta cria uma piscina no canvas (${temPool})`);

  // (3) Adicionar uma raia pelo context pad padrão (aparece ao selecionar a piscina).
  const pool = page.locator('.djs-element[data-element-id^="Participant"]').first();
  await pool.click();
  await page.waitForTimeout(500);
  await page.waitForSelector('.djs-context-pad [data-action="lane-insert-below"]', { timeout: 5000 });
  const addLane = page.locator('.djs-context-pad [data-action="lane-insert-below"]');
  check((await addLane.count()) > 0, '[web] o context pad da piscina oferece "adicionar raia"');
  await addLane.click();
  await page.waitForTimeout(1000);

  // (4) Salvar (PUT na mesma key) e provar o EFEITO: participant + lane no XML persistido.
  await page.locator('header button', { hasText: 'Salvar' }).first().click();
  await page.waitForTimeout(3500);

  const det = await api(token, `/api/v1/workflow/process-definitions/${key}`);
  const x = det.body.bpmnXml || '';
  check(/:participant\b/i.test(x), '[web] round-trip: a PISCINA (participant) sobrevive ao Salvar');
  check(/:lane\b/i.test(x), '[web] round-trip: a RAIA (lane) sobrevive ao Salvar');
  await page.screenshot({ path: `${OUT}/piscinas-raias.png`, fullPage: true });
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

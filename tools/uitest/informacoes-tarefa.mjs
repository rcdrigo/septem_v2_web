// Informações gerais da tarefa e do início: Sigla (era "Apelido") como 1º campo,
// Nome como 2º e Setor pesquisável com as raias. Testa ordem, rename e round-trip.
// Modelador é desktop (canvas some no mobile) → web 1280.
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

// Processo COM duas raias (Financeiro / Jurídico) e uma tarefa, com diagrama.
const rid = Math.floor(Math.random() * 1e9);
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="Info Tarefa ${rid}" isExecutable="true">
    <bpmn:laneSet id="LS">
      <bpmn:lane id="LFin" name="Financeiro"><bpmn:flowNodeRef>T</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="LJur" name="Jurídico"><bpmn:flowNodeRef>S</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T"/>
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Di"><bpmndi:BPMNPlane id="Pl" bpmnElement="P">
    <bpmndi:BPMNShape id="LFin_di" bpmnElement="LFin" isHorizontal="true"><dc:Bounds x="180" y="80" width="500" height="120"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="LJur_di" bpmnElement="LJur" isHorizontal="true"><dc:Bounds x="180" y="200" width="500" height="120"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="S_di" bpmnElement="S"><dc:Bounds x="230" y="242" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="T_di" bpmnElement="T"><dc:Bounds x="330" y="100" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="E_di" bpmnElement="E"><dc:Bounds x="530" y="122" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint x="266" y="260"/><di:waypoint x="330" y="140"/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="F2_di" bpmnElement="F2"><di:waypoint x="430" y="140"/><di:waypoint x="530" y="140"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(saved.status === 201, `[api] processo com raias é aceito (${saved.status})`);
const key = saved.body.key;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  await page.goto(`${BASE}/processos/editar?key=${key}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  // Seleciona a tarefa (clique no centro do shape).
  const box = await page.locator('[data-element-id="T"]').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1000);

  // Ordem e rename (os rótulos vêm MAIÚSCULOS por CSS → checar minúsculo).
  const secTxt = (await page.locator('text=Informações gerais').first().locator('xpath=ancestor::section[1]').innerText().catch(() => '')).toLowerCase();
  const iSigla = secTxt.indexOf('sigla'), iNome = secTxt.indexOf('nome'), iSetor = secTxt.indexOf('setor');
  check(iSigla >= 0 && iNome > iSigla && iSetor > iNome, `[web] ordem Sigla → Nome → Setor (${iSigla},${iNome},${iSetor})`);
  check(!secTxt.includes('apelido'), '[web] "Apelido" foi renomeado para "Sigla"');

  // Setor: o dropdown lista as raias do processo. Escopa às OPÇÕES do dropdown
  // (ul li button) — os rótulos das raias no canvas são SVG, não confundem.
  const setorBtn = page.locator('label:has-text("Setor")').locator('xpath=..').locator('button').first();
  await setorBtn.click();
  await page.waitForSelector('input[placeholder="Pesquisar…"]', { timeout: 5000 });
  const temFin = await page.locator('ul li button', { hasText: 'Financeiro' }).count();
  const temJur = await page.locator('ul li button', { hasText: 'Jurídico' }).count();
  check(temFin > 0 && temJur > 0, '[web] o Setor lista as raias do processo (Financeiro, Jurídico)');

  // Seleciona Financeiro + preenche a Sigla, e SALVA.
  await page.locator('ul li button', { hasText: 'Financeiro' }).last().click();
  await page.waitForTimeout(300);
  const siglaInput = page.locator('label:has-text("Sigla")').locator('xpath=..').locator('input').first();
  await siglaInput.fill('analise_fin');
  await siglaInput.blur();
  await page.waitForTimeout(300);
  await page.locator('header button', { hasText: 'Salvar' }).first().click();
  await page.waitForTimeout(3000);

  // ROUND-TRIP: Sigla e Setor sobrevivem no schema persistido (efeito, não só a tela).
  const det = await api(token, `/api/v1/workflow/process-definitions/${key}`);
  const x = det.body.bpmnXml || '';
  check(/value="Financeiro"/.test(x), '[web] round-trip: o Setor (Financeiro) sobrevive ao Salvar');
  check(/value="analise_fin"/.test(x), '[web] round-trip: a Sigla sobrevive ao Salvar');
  await page.screenshot({ path: `${OUT}/info-tarefa.png`, fullPage: true });

  // O Início usa a mesma seção e também deve permitir configurar o Setor.
  const bs = await page.locator('[data-element-id="S"]').boundingBox();
  await page.mouse.click(bs.x + bs.width / 2, bs.y + bs.height / 2);
  await page.waitForTimeout(700);
  const inicio = (await page.locator('text=Informações gerais').first().locator('xpath=ancestor::section[1]').innerText().catch(() => '')).toLowerCase();
  check(inicio.includes('sigla') && inicio.includes('nome'), '[web] início ainda mostra Sigla/Nome (seção não quebra)');
  check(inicio.includes('setor'), '[web] Setor também aparece na tarefa de início');

  const setorInicioBtn = page.locator('label:has-text("Setor")').locator('xpath=..').locator('button').first();
  await setorInicioBtn.click();
  await page.waitForSelector('input[placeholder="Pesquisar…"]', { timeout: 5000 });
  await page.locator('ul li button', { hasText: 'Jurídico' }).last().click();
  await page.waitForTimeout(300);
  await page.locator('header button', { hasText: 'Salvar' }).first().click();
  await page.waitForTimeout(3000);
  const detInicio = await api(token, `/api/v1/workflow/process-definitions/${key}`);
  const xmlInicio = detInicio.body.bpmnXml || '';
  const startBlock = xmlInicio.match(/<bpmn:startEvent\b[\s\S]*?<\/bpmn:startEvent>/i)?.[0] ?? '';
  check(/septem:setor\b[^>]*value="Jurídico"/i.test(startBlock), '[web] round-trip: o Setor do início sobrevive ao Salvar');

  // Processo SEM raias → o Setor mostra o estado vazio.
  await page.goto(`${BASE}/processos/editar?key=teste_condicoes_ui`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
  await page.locator('[data-element-id="T005"]').click();
  await page.waitForTimeout(800);
  const semRaia = (await page.locator('text=Informações gerais').first().locator('xpath=ancestor::section[1]').innerText().catch(() => '')).toLowerCase();
  check(semRaia.includes('nenhuma raia'), '[web] tarefa sem raias mostra "Nenhuma raia no processo ainda"');
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });
// pior caso: browser limpo, sem localStorage de forms anteriores
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

// Processo com formulário NATIVO e DI: o editor de formulário só assume o formato nativo
// (decisão de produto) e o bpmn-js precisa do BPMNDiagram para montar.
const API = 'http://localhost:5000';
const api = async (t, pth, m = 'GET', b) => {
  const r = await fetch(API + pth, { method: m, headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const rid = Math.floor(Math.random() * 1e9);
const CAMPOS = [`Nome do requisitante ${rid}`, `Saldo de empenho ${rid}`];
const NATIVO = JSON.stringify({
  format: 'septem-native', schemaVersion: 1, id: `ft_${rid}`,
  tabs: [{ id: `ftt_${rid}`, label: 'Principal', groups: [{ id: `ftg_${rid}`, label: 'Dados', type: 'group', fields: [
    { id: `fta_${rid}`, kind: 'field', type: 'textfield', key: `nome_${rid}`, label: CAMPOS[0] },
    { id: `ftb_${rid}`, kind: 'field', type: 'number', key: `saldo_${rid}`, label: CAMPOS[1] },
  ] }] }],
}).replace(/'/g, '&apos;');
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dft${rid}" targetNamespace="x">
  <bpmn:process id="PFT${rid}" name="Formulario aba ${rid}" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${NATIVO}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="SFT${rid}"><bpmn:outgoing>ft1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="TFT${rid}" name="Analisar"><bpmn:incoming>ft1</bpmn:incoming><bpmn:outgoing>ft2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="EFT${rid}"><bpmn:incoming>ft2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="ft1" sourceRef="SFT${rid}" targetRef="TFT${rid}" />
    <bpmn:sequenceFlow id="ft2" sourceRef="TFT${rid}" targetRef="EFT${rid}" />
  </bpmn:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="DFT${rid}"><bpmndi:BPMNPlane id="PlFT${rid}" bpmnElement="PFT${rid}">
    <bpmndi:BPMNShape id="ShSFT${rid}" bpmnElement="SFT${rid}"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="150" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="ShTFT${rid}" bpmnElement="TFT${rid}"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="240" y="78" width="100" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="ShEFT${rid}" bpmnElement="EFT${rid}"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="400" y="100" width="36" height="36" /></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
const criado = await api(auth.accessToken, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(criado.status === 201, `processo com formulário nativo criado (${criado.status})`);

await page.goto(`http://localhost:5173/flows/edit?key=${criado.body?.key}`, { waitUntil: 'networkidle' });
await page.waitForSelector('.djs-palette', { timeout: 20000 });
await page.waitForTimeout(1000);
// vai direto para a aba Formulário
await page.getByRole('button', { name: 'Formulário', exact: true }).click();
await page.locator('[data-native-editor]').waitFor({ timeout: 15000 });
await page.screenshot({ path: `${OUT}/formulario-tab.png`, fullPage: false });

const state = await page.evaluate((campos) => {
  const text = document.body.innerText;
  return {
    vazio: !document.querySelector('[data-field-id]'),
    temCampos: campos.every((f) => text.includes(f)),
    removidos: text.includes('Limpar formulário') || text.includes('Modelo com agrupamento'),
    mantidos: text.includes('Prévia') && text.includes('Máscaras'),
  };
}, CAMPOS);
check(!state.vazio, 'a aba Formulário abre com os campos do processo (não vazia)');
check(state.temCampos, 'os campos do formulário aparecem na lista do editor');
check(!state.removidos, 'botões "Limpar formulário" e "Modelo com agrupamento" continuam fora');
// "Empilhados/Abas" saiu de propósito: o formulário nativo é sempre em abas, não há
// layout a escolher. O que se cobra é o que restou no cabeçalho.
check(state.mantidos, 'Prévia e Máscaras mantidos no cabeçalho');
console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

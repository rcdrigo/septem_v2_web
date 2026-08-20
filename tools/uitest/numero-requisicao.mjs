// Fase 2.1 (requisitos 2026-08-03): "o sequencial de execução dos processos deve
// começar com 3 dígitos: 100, 101, 102...", com renumeração do histórico.
//
// O teste de backend prova o PISO. Esta suíte prova o que o usuário vê:
//  (a) o número que a API atribuiu é o MESMO que aparece na tela (relatório e
//      cabeçalho da tarefa) — comparação com o valor, não "existe um número";
//  (b) o número tem 3 dígitos;
//  (c) a busca global por esse número ACHA a requisição — a renumeração reescreveu
//      a coluna que a busca usa, então é aqui que um efeito colateral apareceria;
//  (d) nenhuma requisição do tenant ficou abaixo de 100 depois da renumeração.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const token = (await api(null, '/api/v1/auth/login', 'POST',
  { identifier: 'admin@prefeitura-x.local', password: 'admin123' })).body.accessToken;

const rid = Math.floor(Math.random() * 1e9);
const NOME = `Numeracao ${rid}`;
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dnum" targetNamespace="x">
  <bpmn:process id="Pnum" name="${NOME}" isExecutable="true">
    <bpmn:startEvent id="Snum"><bpmn:outgoing>F1num</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T1num" name="Conferir numeracao ${rid}">
      <bpmn:incoming>F1num</bpmn:incoming><bpmn:outgoing>F2num</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="Enum"><bpmn:incoming>F2num</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1num" sourceRef="Snum" targetRef="T1num" />
    <bpmn:sequenceFlow id="F2num" sourceRef="T1num" targetRef="Enum" />
  </bpmn:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Dnum">
    <bpmndi:BPMNPlane id="Plnum" bpmnElement="Pnum" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const salvo = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(salvo.status < 300, `[setup] processo publicado (${salvo.status})`);
const key = salvo.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

// Inicia pela API e guarda o número que o SISTEMA atribuiu — é contra ele que a
// tela vai ser comparada. Escrever um número esperado à mão tornaria o teste
// dependente do estado do banco.
const iniciada = await api(token, '/api/v1/workflow/instances', 'POST', { key, data: {} });
check(iniciada.status < 300, `[setup] requisição iniciada (${iniciada.status})`);
const executionId = iniciada.body.executionId;
const taskId = iniciada.body.tasks?.[0]?.id;

const detalhe = await api(token, `/api/v1/workflow/instances/${executionId}`);
const numero = detalhe.body?.number;
check(Number.isInteger(numero) && numero >= 100,
  `[api] o número nasce com 3 dígitos (${numero})`);

// (d) Depois da renumeração, nenhuma requisição do tenant pode estar abaixo de 100.
const pagina1 = await api(token, '/api/v1/workflow/instances?page=1&pageSize=50');
const ultima = Math.ceil(pagina1.body.total / 50);
const fim = await api(token, `/api/v1/workflow/instances?page=${ultima}&pageSize=50`);
const menor = Math.min(...(fim.body.items ?? []).map((i) => i.number));
check(menor >= 100, `[api] o menor número do tenant é >= 100 depois da renumeração (${menor})`);

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20000 });

    // (a) Relatório da requisição: o número da tela tem de ser o número da API.
    await page.goto(`${BASE}/requests/${executionId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const textoRelatorio = await page.evaluate(() => document.body.innerText);
    check(textoRelatorio.includes(String(numero)),
      `[${vp.n}] o relatório exibe o número ${numero} atribuído pelo sistema`);

    // (b) Cabeçalho da tarefa: mesmo número.
    if (taskId) {
      await page.goto(`${BASE}/tasks/${taskId}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('header', { timeout: 15000 });
      await page.waitForTimeout(800);
      const cabecalho = await page.locator('header').first().innerText();
      check(cabecalho.includes(String(numero)),
        `[${vp.n}] o cabeçalho da tarefa exibe #${numero} (veio "${cabecalho.replace(/\n/g, ' | ').slice(0, 70)}")`);
    }

    const L = await page.evaluate(() => {
      const doc = document.documentElement;
      const clipped = [...document.querySelectorAll('button, input, a')].filter((el) => {
        if (el.closest('aside')) return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
      }).length;
      return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
    });
    check(!L.overflows, `[${vp.n}] tela da tarefa sem overflow horizontal`);
    check(L.clipped === 0, `[${vp.n}] tela da tarefa sem controle recortado (${L.clipped})`);
    await page.screenshot({ path: `${OUT}/numero-requisicao-${vp.n}.png`, fullPage: true });

    // (c) Busca global pelo número — a renumeração reescreveu a coluna que ela usa.
    if (vp.n === 'web') {
      await page.goto(BASE + '/tasks', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Buscar no Septem/i }).first().click();
      await page.locator('[role=dialog] input').first().fill(String(numero));
      await page.waitForTimeout(1500);
      const achou = await page.locator('[role=dialog]').innerText();
      check(achou.includes(String(numero)),
        `[web] a busca global acha a requisição pelo número ${numero} depois da renumeração`);
    }
    await ctx.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

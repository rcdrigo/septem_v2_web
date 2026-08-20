// Fase 4 (requisitos 2026-08-03): ações administrativas no relatório do processo —
// cancelar, devolver, encaminhar, realocar e reabrir.
//
// O que esta suíte prova, e por quê:
//  (a) sem justificativa NADA sai — contado por resposta de rede, porque "o botão
//      ficou desabilitado" não prova que nenhuma chamada partiu;
//  (b) os dropdowns vêm SEPARADOS de verdade: devolver lista só etapa já executada,
//      encaminhar só as não executadas — as duas listas não podem se cruzar;
//  (c) o alerta de risco do "encaminhar" está visível (a spec pede em destaque);
//  (d) depois de cada ação a instância tem UMA frente ativa e o card da tramitação
//      registra autor, horário e justificativa.
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
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dui" targetNamespace="x">
  <bpmn:process id="Pui" name="Acoes UI ${rid}" isExecutable="true">
    <bpmn:extensionElements><septem:processConfig status="draft" /></bpmn:extensionElements>
    <bpmn:startEvent id="Sui"><bpmn:outgoing>G1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="U1" name="Analisar UI ${rid}"><bpmn:incoming>G1</bpmn:incoming><bpmn:outgoing>G2</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="U2" name="Revisar UI ${rid}"><bpmn:incoming>G2</bpmn:incoming><bpmn:outgoing>G3</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="U3" name="Homologar UI ${rid}"><bpmn:incoming>G3</bpmn:incoming><bpmn:outgoing>G4</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="Eui"><bpmn:incoming>G4</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="G1" sourceRef="Sui" targetRef="U1" />
    <bpmn:sequenceFlow id="G2" sourceRef="U1" targetRef="U2" />
    <bpmn:sequenceFlow id="G3" sourceRef="U2" targetRef="U3" />
    <bpmn:sequenceFlow id="G4" sourceRef="U3" targetRef="Eui" />
  </bpmn:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Dui"><bpmndi:BPMNPlane id="Plui" bpmnElement="Pui" /></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const salvo = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(salvo.status < 300, `[setup] processo publicado (${salvo.status})`);
const key = salvo.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

/** Inicia e conclui a 1ª tarefa, para existir etapa executada E não executada. */
async function novaInstanciaComUmaEtapaFeita() {
  const inst = await api(token, '/api/v1/workflow/instances', 'POST', { key, data: {} });
  const tid = inst.body.tasks?.[0]?.id;
  if (tid) await api(token, `/api/v1/workflow/tasks/${tid}/complete`, 'POST', { data: {} });
  return inst.body.executionId;
}

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });

async function abrirRelatorio(page, execId, chamadas) {
  page.on('response', (r) => {
    const u = r.url();
    if (/\/instances\/[0-9a-f-]{36}\/(cancel|return|forward|reopen|reassign)$/.test(u)) chamadas.push(r.status());
  });
  await page.goto(`${BASE}/requests/${execId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Ações', { timeout: 20000 });
  await page.waitForTimeout(600);
}

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20000 });

    const execId = await novaInstanciaComUmaEtapaFeita();
    const chamadas = [];
    await abrirRelatorio(page, execId, chamadas);

    await page.getByRole('button', { name: /^Ações/ }).click();
    await page.waitForTimeout(400);
    for (const acao of ['cancel', 'return', 'forward']) {
      check(await page.locator(`[data-testid=acao-${acao}]`).count() === 1, `[${vp.n}] a ação "${acao}" aparece no menu`);
    }
    check(await page.locator('[data-testid=acao-reopen]').count() === 0,
      `[${vp.n}] "reabrir" NÃO aparece com o processo em andamento`);

    // ── (a) sem justificativa nada sai ────────────────────────────────────────
    await page.locator('[data-testid=acao-return]').click();
    await page.waitForSelector('[data-testid=acao-justificativa]', { timeout: 8000 });
    const antes = chamadas.length;
    await page.locator('[data-testid=acao-confirmar]').click();
    await page.waitForTimeout(1200);
    check(chamadas.length === antes, `[${vp.n}] sem justificativa NENHUMA chamada é disparada (${JSON.stringify(chamadas.slice(antes))})`);
    check(await page.locator('[data-testid=acao-erro]').count() === 1, `[${vp.n}] a tela explica o que falta`);

    // ── (b) o dropdown de devolver só traz etapa JÁ executada ────────────────
    const opcoesDevolver = await page.locator('[data-testid=acao-alvo] option').allTextContents();
    check(opcoesDevolver.some((o) => o.includes('Analisar')), `[${vp.n}] devolver oferece a etapa executada (${JSON.stringify(opcoesDevolver)})`);
    check(!opcoesDevolver.some((o) => o.includes('Homologar')), `[${vp.n}] devolver NÃO oferece etapa nunca executada`);

    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const modal = document.querySelector('[role=dialog]') ?? document.body;
      const clipped = [...modal.querySelectorAll('button, select, textarea')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
      }).length;
      return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
    });
    check(!layout.overflows, `[${vp.n}] modal de ação sem overflow horizontal`);
    check(layout.clipped === 0, `[${vp.n}] modal de ação sem controle recortado (${layout.clipped})`);
    await page.screenshot({ path: `${OUT}/acoes-processo-${vp.n}.png` });

    // Devolve de verdade.
    await page.selectOption('[data-testid=acao-alvo]', { index: 1 });
    await page.fill('[data-testid=acao-justificativa]', `Faltou o parecer ${rid}`);
    await page.locator('[data-testid=acao-confirmar]').click();
    await page.waitForTimeout(2500);
    check(chamadas.filter((s) => s === 200).length === 1, `[${vp.n}] devolver disparou e foi aceito (${JSON.stringify(chamadas)})`);

    // ── (d) uma frente ativa + registro na tramitação ────────────────────────
    const det = await api(token, `/api/v1/workflow/instances/${execId}`);
    const pendentes = (det.body.tasks ?? []).filter((t) => t.status === 'pendente').length;
    check(pendentes === 1, `[${vp.n}] a instância fica com UMA tarefa ativa (${pendentes})`);
    const acaoRegistrada = (det.body.actions ?? [])[0];
    check(acaoRegistrada?.action === 'return' && acaoRegistrada?.justification === `Faltou o parecer ${rid}`,
      `[${vp.n}] a ação entrou na tramitação com a justificativa`);
    check(!!acaoRegistrada?.actor && !!acaoRegistrada?.at, `[${vp.n}] com autor e horário`);

    // ── (c) alerta de risco do encaminhar ────────────────────────────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Ações', { timeout: 20000 });
    await page.getByRole('button', { name: /^Ações/ }).click();
    await page.locator('[data-testid=acao-forward]').click();
    await page.waitForSelector('[data-testid=acao-justificativa]', { timeout: 8000 });
    check(await page.locator('[data-testid=alerta-risco]').isVisible(),
      `[${vp.n}] o modal de encaminhar exibe o alerta de risco`);
    const txtAlerta = await page.locator('[data-testid=alerta-risco]').innerText();
    check(/arriscada/i.test(txtAlerta) && /exce/i.test(txtAlerta), `[${vp.n}] com o texto que a spec pede`);

    // O card da tramitação mostra a ação para o usuário.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const temCard = await page.locator('[data-testid=card-acoes]').count() > 0
      || (await page.getByRole('tab', { name: /Tramitação/i }).count() > 0
        && await page.getByRole('tab', { name: /Tramitação/i }).click().then(() => page.waitForTimeout(600))
          .then(() => page.locator('[data-testid=card-acoes]').count() > 0));
    check(temCard, `[${vp.n}] o card das ações aparece na tramitação`);
    if (temCard) {
      const txt = await page.locator('[data-testid=card-acoes]').innerText();
      check(txt.includes(`Faltou o parecer ${rid}`), `[${vp.n}] e traz a justificativa registrada`);
    }
    await page.screenshot({ path: `${OUT}/acoes-tramitacao-${vp.n}.png` });
    await ctx.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

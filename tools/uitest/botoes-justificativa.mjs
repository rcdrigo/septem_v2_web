// Fase 5a — Botões de conclusão: obrigar justificativa + paleta de cores.
// RUNTIME (efeito): um botão com "Obrigar justificativa" abre a área de texto ao
// concluir; Confirmar fica desabilitado sem texto; com texto conclui e a justificativa
// aparece na tramitação. MODELADOR: paleta de 10 cores + checkbox de justificativa.
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

// Processo com um botão que exige justificativa.
const XML = `<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="Justif UI ${Math.floor(Math.random() * 1e9)}" isExecutable="true">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar">
      <bpmn:extensionElements><septem:actionButtons><septem:actionButton id="reprovar" label="Reprovar" needsReason="true" primaryColor="#b91c1c" /></septem:actionButtons></bpmn:extensionElements>
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
    // No mobile os botões de conclusão ficam atrás do acionador "Botões de conclusão".
    const trigger = page.getByRole('button', { name: 'Botões de conclusão' });
    await page.waitForTimeout(800);
    if (await trigger.isVisible().catch(() => false)) await trigger.click();
    await page.getByRole('button', { name: 'Reprovar' }).waitFor({ timeout: 15000 });

    // Clicar no botão abre a área de justificativa (não conclui direto).
    await page.getByRole('button', { name: 'Reprovar' }).click();
    await page.waitForSelector('[data-testid=justify-text]', { timeout: 8000 });
    check(true, `[${view.name}] botão com justificativa abre a área de texto`);

    // Confirmar desabilitado sem texto.
    const desabilitado = await page.locator('[data-testid=justify-confirm]').isDisabled();
    check(desabilitado, `[${view.name}] Confirmar fica desabilitado sem justificativa`);

    // Digita e confirma → conclui.
    await page.fill('[data-testid=justify-text]', 'Documentação incompleta.');
    await page.locator('[data-testid=justify-confirm]').click();
    await page.waitForTimeout(1500);
    check(await page.locator('text=/conclu/i').count() > 0, `[${view.name}] conclui após confirmar a justificativa`);

    // A justificativa foi registrada (efeito, não só a tela).
    const det = await api(token, `/api/v1/workflow/instances/${inst.body.executionId}`);
    const reg = JSON.stringify(det.body?.tasks ?? '').includes('Documentação incompleta.');
    check(reg, `[${view.name}] a justificativa fica registrada na tarefa (tramitação)`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!overflow, `[${view.name}] sem overflow horizontal`);
    await page.screenshot({ path: `${OUT}/justif-${view.name}.png`, fullPage: true });
    await ctx.close();
  }

  // ── Modelador: ROUND-TRIP — configurar na tela, Salvar, e a prop persistir ──
  // Processo próprio (cópia com nome único) pra não alterar o teste_condicoes_ui.
  const orig = await api(token, '/api/v1/workflow/process-definitions/teste_condicoes_ui');
  const nome = `Justif RT ${Math.floor(Math.random() * 1e9)}`;
  const copiaXml = orig.body.bpmnXml.replace(/(<bpmn:process\b[^>]*\bname=")[^"]*(")/, `$1${nome}$2`);
  const rt = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: copiaXml });
  const rtKey = rt.body.key;

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);
  try {
    await page.goto(`${BASE}/processos/editar?key=${rtKey}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-element-id="T005"]', { state: 'attached', timeout: 20000 });
    await page.locator('[data-element-id="T005"]').click();
    await page.waitForTimeout(800);
    const sec = page.locator('text=Botões de ação').first();
    if (await sec.count()) { await sec.click().catch(() => {}); await page.waitForTimeout(500); }
    check(await page.locator('[data-testid=cor-swatch]').count() === 0, '[modelador] paleta fica oculta antes de abrir');
    await page.locator('[data-testid=cor-primaria-trigger]').click();
    check(await page.locator('[data-testid=cor-swatch]').count() === 10, '[modelador] floating container tem 10 cores sóbrias');
    check(await page.locator('input[type=color][aria-label="Cor personalizada"]').count() === 1, '[modelador] floating container oferece color picker');
    check(await page.getByRole('switch', { name: 'Obrigar justificativa' }).count() === 1, '[modelador] existe o switch "Obrigar justificativa"');

    // Configura na tela: escolhe a cor vermelha (#b91c1c) e marca justificativa.
    await page.locator('[data-testid=cor-swatch]').nth(8).click();
    await page.waitForTimeout(300);
    // O <Switch> tem input sr-only (clique interceptado) — aciona pelo <label> ancestral.
    await page.getByRole('switch', { name: 'Obrigar justificativa' }).locator('xpath=ancestor::label[1]').click();
    await page.waitForTimeout(300);
    await page.locator('header button', { hasText: 'Salvar' }).first().click();
    await page.waitForTimeout(3000);

    // EFEITO: as props sobrevivem ao Salvar no schema persistido (não só a tela).
    const det = await api(token, `/api/v1/workflow/process-definitions/${rtKey}`);
    const x = det.body.bpmnXml || '';
    check(/needsReason="true"/.test(x), '[modelador] round-trip: "Obrigar justificativa" sobrevive ao Salvar');
    check(/primaryColor="#b91c1c"/i.test(x), '[modelador] round-trip: a cor da paleta sobrevive ao Salvar');
    await page.screenshot({ path: `${OUT}/justif-modelador.png`, fullPage: true });
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

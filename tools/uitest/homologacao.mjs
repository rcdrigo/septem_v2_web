/**
 * Salvar um processo PUBLICADO não muda o que está no ar — e onde se homologa agora.
 *
 * ⚠️ Esta suíte era da Fase 5 (requisitos 2026-08-03), quando salvar um publicado criava uma
 * versão de **homologação** testável na simulação. A **Fase 15 do plano 26_09 (decisão Q18)**
 * aposentou essa versão: existe ambiente de homologação de verdade, e o save passa a criar
 * **rascunho**. A suíte foi REESCRITA, não apagada — a garantia que a Fase 5 conquistou é a que
 * mais importa e continua valendo:
 *
 *   ⭐ depois de salvar, o serviço aberto NORMALMENTE ainda serve o formulário ANTIGO.
 *
 * Antes da Fase 5 isso ia direto para produção: o campo novo aparecia na hora para o cidadão.
 *
 * Asserção pelo CONTEÚDO do campo, nunca por "a tela abriu" — abrir o formulário errado também
 * abre.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
// Imprime NA HORA: quando a sonda estoura no meio, um `check` que só imprime no fim leva o
// diagnóstico com ele — foi o que aconteceu na primeira execução desta reescrita.
let falhas = 0;
const check = (c, m) => {
  if (!c) falhas++;
  console.log(`${c ? '✓' : '✗ FALHOU'} ${m}`);
};

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
const ROTULO_ANTIGO = `Campo antigo ${rid}`;
const ROTULO_NOVO = `Campo novo ${rid}`;

const xml = (rotulo, status = 'draft') => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dh${rid}" targetNamespace="x">
  <bpmn:process id="Ph_${rid}" name="Homolog UI ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig status="${status}" />
      <septem:formSchema>{"type":"default","schemaVersion":17,"components":[{"type":"textfield","key":"campo","label":"${rotulo}"}]}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Sh"><bpmn:outgoing>Fh</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Th" name="Analisar"><bpmn:incoming>Fh</bpmn:incoming><bpmn:outgoing>Fh2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="Eh"><bpmn:incoming>Fh2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Fh" sourceRef="Sh" targetRef="Th" />
    <bpmn:sequenceFlow id="Fh2" sourceRef="Th" targetRef="Eh" />
  </bpmn:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Dh">
    <bpmndi:BPMNPlane id="Plh" bpmnElement="Ph_${rid}" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// ── (a) setup: publica com o campo antigo e salva com o novo ──────────────────
const salvo = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xml(ROTULO_ANTIGO) });
check(salvo.status < 300, `[setup] processo criado (${salvo.status})`);
const key = salvo.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

const depoisDoSave = await api(token, `/api/v1/workflow/process-definitions/${key}`, 'PUT', { bpmnXml: xml(ROTULO_NOVO) });
check(depoisDoSave.body?.status === 'draft',
  `[setup] salvar um publicado cria RASCUNHO, não homologação (${depoisDoSave.body?.status})`);

const textoCarregado = (t) => /Campo (antigo|novo)/.test(t);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[name=identifier]', { timeout: 60000 });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20000 });

    // ── (b) ⭐ Produção INTOCADA: o serviço normal ainda serve o campo antigo ──
    await page.goto(`${BASE}/services/${key}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=iniciar-como-teste]', { timeout: 20000 });
    await page.waitForTimeout(800);
    const producao = await page.locator('main').innerText();
    check(textoCarregado(producao), `[${vp.n}] o formulário do serviço carregou (pré-condição das asserções)`);
    check(producao.includes(ROTULO_ANTIGO),
      `[${vp.n}] ⭐ depois de salvar, produção ainda serve o campo ANTIGO`);
    check(textoCarregado(producao) && !producao.includes(ROTULO_NOVO),
      `[${vp.n}] e NÃO serve o campo novo (que está no rascunho)`);

    // ── (c) A escolha de versão SUMIU, e a tela diz onde homologar ─────────────
    await page.locator('[data-testid=iniciar-como-teste]').check();
    await page.waitForTimeout(600);
    check(await page.locator('[data-testid=versao-homologacao]').count() === 0,
      `[${vp.n}] marcar teste não pergunta mais qual versão (a versão em homologação foi aposentada)`);
    const aviso = await page.locator('[data-testid=teste-usa-publicada]').innerText().catch(() => '');
    check(/publicada/i.test(aviso) && /ambiente de homologa/i.test(aviso),
      `[${vp.n}] a tela diz que a simulação usa a publicada e onde homologar ("${aviso.replace(/\s+/g, ' ').slice(0, 80)}")`);
    check(/Transfer/i.test(aviso),
      `[${vp.n}] e aponta o caminho de volta para produção (Transferências)`);
    await page.screenshot({ path: `${OUT}/homologacao-${vp.n}.png`, fullPage: true });

    // ── (d) EFEITO: simular roda a PUBLICADA ──────────────────────────────────
    const inicios = [];
    page.on('response', (r) => {
      if (/\/api\/v1\/workflow\/instances$/.test(r.url()) && r.request().method() === 'POST') inicios.push(r.status());
    });
    await page.locator('main input[type=text]').first().fill(`simulacao ${rid}`).catch(() => {});
    // ⚠️ No mobile os botões de conclusão vivem atrás do bottom sheet "Botões de conclusão":
    // o "Iniciar" existe no DOM e está habilitado, mas não é clicável, e o clique espera
    // actionability até estourar. Abrir o sheet antes. (Lição herdada da versão anterior desta
    // suíte — e que eu reaprendi na reescrita por não ter trazido o cuidado junto.)
    if (vp.n === 'mobile') {
      await page.getByRole('button', { name: /Botões de conclusão/ }).click();
      await page.waitForTimeout(700);
    }
    await page.getByRole('button', { name: /^Iniciar/ }).first().click();
    await page.waitForTimeout(2500);
    check(inicios.filter((s) => s === 201).length === 1,
      `[${vp.n}] a simulação iniciou de verdade (${inicios.join(',') || 'nenhuma chamada'})`);

    const doTeste = await api(token, `/api/v1/workflow/instances?mine=false&pageSize=5`);
    const recente = (doTeste.body?.items ?? []).find((i) => i.processKey === key);
    if (recente) {
      const detalhe = await api(token, `/api/v1/workflow/instances/${recente.id ?? recente.executionId}`);
      const schema = JSON.stringify(detalhe.body?.formSchema ?? '');
      check(schema.includes(ROTULO_ANTIGO) && !schema.includes(ROTULO_NOVO),
        `[${vp.n}] ⭐ EFEITO: a simulação executou a versão PUBLICADA, não o rascunho`);
    } else {
      check(false, `[${vp.n}] não encontrei a instância da simulação para conferir a versão`);
    }

    // ── (e) O modelador não tem mais selo de homologação ──────────────────────
    if (vp.n === 'web') {
      await page.goto(`${BASE}/flows/edit?key=${key}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.djs-palette', { timeout: 30000 });
      await page.waitForTimeout(1200);
      check(await page.locator('[data-testid=selo-homologacao]').count() === 0,
        '[web] o modelador não exibe mais o selo de homologação');
    }

    await ctx.close();
  }

  // ── (f) Publicar promove o rascunho: produção passa a servir o campo novo ───
  await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });
  const form = await api(token, `/api/v1/workflow/process-definitions/${key}/form`);
  const servido = JSON.stringify(form.body?.formSchema ?? '');
  check(servido.includes(ROTULO_NOVO) && !servido.includes(ROTULO_ANTIGO),
    'publicar promove o rascunho e produção passa a servir o campo novo');

  // ── (g) O status `homologation` não existe mais no vocabulário da API ───────
  const carimbo = await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH',
    { status: 'homologation' });
  check(carimbo.status === 400 && carimbo.body?.error === 'invalid_status',
    `carimbar "homologation" pela API é recusado (${carimbo.status}/${carimbo.body?.error})`);
} finally {
  await browser.close();
}

console.log(falhas === 0 ? 'PASSOU' : `FALHOU: ${falhas} caso(s)`);
process.exit(falhas === 0 ? 0 : 1);

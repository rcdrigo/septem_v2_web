// Fase 5 (requisitos 2026-08-03): alterar um processo publicado cria uma versão de
// HOMOLOGAÇÃO, testável na simulação, promovida no "Publicar", com volta de versão.
//
// ⭐ O check que dá sentido à fase é o (b): depois de salvar, o serviço ABERTO
// NORMALMENTE ainda serve o formulário ANTIGO. Antes desta fase, salvar um processo
// publicado ia direto para produção — o campo novo apareceria na hora para o cidadão.
//
// Asserção pelo CONTEÚDO do campo, não por "a tela abriu": abrir o formulário errado
// também "abre".
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
const xml = (campo, rotulo) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dh5" targetNamespace="x">
  <bpmn:process id="Ph5" name="Homologacao ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig status="draft" />
      <septem:formSchema>{"type":"default","schemaVersion":17,"components":[{"type":"textfield","key":"${campo}","label":"${rotulo}"}]}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Sh5"><bpmn:outgoing>Q1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Y1" name="Analisar ${rid}"><bpmn:incoming>Q1</bpmn:incoming><bpmn:outgoing>Q2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="Eh5"><bpmn:incoming>Q2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Q1" sourceRef="Sh5" targetRef="Y1" />
    <bpmn:sequenceFlow id="Q2" sourceRef="Y1" targetRef="Eh5" />
  </bpmn:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Dh5"><bpmndi:BPMNPlane id="Plh5" bpmnElement="Ph5" /></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const ROTULO_ANTIGO = `Campo Antigo ${rid}`;
const ROTULO_NOVO = `Campo Novo ${rid}`;

const salvo = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xml('antigo', ROTULO_ANTIGO) });
check(salvo.status < 300, `[setup] processo criado (${salvo.status})`);
const key = salvo.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });
const versaoProducao = (await api(token, `/api/v1/workflow/process-definitions/${key}`)).body.version;

// Salva (PUT = "Salvar" do modelador) com o formulário alterado → cria homologação.
const homolog = await api(token, `/api/v1/workflow/process-definitions/${key}`, 'PUT', { bpmnXml: xml('novo', ROTULO_NOVO) });
check(homolog.body?.status === 'homologation',
  `[api] salvar processo publicado cria HOMOLOGAÇÃO (status=${homolog.body?.status}, v${homolog.body?.version})`);

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });

/**
 * Texto do formulário do serviço. O rótulo do campo NÃO é um <label> no DOM do
 * ReactForm — ler por `document.querySelectorAll('label')` devolvia lista vazia, e o
 * check negativo ("não vazou o campo novo") passava EM FALSO por isso.
 *
 * Por isso a função devolve o texto inteiro e quem chama valida primeiro que ele
 * carregou (`textoCarregado`): asserção sobre string vazia não prova nada.
 */
const textoDoFormulario = (page) => page.evaluate(() => document.body.innerText || '');
const textoCarregado = (t) => t.includes('Iniciar como') && t.length > 40;

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const inicios = [];
    page.on('response', (r) => {
      if (r.url().endsWith('/api/v1/workflow/instances') && r.request().method() === 'POST') inicios.push(r.status());
    });
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20000 });

    // ── (b) ⭐ Produção INTOCADA: o serviço normal ainda serve o campo antigo ──
    await page.goto(`${BASE}/services/${key}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=iniciar-como-teste]', { timeout: 20000 });
    await page.waitForTimeout(800);
    const producao = await textoDoFormulario(page);
    check(textoCarregado(producao), `[${vp.n}] o formulário do serviço carregou (pré-condição das asserções)`);
    check(producao.includes(ROTULO_ANTIGO),
      `[${vp.n}] produção continua servindo o formulário ANTIGO`);
    check(textoCarregado(producao) && !producao.includes(ROTULO_NOVO),
      `[${vp.n}] e NÃO vazou o campo novo para produção`);

    // ── (c) Marcar teste faz aparecer a escolha de versão ─────────────────────
    await page.locator('[data-testid=iniciar-como-teste]').check();
    await page.waitForTimeout(500);
    check(await page.locator('[data-testid=versao-homologacao]').count() === 1,
      `[${vp.n}] com homologação existente, o teste pergunta qual versão usar`);

    // ── (d) Escolher homologação troca o formulário para o NOVO ──────────────
    await page.locator('[data-testid=versao-homologacao]').check();
    await page.waitForTimeout(1500);
    const emTeste = await textoDoFormulario(page);
    check(textoCarregado(emTeste) && emTeste.includes(ROTULO_NOVO),
      `[${vp.n}] escolhendo homologação, o formulário passa a ser o NOVO`);
    check(textoCarregado(emTeste) && !emTeste.includes(ROTULO_ANTIGO),
      `[${vp.n}] e o campo antigo sai da tela — é a versão de teste mesmo`);

    // ── (d2) ⭐ EFEITO: INICIAR de verdade contra a homologação ────────────────
    // Trocar o formulário na tela é metade. A outra metade é a requisição criada
    // rodar mesmo a versão de teste — e foi exatamente aqui que a suíte parava.
    await page.locator('main input[type=text]').first().fill(`teste homologacao ${rid}`).catch(() => {});
    // ⚠️ No mobile os botões de conclusão vivem atrás do bottom sheet "Botões de
    // conclusão": o "Iniciar" existe no DOM e está habilitado, mas não é clicável —
    // o clique fica esperando actionability até estourar. Abrir o sheet antes.
    if (vp.n === 'mobile') {
      await page.getByRole('button', { name: /Botões de conclusão/ }).click();
      await page.waitForTimeout(700);
    }
    await page.getByRole('button', { name: /^Iniciar/ }).first().click();
    await page.waitForTimeout(3000);
    check(inicios.filter((st) => st === 201).length === 1,
      `[${vp.n}] a simulação foi iniciada de fato (${JSON.stringify(inicios)})`);

    // A instância criada tem de estar marcada como teste E rodar o formulário NOVO.
    const ultimas = await api(token, '/api/v1/workflow/instances?page=1&pageSize=10');
    const criada = (ultimas.body.items ?? []).find((i) => (i.process ?? '').includes(`Homologacao ${rid}`));
    check(!!criada, `[${vp.n}] a requisição aparece na listagem`);
    if (criada) {
      const det = (await api(token, `/api/v1/workflow/instances/${criada.id}`)).body;
      check(det?.isTest === true, `[${vp.n}] a instância nasce marcada como TESTE`);
      const schema = JSON.stringify(det?.formSchema ?? '');
      check(schema.includes(ROTULO_NOVO),
        `[${vp.n}] ⭐ a instância roda a versão EM HOMOLOGAÇÃO (formulário novo)`);
      check(!schema.includes(ROTULO_ANTIGO),
        `[${vp.n}] e não a de produção`);
      // Invariante da Fase 4: em simulação a tarefa fica com quem simula.
      check(det?.activeTask?.assignee === 'Administrador',
        `[${vp.n}] a tarefa da simulação fica com quem simulou (${det?.activeTask?.assignee})`);
    }

    // E produção segue intocada depois de tudo isso.
    const producaoDepois = (await api(token, `/api/v1/workflow/process-definitions/${key}/form`)).body;
    check(JSON.stringify(producaoDepois?.formSchema ?? '').includes(ROTULO_ANTIGO),
      `[${vp.n}] depois da simulação, produção continua no formulário antigo`);

    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const clipped = [...document.querySelectorAll('button, input, label')].filter((el) => {
        if (el.closest('aside')) return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
      }).length;
      return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
    });
    check(!layout.overflows, `[${vp.n}] escolha de versão sem overflow horizontal`);
    check(layout.clipped === 0, `[${vp.n}] escolha de versão sem controle recortado (${layout.clipped})`);
    await page.screenshot({ path: `${OUT}/homologacao-${vp.n}.png`, fullPage: true });

    // ── (e) Selo no modelador ────────────────────────────────────────────────
    if (vp.n === 'web') {
      await page.goto(`${BASE}/flows/edit?key=${key}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.djs-palette', { timeout: 25000 });
      await page.waitForTimeout(1200);
      check(await page.locator('[data-testid=selo-homologacao]').count() === 1,
        '[web] o modelador exibe o selo "Em homologação"');
    }
    await ctx.close();
  }

  // ── (f) Publicar promove; voltar versão devolve ─────────────────────────────
  await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });
  const depoisDePublicar = await api(token, `/api/v1/workflow/process-definitions/${key}/form`);
  check(JSON.stringify(depoisDePublicar.body?.formSchema ?? '').includes(ROTULO_NOVO),
    '[api] publicar promove a homologação para produção');

  const volta = await api(token, `/api/v1/workflow/process-definitions/${key}/revert/${versaoProducao}`, 'POST', {});
  check(volta.status === 200, `[api] voltar versão responde (${volta.status})`);
  const depoisDeVoltar = await api(token, `/api/v1/workflow/process-definitions/${key}/form`);
  check(JSON.stringify(depoisDeVoltar.body?.formSchema ?? '').includes(ROTULO_ANTIGO),
    '[api] produção volta ao formulário anterior');
  const versoes = (await api(token, `/api/v1/workflow/process-definitions/${key}`)).body.versions ?? [];
  check(versoes.length >= 2, `[api] nada é apagado — as versões continuam registradas (${JSON.stringify(versoes)})`);
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

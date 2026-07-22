// Fase 8 — Relatório do processo (tela da execução). Prova o EFEITO de cada item:
// (1) editar o formulário pelo relatório grava o log na TAREFA ATIVA (e, em processo
//     já concluído, na ÚLTIMA tarefa executada);
// (2) tramitação mostra "Ação" com a DESCRIÇÃO do botão, não o id técnico;
// (3) o bloco "Status do processo" some do corpo e o status vai para o header;
// (4) o inbox do relatório é o mesmo configurado no processo (idêntico ao dos cards);
// (5) mobile: os botões de navegação ocupam 100% da largura;
// (6) tramitação em ordem decrescente (mais recente primeiro).
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;

const rid = Math.floor(Math.random() * 1e9);
// id do botão ≠ descrição: é exatamente o que o item 2 exige distinguir.
const BTN_ID = 'aprovar_id';
const BTN_LABEL = `Aprovar solicitação ${rid}`;
// septemGroupLayout=tabs: é o layout em abas (Visão geral / grupos / Tramitação),
// que é justamente onde vivem os "botões de navegação" do item 5.
const FORM = {
  septemGroupLayout: 'tabs',
  components: [
    { type: 'group', id: 'g1', label: 'Dados do pedido', components: [{ type: 'textfield', key: 'assunto', label: 'Assunto' }] },
  ],
};
const INBOX = 'Pedido de {{requisitante.nome}} sobre {{formulario.assunto}}';
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="Relatorio F8 ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig inbox="${INBOX}" />
      <septem:formSchema>${JSON.stringify(FORM)}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T1" name="Analisar pedido">
      <bpmn:extensionElements><septem:actionButtons><septem:actionButton id="${BTN_ID}" label="${BTN_LABEL}" /></septem:actionButtons></bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="T2" name="Homologar pedido">
      <bpmn:extensionElements><septem:actionButtons><septem:actionButton id="ok" label="Concluir" /></septem:actionButtons></bpmn:extensionElements>
      <bpmn:incoming>F2</bpmn:incoming><bpmn:outgoing>F3</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T1" />
    <bpmn:sequenceFlow id="F2" sourceRef="T1" targetRef="T2" />
    <bpmn:sequenceFlow id="F3" sourceRef="T2" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(saved.status === 201, `[api] processo criado (${saved.status})`);
const key = saved.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

// campo_legado NÃO existe no schema do formulário: serve para provar que editar
// pelo relatório não apaga dado que a tela não renderiza (nem inventa log dele).
const inst = await api(token, '/api/v1/workflow/instances', 'POST', {
  key, data: { assunto: 'Compra de material', campo_legado: 'valor que a tela não mostra' },
});
const execId = inst.body.executionId;
const t1Id = inst.body.tasks[0].id;

// ── Item 4 (api): o inbox do relatório sai do MESMO template e contexto do card ──
const detail0 = await api(token, `/api/v1/workflow/instances/${execId}`);
const lista = await api(token, '/api/v1/workflow/instances?take=50');
const card = (lista.body?.items ?? lista.body ?? []).find((x) => x.id === execId);
const semTags = (h) => (h ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
check(semTags(detail0.body?.inboxHtml) === (card?.inboxText ?? ''),
  `[api] inbox do relatório == inbox do card ("${semTags(detail0.body?.inboxHtml)}")`);
check(semTags(detail0.body?.inboxHtml).includes('Compra de material'),
  '[api] inbox resolve os placeholders do formulário (mesmo contexto dos cards)');

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
// Editar pelo relatório: o campo mora na aba do grupo (a aba ativa é "Visão geral").
async function editarAssunto(page, valor) {
  await page.getByRole('button', { name: 'Editar' }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('tab', { name: /Dados do pedido/i }).click();
  await page.waitForTimeout(400);
  await page.locator('[role=tabpanel] input').first().fill(valor);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.waitForTimeout(1800);
}

const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  await login(page);

  // ── Item 1: editar pelo relatório com o processo EM ANDAMENTO ────────────
  await page.goto(`${BASE}/solicitacao/${execId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForTimeout(1200);

  // Item 3: status no header (largura do texto), sem o bloco no corpo.
  const header = page.locator('header').first();
  check((await header.innerText()).includes('Em andamento'), '[item3] status aparece no header do relatório');
  check(!(await page.locator('body').innerText()).includes('Status do processo'),
    '[item3] bloco "Status do processo" saiu do corpo');
  const pill = await header.getByText('Em andamento').first().evaluate((el) => {
    const p = el.closest('span');
    return { w: p?.getBoundingClientRect().width ?? 0, pageW: document.documentElement.clientWidth };
  });
  check(pill.w > 0 && pill.w < pill.pageW / 2, `[item3] status tem a largura do texto, não da página (${Math.round(pill.w)}px)`);
  await page.screenshot({ path: `${OUT}/f8-relatorio-web.png`, fullPage: true });

  // Item 4 na tela. ESCOPADO ao bloco do inbox: "Compra de material" também é o
  // valor do campo "assunto", que o relatório renderiza — checar no body inteiro
  // passaria em falso mesmo com o bloco de inbox vazio.
  const blocoInbox = page.locator('div', { hasText: 'Inbox da requisição' }).last();
  const textoInbox = await blocoInbox.innerText();
  check(/Pedido de Administrador sobre Compra de material/.test(textoInbox),
    `[item4] o bloco "Inbox da requisição" traz o inbox configurado ("${textoInbox.split('\n').pop()}")`);

  await editarAssunto(page, 'Compra de material escolar');

  const det1 = await api(token, `/api/v1/workflow/instances/${execId}`);
  const ativa = det1.body.tasks.find((t) => t.status === 'pendente');
  const logNaAtiva = (ativa?.fieldHistory ?? []).filter((h) => h.action === 'report_edit');
  check(logNaAtiva.length === 1, `[item1] edição pelo relatório vira log na tarefa ATIVA (${ativa?.name}: ${logNaAtiva.length})`);
  check(logNaAtiva[0]?.newValue === 'Compra de material escolar' && logNaAtiva[0]?.oldValue === 'Compra de material',
    `[item1] o log guarda valor antigo → novo ("${logNaAtiva[0]?.oldValue}" → "${logNaAtiva[0]?.newValue}")`);
  const outras = det1.body.tasks.filter((t) => t.status !== 'pendente')
    .flatMap((t) => t.fieldHistory ?? []).filter((h) => h.action === 'report_edit');
  check(outras.length === 0, '[item1] nenhuma tarefa concluída recebeu o log da edição');

  // Seam: salvar pelo relatório não pode apagar dado que a tela não renderiza,
  // nem gravar uma alteração falsa desse campo.
  check(det1.body.data?.campo_legado === 'valor que a tela não mostra',
    `[item1] campo fora do schema SOBREVIVE à edição pelo relatório ("${det1.body.data?.campo_legado}")`);
  const logFantasma = det1.body.tasks.flatMap((t) => t.fieldHistory ?? [])
    .filter((h) => (h.field ?? '').includes('campo_legado'));
  check(logFantasma.length === 0,
    `[item1] nenhum log falso para o campo que a tela não renderiza (${logFantasma.length})`);

  // ── Item 2: concluir a T1 pelo botão e conferir a DESCRIÇÃO na tramitação ──
  await api(token, `/api/v1/workflow/tasks/${t1Id}/complete`, 'POST', { action: BTN_ID });
  const det2 = await api(token, `/api/v1/workflow/instances/${execId}`);
  const t1 = det2.body.tasks.find((t) => t.name === 'Analisar pedido');
  check(t1?.action === BTN_LABEL, `[item2] a API devolve a descrição do botão, não o id ("${t1?.action}")`);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByRole('tab', { name: /Tramitação/i }).click();
  await page.waitForTimeout(700);
  const tram = await page.locator('[role=tabpanel]').innerText();
  check(tram.includes(`Ação: ${BTN_LABEL}`), '[item2] tramitação exibe "Ação: <descrição>"');
  check(!tram.includes('Botão utilizado') && !tram.includes(BTN_ID),
    '[item2] sumiu o rótulo "Botão utilizado" e o id técnico');

  // ── Item 6: ordem decrescente (mais recente primeiro; abertura por último) ──
  const ordem = await page.locator('[role=tabpanel] ol > li').allInnerTexts();
  check(/Homologar pedido/.test(ordem[0] ?? ''), `[item6] o item mais recente vem primeiro ("${(ordem[0] ?? '').split('\n')[1]}")`);
  check(/Processo iniciado/.test(ordem[ordem.length - 1] ?? ''), '[item6] "Processo iniciado" fecha a lista (evento mais antigo)');
  // A abertura é UMA linha só: a tarefa do evento de início É o nó de abertura.
  check(ordem.filter((l) => /Processo iniciado/.test(l)).length === 1,
    '[item6] a abertura aparece uma única vez (tarefa de início fundida com o nó)');
  check(ordem.length === det2.body.tasks.length,
    `[item6] a lista tem exatamente uma linha por evento (${ordem.length} linhas / ${det2.body.tasks.length} tarefas)`);
  await page.screenshot({ path: `${OUT}/f8-tramitacao.png`, fullPage: true });

  // ── Item 1 (parte 2): processo CONCLUÍDO → log na ÚLTIMA tarefa executada ──
  const t2Id = det2.body.tasks.find((t) => t.status === 'pendente').id;
  await api(token, `/api/v1/workflow/tasks/${t2Id}/complete`, 'POST', { action: 'ok' });
  const fim = await api(token, `/api/v1/workflow/instances/${execId}`);
  check(fim.body.status === 'concluido', `[setup] processo concluído (${fim.body.status})`);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await editarAssunto(page, 'Compra de material de limpeza');

  const det3 = await api(token, `/api/v1/workflow/instances/${execId}`);
  const ultima = [...det3.body.tasks].filter((t) => t.completedAt)
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt)).pop();
  const logFinal = (ultima?.fieldHistory ?? []).filter((h) => h.action === 'report_edit' && h.newValue === 'Compra de material de limpeza');
  check(logFinal.length === 1,
    `[item1] processo concluído: o log vai para a ÚLTIMA tarefa executada (${ultima?.name})`);

  // ── Item 5: mobile — botões de navegação a 100% da largura ───────────────
  await ctx.close();
  const mob = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const m = await mob.newPage();
  await login(m);
  await m.goto(`${BASE}/solicitacao/${execId}`, { waitUntil: 'networkidle' });
  await m.waitForSelector('[role=tablist]', { timeout: 15000 });
  await m.waitForTimeout(1200);
  const larguras = await m.locator('[role=tablist]').evaluate((bar) => {
    const faixa = bar.getBoundingClientRect().width;
    const botoes = [...bar.querySelectorAll('[role=tab]')].map((b) => b.getBoundingClientRect().width);
    return { faixa, botoes, todosCheios: botoes.every((w) => w >= faixa - 1) };
  });
  check(larguras.botoes.length >= 3, `[item5] mobile tem os botões de navegação (${larguras.botoes.length})`);
  check(larguras.todosCheios, `[item5] todos ocupam 100% da largura (faixa ${Math.round(larguras.faixa)}px vs ${larguras.botoes.map((w) => Math.round(w)).join('/')})`);
  check(!(await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)),
    '[item5] relatório mobile sem overflow horizontal');
  await m.screenshot({ path: `${OUT}/f8-relatorio-mobile.png`, fullPage: true });
  await mob.close();
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

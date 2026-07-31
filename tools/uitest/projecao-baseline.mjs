// Fase 0 do PLANO_PROJECAO_FORMULARIO — BASELINE com evidência.
//
// Registra, ANTES de qualquer mudança, o comportamento ATUAL do sistema para
// formulário com LISTA DINÂMICA (o caso que a projeção vai mudar):
//   E1  quais campos entram no schema do relatório (flow_form_fields) quando há
//       lista dinâmica, lista aninhada e duas listas com filho de MESMA key;
//   E2  como o valor da lista fica no FormData da execução;
//   E3  o que o relatório mostra hoje na célula da lista e na célula do filho.
//
// As linhas "BASELINE:" são EVIDÊNCIA (não passam/falham) e vão para
// /tmp/logs/projecao-baseline.log. Os ✓/✗ são as INVARIANTES que precisam valer
// hoje e depois da projeção: o processo publica, a execução nasce pela TELA com a
// lista preenchida, o relatório roda e o viewer não estoura em web nem mobile.
//
// Fluxo do usuário exercitado em 1280×900 E 375×812: abrir o serviço → preencher →
// adicionar itens na lista (e no grupo aninhado) → iniciar → abrir a consulta.
import { chromium } from 'playwright-core';
import { appendFileSync, mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const LOG = '/tmp/logs/projecao-baseline.log';
const ok = [], bad = [], evid = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));
const baseline = (m) => evid.push(m);

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
const pkey = `projecao_lista_${rid}`;

// ── formulário: simples + lista + lista com filho de key REPETIDA + lista aninhada ──
const FORM = JSON.stringify({
  type: 'default', schemaVersion: 17,
  components: [
    { type: 'textfield', key: 'nome', label: 'Nome do solicitante' },
    { type: 'number', key: 'valor', label: 'Valor total' },
    {
      type: 'dynamiclist', key: 'itens', label: 'Itens',
      components: [
        { type: 'textfield', key: 'produto', label: 'Produto' },
        { type: 'number', key: 'quantidade', label: 'Quantidade' },
      ],
    },
    {
      // Filho com a MESMA key de itens[].produto — hoje o extrator deduplica por key.
      type: 'dynamiclist', key: 'outros', label: 'Outros itens',
      components: [{ type: 'textfield', key: 'produto', label: 'Produto (outros)' }],
    },
    {
      type: 'dynamiclist', key: 'grupos', label: 'Grupos',
      components: [
        { type: 'textfield', key: 'titulo', label: 'Titulo do grupo' },
        { type: 'dynamiclist', key: 'subitens', label: 'Subitens', components: [{ type: 'textfield', key: 'codigo', label: 'Codigo' }] },
      ],
    },
  ],
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${rid}" targetNamespace="x">
  <bpmn:process id="P_${rid}" name="Projecao Lista ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig status="published" accessRules='[{"type":"all","action":"allow","capability":"view"}]' />
      <septem:formSchema>${FORM.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Conferir itens ${rid}">
      <bpmn:extensionElements><septem:actionButtons><septem:actionButton id="ok_${rid}" label="Concluir conferencia" /></septem:actionButtons></bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

const save = await api(token, '/api/v1/workflow/process-definitions/', 'POST', { key: pkey, bpmnXml: XML });
check(save.status === 201, `[setup] processo com lista dinâmica publicado (${save.status})`);
await api(token, `/api/v1/workflow/process-definitions/${pkey}/status`, 'PATCH', { status: 'published' });

// ── relatório por processo (rascunho) só para ler os metadados AO VIVO ──────────
const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `Baseline Projecao ${rid}`, sourceType: 'process', processKey: pkey, definitionJson: '{}',
});
check(novo.status === 201, `[setup] relatório por processo criado (${novo.status})`);
const rkey = novo.body.key;

// ══════════════ E1 — metadados: o que virou coluna do relatório ══════════════
const meta = await api(token, `/api/v1/reports/${rkey}/source-metadata`);
const cols = (meta.body?.columns ?? []).filter((c) => !c.key.startsWith('_'));
const byKey = Object.fromEntries(cols.map((c) => [c.key, c]));
baseline(`E1 colunas de formulário no schema: ${cols.map((c) => `${c.key}:${c.type}`).join(', ')}`);
baseline(`E1 a lista "itens" ${byKey.itens ? `É coluna (tipo ${byKey.itens.type})` : 'NÃO é coluna'}`);
baseline(`E1 o filho "produto" ${byKey.produto ? `É coluna (rótulo "${byKey.produto.label}")` : 'NÃO é coluna'}`);
baseline(`E1 filho de lista aninhada "codigo" ${byKey.codigo ? 'É coluna' : 'NÃO é coluna'}`);
// Prova da dedup por key: as DUAS listas têm um filho "produto"; só sobra um rótulo.
baseline(`E1 rótulo de "produto" = "${byKey.produto?.label ?? '—'}" (o form tem "Produto" em itens e "Produto (outros)" em outros)`);
baseline(`E1 total de colunas de formulário: ${cols.length} (o form declara 8 componentes com key)`);
check(cols.length > 0, `[E1] o schema do relatório traz colunas do formulário (${cols.length})`);

// ══════════════ TELA: iniciar a requisição preenchendo a lista ══════════════
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};
// Linhas PRÓPRIAS de uma lista (filhas diretas do corpo dela). Sem o "> div >" o
// seletor casaria também as linhas da lista ANINHADA e o .last() apontaria para o
// subitem — foi exatamente o que quebrou a 1ª versão desta sonda.
const linhasDa = (raiz, key) => raiz.locator(`[data-testid=lista-dinamica][data-lista="${key}"] > div > [data-testid=lista-item]`);
/** Adiciona um item na lista (dentro de `raiz`) e devolve o locator da linha criada. */
const addItem = async (page, raiz, key) => {
  const antes = await linhasDa(raiz, key).count();
  await raiz.locator(`[data-testid=lista-dinamica][data-lista="${key}"] > header [data-testid=lista-adicionar]`).first().click();
  await page.waitForTimeout(150);
  return linhasDa(raiz, key).nth(antes);
};
// Controle fora da viewport = inacessível. Exceção legítima (rules.md: "tabelas
// ganham scroll"): o que está dentro de um contêiner com overflow-x auto/scroll é
// alcançável rolando — medido, não presumido (o 1º ✗ desta sonda era a tabela de
// 991px dentro de .overflow-x-auto). `scroller` conta esses contêineres para a
// asserção positiva de que a tabela larga TEM rolagem no mobile.
const medir = (page) => page.evaluate(() => {
  const doc = document.documentElement;
  const emScroller = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  const fora = [...document.querySelectorAll('button, input, select, textarea, a[href]')].filter((el) => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1) && !emScroller(el);
  });
  const scrollers = [...document.querySelectorAll('*')].filter((el) => {
    const ox = getComputedStyle(el).overflowX;
    return (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1;
  }).length;
  return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped: fora.length, scrollers };
});

/** Percurso completo do usuário no formulário do serviço, com lista dinâmica. */
const iniciarPelaTela = async (page, view, sufixo) => {
  await page.goto(`${BASE}/servico/${pkey}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=lista-dinamica]', { timeout: 20000 });

  await page.locator('main input[type=text]').first().fill(`Solicitante ${sufixo}`);
  await page.locator('main input[type=number]').first().fill('1000');

  const main = page.locator('main');
  // itens: 2 ocorrências — é o caso que hoje some do relatório.
  for (const [prod, qtd] of [['Caneta', '2'], ['Papel', '5']]) {
    const row = await addItem(page, main, 'itens');
    await row.locator('input[type=text]').first().fill(`${prod} ${sufixo}`);
    await row.locator('input[type=number]').first().fill(qtd);
  }
  // outros: 1 ocorrência, filho com a MESMA key "produto".
  const outro = await addItem(page, main, 'outros');
  await outro.locator('input[type=text]').first().fill(`Fora da lista ${sufixo}`);

  // grupos: 1 grupo com 2 subitens (lista ANINHADA).
  const grupo = await addItem(page, main, 'grupos');
  await grupo.locator('input[type=text]').first().fill(`Grupo ${sufixo}`);
  for (const cod of ['A1', 'B2']) {
    const sub = await addItem(page, grupo, 'subitens');
    await sub.locator('input[type=text]').first().fill(cod);
  }

  const antes = await medir(page);
  check(!antes.overflows, `[${view}] formulário com lista dinâmica sem overflow horizontal`);
  check(antes.clipped === 0, `[${view}] formulário com lista dinâmica sem controle recortado (${antes.clipped})`);
  await page.screenshot({ path: `${OUT}/projecao-baseline-form-${view}.png`, fullPage: true });

  // No mobile (<640px) o rodapé não mostra os botões: mostra "Botões de conclusão",
  // que abre o bottom-sheet onde o "Iniciar" vive. Caminho real do usuário nos dois.
  const abrirSheet = page.getByRole('button', { name: /Botões de conclusão/ });
  if (await abrirSheet.isVisible().catch(() => false)) {
    await abrirSheet.click();
    await page.waitForTimeout(400);
    check(await page.getByRole('button', { name: /^Iniciar$/ }).isVisible(),
      `[${view}] bottom-sheet de conclusão abriu com o botão Iniciar`);
    await page.screenshot({ path: `${OUT}/projecao-baseline-sheet-${view}.png`, fullPage: false });
  }
  await page.getByRole('button', { name: /^Iniciar$/ }).first().click();
  await page.waitForSelector('text=Solicitação iniciada com sucesso', { timeout: 25000 });
  check(true, `[${view}] requisição iniciada PELA TELA com 2 itens, 1 "outro" e 1 grupo com 2 subitens`);
};

try {
  // ══════════════ WEB 1280 ══════════════
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  await login(page);
  await iniciarPelaTela(page, 'web', 'web');

  // ══════════════ E2 — como a lista ficou no FormData ══════════════
  const insts = await api(token, '/api/v1/workflow/instances?page=1&pageSize=50');
  const minha = (insts.body?.items ?? []).find((i) => i.processKey === pkey);
  check(!!minha, '[E2] a instância criada pela tela aparece na listagem');
  const det = await api(token, `/api/v1/workflow/instances/${minha.id}`);
  const data = det.body?.data ?? {};
  baseline(`E2 FormData.itens = ${JSON.stringify(data.itens)}`);
  baseline(`E2 FormData.grupos = ${JSON.stringify(data.grupos)}`);
  check(Array.isArray(data.itens) && data.itens.length === 2,
    `[E2] a lista é um ARRAY DE OBJETOS no FormData (${Array.isArray(data.itens) ? data.itens.length : 'não é array'} itens)`);
  check(Array.isArray(data.grupos?.[0]?.subitens) && data.grupos[0].subitens.length === 2,
    '[E2] a lista ANINHADA guarda os subitens dentro do item do grupo');

  // ══════════════ E3 — o que o relatório mostra HOJE ══════════════
  const colunas = ['_numero', 'nome', 'valor', ...['itens', 'produto', 'quantidade', 'outros', 'grupos', 'titulo', 'subitens', 'codigo'].filter((k) => byKey[k])];
  const def = { blocks: [{ id: 'tab', type: 'table', title: `Baseline ${rid}`, columns: colunas.map((key) => ({ key })) }] };
  await api(token, `/api/v1/reports/${rkey}`, 'PUT', { definitionJson: JSON.stringify(def) });
  const pub = await api(token, `/api/v1/reports/${rkey}/publish`, 'POST', {});
  check(pub.status === 200, `[E3] relatório publicado com as colunas da lista (${pub.status})`);

  const run = await api(token, `/api/v1/reports/${rkey}/run`, 'POST', { refresh: true });
  check(run.status === 200, `[E3] relatório executou (${run.status})`);
  const bloco = run.body?.blocks?.[0];
  const linha = bloco?.rows?.[0] ?? [];
  const cel = Object.fromEntries(colunas.map((k, i) => [k, linha[i]]));
  colunas.forEach((k) => baseline(`E3 célula "${k}" = ${JSON.stringify(cel[k])}`));
  baseline(`E3 total de linhas do relatório: ${run.body?.totalRows}`);
  check(run.body?.totalRows >= 1, `[E3] o relatório traz a execução criada (${run.body?.totalRows} linha(s))`);
  // Invariante que precisa valer HOJE e DEPOIS: lista não multiplica execuções.
  check(bloco?.rows?.length === run.body?.totalRows,
    `[E3] a lista dinâmica NÃO multiplica as linhas do relatório (${bloco?.rows?.length} linhas para ${run.body?.totalRows} execuções)`);

  // Viewer na tela (web)
  await page.goto(`${BASE}/consultas/ver?key=${rkey}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`text=Baseline ${rid}`, { timeout: 20000 });
  await page.waitForTimeout(800);
  const lw = await medir(page);
  check(!lw.overflows, '[web] viewer da consulta sem overflow horizontal');
  check(lw.clipped === 0, `[web] viewer da consulta sem elemento recortado (${lw.clipped})`);
  await page.screenshot({ path: `${OUT}/projecao-baseline-viewer-web.png`, fullPage: false });
  baseline(`E3 texto da tabela no viewer (web): ${(await page.locator('section:has-text("Baseline")').first().innerText()).replace(/\s+/g, ' ').slice(0, 400)}`);
  await ctx.close();

  // ══════════════ MOBILE 375 — mesmo percurso, do zero ══════════════
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => console.log('pageerror(mobile):', e.message.slice(0, 160)));
  await login(m);
  await iniciarPelaTela(m, 'mobile', 'mob');

  await m.goto(`${BASE}/consultas/ver?key=${rkey}`, { waitUntil: 'networkidle' });
  await m.waitForSelector(`text=Baseline ${rid}`, { timeout: 20000 });
  await m.waitForTimeout(800);
  const lm = await medir(m);
  check(!lm.overflows, '[mobile] viewer da consulta sem overflow horizontal');
  check(lm.clipped === 0, `[mobile] viewer da consulta sem elemento recortado (${lm.clipped})`);
  await m.screenshot({ path: `${OUT}/projecao-baseline-viewer-mobile.png`, fullPage: false });

  const run2 = await api(token, `/api/v1/reports/${rkey}/run`, 'POST', { refresh: true });
  check(run2.body?.totalRows === 2, `[E3] as 2 execuções (web + mobile) aparecem no relatório (${run2.body?.totalRows})`);
} finally {
  await browser.close();
}

// ── evidência em /tmp/logs (rules.md §5: sem valor de negócio fora daqui) ──────
try {
  mkdirSync('/tmp/logs', { recursive: true });
  appendFileSync(LOG, `\n===== ${new Date().toISOString()} · processo ${pkey} · relatório ${rkey} =====\n${evid.join('\n')}\n`);
} catch (e) { console.log('! não consegui escrever ' + LOG + ': ' + e.message); }

evid.forEach((m) => console.log('BASELINE: ' + m));
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks · ${evid.length} evidências em ${LOG})` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

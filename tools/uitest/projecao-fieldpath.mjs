// Fase 1 do PLANO_PROJECAO_FORMULARIO — o CAMINHO do campo (FieldPath) chegando à
// tela. Prova, com um processo que tem DUAS listas dinâmicas cujos filhos têm a
// MESMA key (`itens[].produto` e `outros[].produto`):
//   1. o builder do relatório oferece os DOIS campos, cada um com seu rótulo e
//      agrupado pela sua lista (antes só existia um — o outro sumia do banco);
//   2. campos de lista aninhada também aparecem (`grupos[].subitens[].codigo`);
//   3. campo simples continua com a chave de sempre (contrato antigo preservado);
//   4. escolher um campo de lista e salvar grava o CAMINHO na definição;
//   5. o combo de campos do MODELADOR (condição de gateway/ator) continua só com o
//      1º nível — filho de lista não é endereçável em `data[chave]`.
// Web 1280×900 e mobile 375×812, com overflow/clipped medidos.
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

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;
const rid = Math.floor(Math.random() * 1e9);
const pkey = `fieldpath_ui_${rid}`;

const FORM = JSON.stringify({
  type: 'default', schemaVersion: 17,
  components: [
    { type: 'textfield', key: 'nome', label: 'Nome do solicitante' },
    { type: 'dynamiclist', key: 'itens', label: 'Itens', components: [
      { type: 'textfield', key: 'produto', label: 'Produto' },
      { type: 'number', key: 'quantidade', label: 'Quantidade' }] },
    { type: 'dynamiclist', key: 'outros', label: 'Outros itens', components: [
      { type: 'textfield', key: 'produto', label: 'Produto (outros)' }] },
    { type: 'dynamiclist', key: 'grupos', label: 'Grupos', components: [
      { type: 'textfield', key: 'titulo', label: 'Titulo do grupo' },
      { type: 'dynamiclist', key: 'subitens', label: 'Subitens', components: [
        { type: 'textfield', key: 'codigo', label: 'Codigo' }] }] },
  ],
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${rid}" targetNamespace="x">
  <bpmn:process id="P_${rid}" name="FieldPath UI ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig status="published" accessRules='[{"type":"all","action":"allow","capability":"view"}]' />
      <septem:formSchema>${FORM.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Conferir ${rid}"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

const save = await api(token, '/api/v1/workflow/process-definitions/', 'POST', { key: pkey, bpmnXml: XML });
check(save.status === 201, `[setup] processo com 2 listas de filhos homônimos publicado (${save.status})`);
await api(token, `/api/v1/workflow/process-definitions/${pkey}/status`, 'PATCH', { status: 'published' });

const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `FieldPath UI ${rid}`, sourceType: 'process', processKey: pkey, definitionJson: JSON.stringify({ blocks: [] }),
});
check(novo.status === 201, `[setup] relatório por processo criado (${novo.status})`);
const rkey = novo.body.key;

// ── 5. combo do MODELADOR só com o 1º nível ─────────────────────────────────
const campos = await api(token, `/api/v1/workflow/process-definitions/${pkey}/fields`);
const chavesModelador = (campos.body ?? []).map((f) => f.key).sort();
check(JSON.stringify(chavesModelador) === JSON.stringify(['grupos', 'itens', 'nome', 'outros']),
  `[modelador] combo de campos traz só o 1º nível do FormData (${chavesModelador.join(',')})`);

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
  return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped: fora.length };
});

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

/** Abre a aba Origem do builder e devolve o texto (onde os campos são listados). */
const textoDaOrigem = async (page) => {
  await page.goto(`${BASE}/reports/edit?key=${rkey}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Origem dos dados', { timeout: 20000 });
  await page.locator('nav button', { hasText: 'Origem' }).click();
  await page.waitForTimeout(800);
  return page.innerText('main');
};

try {
  // ══════════ WEB 1280 ══════════
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  await login(page);

  const origem = await textoDaOrigem(page);
  check(origem.includes('itens[].produto') && origem.includes('outros[].produto'),
    '[web] builder lista os DOIS filhos homônimos, cada um com seu caminho');
  check(origem.includes('Produto') && origem.includes('Produto (outros)'),
    '[web] cada um com o SEU rótulo (antes só sobrava "Produto")');
  check(origem.includes('grupos[].subitens[].codigo'),
    '[web] campo de lista ANINHADA aparece com o caminho completo');
  check(origem.includes('nome') && !origem.includes('nome['),
    '[web] campo simples continua com a chave de sempre (contrato antigo preservado)');
  await page.screenshot({ path: `${OUT}/projecao-fieldpath-origem-web.png`, fullPage: true });

  const lw = await medir(page);
  check(!lw.overflows, '[web] aba Origem sem overflow horizontal');
  check(lw.clipped === 0, `[web] aba Origem sem controle recortado (${lw.clipped})`);

  // ── 4. escolher um campo de lista e salvar grava o CAMINHO ────────────────
  await page.locator('nav button', { hasText: 'Blocos' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Adicione um componente|Adicionar componente/ }).first().click();
  await page.waitForSelector('[role=dialog]', { timeout: 8000 });
  const dlg = page.locator('[role=dialog]');
  await dlg.getByRole('button', { name: 'KPI / Card' }).click();
  await page.waitForTimeout(400);

  const opcoes = await dlg.locator('label:has-text("Campo de valor") select option').allTextContents();
  const valores = await dlg.locator('label:has-text("Campo de valor") select').evaluate(
    (s) => [...s.options].map((o) => o.value));
  check(valores.includes('itens[].quantidade'),
    `[web] o campo numérico da lista é selecionável pelo caminho (${valores.filter((v) => v.includes('[]')).join(', ') || 'nenhum'})`);
  void opcoes;

  await dlg.locator('label:has-text("Agregação") select').selectOption('sum');
  await dlg.locator('label:has-text("Campo de valor") select').selectOption('itens[].quantidade');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/projecao-fieldpath-modal-web.png`, fullPage: false });
  await dlg.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.waitForTimeout(600);
  await page.locator('button', { hasText: 'Salvar rascunho' }).click();
  const salvou = await page.waitForFunction(() => document.body.innerText.includes('Rascunho salvo'), { timeout: 12000 })
    .then(() => true).catch(() => false);
  check(salvou, '[web] rascunho salvo com o componente sobre o campo da lista');

  const salvo = await api(token, `/api/v1/reports/${rkey}`);
  check((salvo.body?.definitionJson ?? '').includes('itens[].quantidade'),
    '[web] a definição gravada guarda o CAMINHO do campo, não a key solta');
  await ctx.close();

  // ══════════ MOBILE 375 ══════════
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => console.log('pageerror(mobile):', e.message.slice(0, 160)));
  await login(m);

  const origemMob = await textoDaOrigem(m);
  check(origemMob.includes('itens[].produto') && origemMob.includes('outros[].produto'),
    '[mobile] builder lista os dois filhos homônimos com seus caminhos');
  const lm = await medir(m);
  check(!lm.overflows, '[mobile] aba Origem sem overflow horizontal');
  check(lm.clipped === 0, `[mobile] aba Origem sem controle recortado (${lm.clipped})`);
  await m.screenshot({ path: `${OUT}/projecao-fieldpath-origem-mobile.png`, fullPage: true });
} finally {
  await browser.close();
}

// limpa a fixture desta rodada (o processo fica: versões são histórico do modelador)
await api(token, `/api/v1/reports/${rkey}`, 'DELETE');

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

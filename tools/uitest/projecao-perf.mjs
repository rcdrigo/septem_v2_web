// Fase 6 do PLANO_PROJECAO_FORMULARIO — o caminho OTIMIZADO na tela.
// A F6 mudou COMO o dado é buscado (índice da projeção + filtro empurrado para o
// Postgres). O que o usuário não pode perceber é diferença de RESULTADO. Esta sonda
// prova isso no navegador real:
//   1. o filtro digitado na barra do relatório devolve exatamente as linhas certas —
//      e é justamente ele que agora vira WHERE no banco;
//   2. valor com ACENTO (que desliga o push-down por segurança) dá o MESMO resultado
//      que o caminho otimizado — o usuário não vê os dois caminhos;
//   3. valor com CURINGA do LIKE ("50%") não vira "qualquer coisa";
//   4. ordenação e limite do bloco continuam valendo sobre o conjunto filtrado;
//   5. o KPI conta o mesmo que a tabela mostra (número do golden, não "um número");
//   6. limpar o filtro devolve o total original.
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
const pkey = `projecao_perf_${rid}`;

const FORM = JSON.stringify({
  type: 'default', schemaVersion: 17,
  components: [
    { type: 'textfield', key: 'cidade', label: 'Cidade' },
    { type: 'number', key: 'valor', label: 'Valor' },
  ],
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${rid}" targetNamespace="x">
  <bpmn:process id="P_${rid}" name="Perf F6 ${rid}" isExecutable="true">
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
check(save.status === 201, `[setup] processo publicado (${save.status})`);
await api(token, `/api/v1/workflow/process-definitions/${pkey}/status`, 'PATCH', { status: 'published' });

// Massa escolhida para estressar o push-down: 3 grafias de caixa, um acento (que
// DESLIGA o push-down) e um curinga de LIKE dentro do próprio valor.
const MASSA = [
  { cidade: 'Recife', valor: 10 },
  { cidade: 'recife', valor: 30 },
  { cidade: 'RECIFE', valor: 20 },
  { cidade: 'São Paulo', valor: 40 },
  { cidade: 'Desconto 50%', valor: 50 },
  { cidade: 'Desconto 5011', valor: 60 },
  { cidade: 'Olinda', valor: 70 },
];
for (const d of MASSA) await api(token, '/api/v1/workflow/instances', 'POST', { key: pkey, data: d });

const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `Perf F6 ${rid}`, sourceType: 'process', processKey: pkey,
  definitionJson: JSON.stringify({
    cacheTtlSeconds: 0,
    filters: [{ id: 'cid', label: 'Cidade', field: 'cidade', type: 'text' }],
    blocks: [
      {
        id: 't', type: 'table',
        columns: [{ key: '_numero' }, { key: 'cidade' }, { key: 'valor' }],
        sorts: [{ field: 'valor', desc: true }],
        limit: 10,
      },
      { id: 'k', type: 'kpi', title: `Quantos ${rid}`, agg: 'count' },
    ],
  }),
});
check(novo.status === 201, `[setup] relatório criado (${novo.status})`);
const rkey = novo.body.key;
check((await api(token, `/api/v1/reports/${rkey}/publish`, 'POST', {})).status === 200, '[setup] relatório publicado');

/** Quantas linhas a massa produz para um filtro "contém", sem diferenciar caixa. */
const esperadoPara = (v) => MASSA.filter((m) => m.cidade.toLowerCase().includes(v.toLowerCase())).length;

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

/** Linhas visíveis da tabela do relatório (o viewer também renderiza um tbody de impressão). */
const linhasVisiveis = (page) => page.locator('table tbody tr:visible').count();

/** Digita o filtro na barra e aplica. */
const filtrar = async (page, valor) => {
  const campo = page.locator('label:has-text("Cidade") input');
  await campo.fill(valor);
  await page.getByRole('button', { name: /Aplicar|Atualizar/ }).first().click();
  await page.waitForTimeout(1200);
};

try {
  // ══════════ WEB 1280 ══════════
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  await login(page);

  await page.goto(`${BASE}/reports/view?key=${rkey}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('table', { timeout: 20000 });

  const total = await linhasVisiveis(page);
  check(total === MASSA.length, `[web] sem filtro, a tabela mostra as ${MASSA.length} linhas (${total})`);

  // 1. filtro que casa 3 grafias de caixa — é o caminho COM push-down
  await filtrar(page, 'recife');
  const nRecife = await linhasVisiveis(page);
  check(nRecife === esperadoPara('recife'),
    `[web] filtro "recife" traz as ${esperadoPara('recife')} grafias (${nRecife}) — push-down não perdeu caixa`);
  // O card do KPI é uma <section> com o título — mesmo seletor da sonda da F4. O
  // título É REMOVIDO antes de comparar: o rid tem dígitos e cola no valor, o que
  // faria um "contém" passar por acaso. Aqui a comparação é de igualdade.
  const cardKpi = (await page.locator(`section:has-text("Quantos ${rid}")`).first().innerText())
    .replace(/\s/g, '').replace(`Quantos${rid}`, '');
  check(cardKpi === String(esperadoPara('recife')),
    `[web] o KPI conta exatamente o que a tabela mostra (esperado ${esperadoPara('recife')}, card "${cardKpi}")`);
  await page.screenshot({ path: `${OUT}/projecao-perf-filtro-web.png`, fullPage: true });

  // 2. acento: o push-down se DESLIGA e o resultado tem de ser o mesmo
  await filtrar(page, 'São');
  const nAcento = await linhasVisiveis(page);
  check(nAcento === esperadoPara('São'),
    `[web] valor com acento (push-down desligado) dá o mesmo resultado (${nAcento})`);

  // 3. curinga do LIKE dentro do valor não pode virar "qualquer coisa"
  await filtrar(page, 'Desconto 50%');
  const nCuringa = await linhasVisiveis(page);
  check(nCuringa === esperadoPara('Desconto 50%'),
    `[web] "Desconto 50%" casa só o exato (${nCuringa}), não o "Desconto 5011"`);

  // 4. ordenação do bloco continua valendo sobre o conjunto filtrado
  await filtrar(page, 'Recife');
  const valores = await page.locator('table tbody tr:visible').evaluateAll(
    (trs) => trs.map((tr) => tr.querySelectorAll('td')[2]?.textContent?.trim() ?? ''));
  const nums = valores.map((v) => Number(v.replace(/\./g, '').replace(',', '.'))).filter((n) => !Number.isNaN(n));
  check(nums.length > 1 && nums.every((n, i) => i === 0 || nums[i - 1] >= n),
    `[web] ordenação decrescente preservada sobre o filtrado (${nums.join(' ≥ ')})`);

  // 5. limpar o filtro devolve o total
  await filtrar(page, '');
  const voltou = await linhasVisiveis(page);
  check(voltou === MASSA.length, `[web] limpar o filtro devolve as ${MASSA.length} linhas (${voltou})`);

  const lw = await medir(page);
  check(!lw.overflows, '[web] relatório sem overflow horizontal');
  check(lw.clipped === 0, `[web] relatório sem controle recortado (${lw.clipped})`);
  await ctx.close();

  // ══════════ MOBILE 375 ══════════
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => console.log('pageerror(mobile):', e.message.slice(0, 160)));
  await login(m);

  await m.goto(`${BASE}/reports/view?key=${rkey}`, { waitUntil: 'networkidle' });
  await m.waitForSelector('table', { timeout: 20000 });

  await filtrar(m, 'recife');
  const nMob = await linhasVisiveis(m);
  check(nMob === esperadoPara('recife'), `[mobile] filtro devolve o mesmo do desktop (${nMob})`);

  await filtrar(m, 'Desconto 50%');
  const nMobCuringa = await linhasVisiveis(m);
  check(nMobCuringa === esperadoPara('Desconto 50%'), `[mobile] curinga tratado igual (${nMobCuringa})`);

  const lm = await medir(m);
  check(!lm.overflows, '[mobile] relatório sem overflow horizontal');
  check(lm.clipped === 0, `[mobile] relatório sem controle recortado (${lm.clipped})`);
  await m.screenshot({ path: `${OUT}/projecao-perf-filtro-mobile.png`, fullPage: true });
} finally {
  await browser.close();
}

// limpa a fixture desta rodada (o processo fica: versões são histórico do modelador)
await api(token, `/api/v1/reports/${rkey}`, 'DELETE');

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Fase 4 do PLANO_PROJECAO_FORMULARIO — o VALOR chegando à tela.
//
// É a fase que fecha o círculo: o dado do formulário passa a sair da projeção, e o
// campo dentro de LISTA DINÂMICA — que a Fase 0 provou estar invisível para os
// relatórios — finalmente aparece. A sonda percorre o viewer como o usuário:
//   1. a coluna do filho de lista mostra as ocorrências ("Caneta; Papel"), e a
//      lista NÃO multiplica as linhas do relatório;
//   2. filtro por um valor que só existe no 2º item encontra a execução;
//   3. gráfico e KPI computam; o drill-down abre com as linhas do segmento;
//   4. exportação baixa o arquivo com o mesmo conteúdo;
//   5. campo marcado como NÃO reportável não aparece em lugar nenhum.
// Web 1280×900 e mobile 375×812, com overflow/clipped medidos no DOM.
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
const pkey = `projecao_rel_${rid}`;

const FORM = JSON.stringify({
  type: 'default', schemaVersion: 17,
  components: [
    { type: 'textfield', key: 'setor', label: 'Setor' },
    { type: 'number', key: 'valor', label: 'Valor' },
    { type: 'textfield', key: 'segredo', label: 'Segredo', properties: { septemVisReport: 'no' } },
    { type: 'dynamiclist', key: 'itens', label: 'Itens', components: [
      { type: 'textfield', key: 'produto', label: 'Produto' },
      { type: 'number', key: 'quantidade', label: 'Quantidade' }] },
  ],
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${rid}" targetNamespace="x">
  <bpmn:process id="P_${rid}" name="Projecao Relatorio ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig status="published" accessRules='[{"type":"all","action":"allow","capability":"view"}]' />
      <septem:formSchema>${FORM.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar ${rid}"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

const save = await api(token, '/api/v1/workflow/process-definitions/', 'POST', { key: pkey, bpmnXml: XML });
check(save.status === 201, `[setup] processo publicado (${save.status})`);
await api(token, `/api/v1/workflow/process-definitions/${pkey}/status`, 'PATCH', { status: 'published' });

// 3 execuções: a 1ª com lista de 2 itens (o caso que não aparecia), as outras simples.
const dados = [
  { setor: 'Compras', valor: 100, segredo: `sigilo${rid}`, itens: [{ produto: 'Caneta', quantidade: 2 }, { produto: 'Papel', quantidade: 5 }] },
  { setor: 'Compras', valor: 50, segredo: `sigilo${rid}`, itens: [{ produto: 'Papel', quantidade: 1 }] },
  { setor: 'Obras', valor: 300, segredo: `sigilo${rid}`, itens: [] },
];
for (const data of dados) {
  const r = await api(token, '/api/v1/workflow/instances', 'POST', { key: pkey, data });
  check(r.status === 201, `[setup] execução criada (${r.status})`);
}

const novo = await api(token, '/api/v1/reports/', 'POST', {
  name: `Projecao Relatorio ${rid}`, sourceType: 'process', processKey: pkey,
  definitionJson: JSON.stringify({
    cacheTtlSeconds: 0,
    blocks: [
      { id: 'tab', type: 'table', title: `Tabela ${rid}`, w: 12,
        columns: [{ key: 'setor' }, { key: 'valor' }, { key: 'itens[].produto' }, { key: 'itens[].quantidade' }],
        sorts: [{ field: 'itens[].produto', desc: false }] },
      { id: 'kpi', type: 'kpi', title: `Total ${rid}`, w: 4, agg: 'sum', valueField: 'valor', format: 'number' },
      { id: 'pizza', type: 'pie', title: `Por setor ${rid}`, w: 8, groupBy: 'setor', agg: 'count' },
    ],
    detail: { fields: ['setor', 'valor', 'itens[].produto'] },
  }),
});
check(novo.status === 201, `[setup] relatório criado (${novo.status})`);
const rkey = novo.body.key;
const pub = await api(token, `/api/v1/reports/${rkey}/publish`, 'POST', {});
check(pub.status === 200, `[setup] relatório publicado (${pub.status})`);

// ── conferência pela API (o que a tela tem de refletir) ─────────────────────
const run = await api(token, `/api/v1/reports/${rkey}/run`, 'POST', { refresh: true });
check(run.status === 200, `[api] relatório executou (${run.status})`);
const tabela = (run.body?.blocks ?? []).find((b) => b.id === 'tab');
const linhaLista = (tabela?.rows ?? []).find((r) => (r[2] ?? '').includes('Caneta'));
check(!!linhaLista, `[api] a coluna do filho de lista traz as ocorrências ("${linhaLista?.[2] ?? '—'}")`);
check(linhaLista?.[2] === 'Caneta; Papel' && linhaLista?.[3] === '2; 5',
  '[api] ocorrências concatenadas na ordem da lista, campo a campo');
check(run.body?.totalRows === 3 && (tabela?.rows ?? []).length === 3,
  `[api] a lista NÃO multiplica as execuções (${tabela?.rows?.length} linhas para ${run.body?.totalRows} execuções)`);
check(!JSON.stringify(run.body).includes(`sigilo${rid}`),
  '[api] campo NÃO reportável não vaza no payload do relatório');

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

const abrirViewer = async (page) => {
  await page.goto(`${BASE}/consultas/ver?key=${rkey}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`text=Tabela ${rid}`, { timeout: 25000 });
  await page.waitForTimeout(1000);
};

try {
  // ══════════ WEB 1280 ══════════
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  await login(page);
  await abrirViewer(page);

  const texto = await page.innerText('main');
  check(texto.includes('Caneta; Papel'),
    '[web] a TELA mostra o campo de dentro da lista dinâmica (era invisível antes desta fase)');
  check(texto.includes('2; 5'), '[web] o campo numérico da lista também aparece, ocorrência a ocorrência');
  check(!texto.includes(`sigilo${rid}`), '[web] campo não reportável não aparece na tela');

  // A lista não multiplica linhas: 3 execuções = 3 linhas na tabela. Conta só o
  // tbody VISÍVEL — o viewer tem um segundo tbody oculto, usado na impressão, que
  // dobraria a contagem no DOM sem nada de errado na tela.
  const linhas = await page.locator('table tbody tr:visible').count();
  const rodape = await page.locator('text=/^3 linhas$/').count();
  check(linhas === 3 && rodape > 0,
    `[web] a tabela mostra uma linha por execução (${linhas} visíveis; rodapé "3 linhas": ${rodape > 0})`);

  // Ordenação ascendente pelo campo de lista: quem não tem ocorrência vem primeiro
  // (comportamento de sempre para nulo), e os demais saem pela PRIMEIRA ocorrência —
  // "Caneta; Papel" antes de "Papel", e não pelo texto colado.
  const corpo = await page.locator('table tbody tr:visible').allInnerTexts();
  const iCaneta = corpo.findIndex((t) => t.includes('Caneta'));
  const iPapel = corpo.findIndex((t) => t.includes('Papel') && !t.includes('Caneta'));
  check(iCaneta >= 0 && iPapel >= 0 && iCaneta < iPapel,
    `[web] ordenação usa a 1ª ocorrência da lista (Caneta na linha ${iCaneta + 1}, Papel na ${iPapel + 1})`);

  const kpi = await page.locator(`section:has-text("Total ${rid}")`).first().innerText();
  check(/450/.test(kpi.replace(/\s/g, '')), `[web] KPI soma os valores ("${kpi.replace(/\n/g, ' ').slice(0, 40)}")`);
  check(await page.locator(`section:has-text("Por setor ${rid}") canvas`).count() > 0,
    '[web] o gráfico de pizza renderiza');

  const lw = await medir(page);
  check(!lw.overflows, '[web] viewer sem overflow horizontal');
  check(lw.clipped === 0, `[web] viewer sem controle recortado (${lw.clipped})`);
  await page.screenshot({ path: `${OUT}/projecao-relatorio-web.png`, fullPage: true });

  // ── drill-down pelo segmento do gráfico ──────────────────────────────────
  const canvas = page.locator(`section:has-text("Por setor ${rid}") canvas`).first();
  const box = await canvas.boundingBox();
  if (box) {
    // A pizza é desenhada CENTRADA no canvas; clicar a 35% da largura caía no vazio.
    // Um pouco à direita e acima do centro cai dentro de uma fatia.
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.40);
    await page.waitForTimeout(1500);
    const dialogo = page.locator('[role=dialog]');
    const abriu = await dialogo.count() > 0;
    check(abriu, '[web] clicar no segmento do gráfico abre o detalhamento');
    if (abriu) {
      const det = await dialogo.first().innerText();
      check(/Compras|Obras/.test(det), `[web] o detalhamento traz as linhas do segmento ("${det.replace(/\n/g, ' ').slice(0, 70)}")`);
      await page.screenshot({ path: `${OUT}/projecao-relatorio-drilldown-web.png`, fullPage: false });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // ── exportação ───────────────────────────────────────────────────────────
  // O botão tem ícone + texto ("⤓ CSV"), então um regex ancorado não casa; o papel
  // acessível normaliza o espaço e é o que o usuário enxerga.
  const btnCsv = page.getByRole('button', { name: 'CSV' }).first();
  if (await btnCsv.count() > 0) {
    const espera = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await btnCsv.click();
    const arquivo = await espera;
    check(!!arquivo, `[web] exportação CSV baixa o arquivo (${arquivo ? await arquivo.suggestedFilename() : '—'})`);
    if (arquivo) {
      const caminho = await arquivo.path();
      const conteudo = caminho ? (await import('node:fs')).readFileSync(caminho, 'utf8') : '';
      check(conteudo.includes('Caneta; Papel'),
        '[web] o CSV exportado leva o campo da lista com as ocorrências');
    }
  } else {
    check(false, '[web] botão de exportação CSV não encontrado no viewer');
  }
  await ctx.close();

  // ══════════ MOBILE 375 ══════════
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => console.log('pageerror(mobile):', e.message.slice(0, 160)));
  await login(m);
  await abrirViewer(m);

  const textoM = await m.innerText('main');
  check(textoM.includes('Caneta; Papel'), '[mobile] o campo de dentro da lista aparece no celular');
  check(!textoM.includes(`sigilo${rid}`), '[mobile] campo não reportável não aparece');
  const lm = await medir(m);
  check(!lm.overflows, '[mobile] viewer sem overflow horizontal');
  check(lm.clipped === 0, `[mobile] viewer sem controle recortado (${lm.clipped})`);
  await m.screenshot({ path: `${OUT}/projecao-relatorio-mobile.png`, fullPage: true });
} finally {
  await browser.close();
}

// limpa a fixture desta rodada (o processo fica: versões são histórico do modelador)
await api(token, `/api/v1/reports/${rkey}`, 'DELETE');

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

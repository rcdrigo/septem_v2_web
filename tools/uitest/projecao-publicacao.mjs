// Fase 5 do PLANO_PROJECAO_FORMULARIO — compatibilidade na PUBLICAÇÃO, na tela.
// Sobre um processo com DUAS listas dinâmicas cujos filhos têm a mesma key
// (`itens[].produto` e `outros[].produto`), prova no navegador real:
//   1. a coluna do CONTAINER da lista ("Itens") não é mais oferecida no builder —
//      ela só podia vir vazia, porque a projeção guarda folhas (decisão do dono);
//   2. relatório LEGADO que referencia a key solta de um campo inequívoco publica
//      sozinho, migrando para o caminho (5.1);
//   3. key AMBÍGUA para a publicação e abre o diálogo pedindo de qual lista vem o
//      campo; escolher e confirmar publica e grava o caminho ESCOLHIDO (5.2);
//   4. agrupar/somar por campo que se repete a cada item é RECUSADO com mensagem
//      legível, sem 500 (5.3) — antes a soma descartava a linha em silêncio;
//   5. publicar reidrata o editor: salvar rascunho depois NÃO desfaz a migração.
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
const pkey = `projecao_pub_${rid}`;

const FORM = JSON.stringify({
  type: 'default', schemaVersion: 17,
  components: [
    { type: 'textfield', key: 'nome', label: 'Nome do solicitante' },
    { type: 'dynamiclist', key: 'itens', label: 'Itens', components: [
      { type: 'textfield', key: 'produto', label: 'Produto' },
      { type: 'number', key: 'quantidade', label: 'Quantidade' }] },
    { type: 'dynamiclist', key: 'outros', label: 'Outros itens', components: [
      { type: 'textfield', key: 'produto', label: 'Produto (outros)' }] },
  ],
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${rid}" targetNamespace="x">
  <bpmn:process id="P_${rid}" name="Publicacao F5 ${rid}" isExecutable="true">
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
await api(token, '/api/v1/workflow/instances', 'POST', {
  key: pkey, data: { nome: 'Ana', itens: [{ produto: 'Caneta', quantidade: 2 }, { produto: 'Papel', quantidade: 5 }] },
});

/** Cria um relatório por processo com a definição dada. Devolve a key. */
const criarRelatorio = async (nome, definicao) => {
  const r = await api(token, '/api/v1/reports/', 'POST', {
    name: nome, sourceType: 'process', processKey: pkey, definitionJson: JSON.stringify(definicao),
  });
  check(r.status === 201, `[setup] relatório "${nome}" criado (${r.status})`);
  return r.body.key;
};

const criados = [];
const rInequivoco = await criarRelatorio(`F5 inequivoco ${rid}`, {
  blocks: [{ id: 't', type: 'table', columns: [{ key: 'quantidade' }] }],
});
const rAmbiguo = await criarRelatorio(`F5 ambiguo ${rid}`, {
  blocks: [{ id: 't', type: 'table', columns: [{ key: 'produto' }] }],
});
const rRepetido = await criarRelatorio(`F5 repetido ${rid}`, {
  blocks: [{ id: 'b', type: 'bars', agg: 'count', groupBy: 'itens[].produto' }],
});
const rVitrine = await criarRelatorio(`F5 vitrine ${rid}`, { blocks: [] });
criados.push(rInequivoco, rAmbiguo, rRepetido, rVitrine);

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

const abrirBuilder = async (page, rkey) => {
  await page.goto(`${BASE}/relatorios/editar?key=${rkey}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Origem dos dados', { timeout: 20000 });
};

const publicar = async (page) => {
  await page.getByRole('button', { name: 'Publicar' }).click();
  await page.waitForTimeout(1500);
};

try {
  // ══════════ WEB 1280 ══════════
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  await login(page);

  // ── 1. a coluna do CONTAINER saiu do builder ──────────────────────────────
  await abrirBuilder(page, rVitrine);
  await page.locator('nav button', { hasText: 'Origem' }).click();
  await page.waitForTimeout(800);
  const origem = await page.innerText('main');
  check(origem.includes('itens[].produto') && origem.includes('itens[].quantidade'),
    '[web] os campos FILHOS da lista continuam oferecidos (é onde o dado está)');
  // A tabela mostra "Rótulo (chave)" e a chave FECHA a célula (vem um \t depois).
  // Sem essa âncora o check dá falso positivo duas vezes: o rótulo do GRUPO é
  // "Itens" e o rótulo de um campo é literalmente "Produto (outros)".
  check(!/\((itens|outros)\)[\t\n]/.test(origem),
    '[web] a coluna do CONTAINER da lista não é mais oferecida (só podia vir vazia)');
  const chavesSchema = ((await api(token, `/api/v1/reports/${rVitrine}/source-metadata`)).body?.columns ?? [])
    .map((c) => c.key);
  check(!chavesSchema.includes('itens') && !chavesSchema.includes('outros'),
    `[web] e o schema da origem também não traz o container (${chavesSchema.filter((k) => !k.startsWith('_')).join(', ')})`);
  await page.screenshot({ path: `${OUT}/projecao-publicacao-origem-web.png`, fullPage: true });

  // ── 2. legado inequívoco publica sozinho, migrando a key para o caminho ───
  await abrirBuilder(page, rInequivoco);
  await publicar(page);
  const okInequivoco = await page.locator('text=Relatório publicado').count();
  check(okInequivoco > 0, '[web] relatório legado com key inequívoca publica sozinho');
  const defInequivoco = (await api(token, `/api/v1/reports/${rInequivoco}`)).body?.definitionJson ?? '';
  check(defInequivoco.includes('itens[].quantidade'),
    '[web] a key solta "quantidade" foi migrada para o CAMINHO na publicação');

  // ── 3. key ambígua PARA e pede a escolha ──────────────────────────────────
  await abrirBuilder(page, rAmbiguo);
  await publicar(page);
  const dlg = page.locator('[role=dialog]');
  check(await dlg.count() > 0, '[web] key ambígua abre o diálogo em vez de publicar no chute');
  const textoDlg = await dlg.innerText().catch(() => '');
  check(textoDlg.includes('produto'), '[web] o diálogo diz QUAL campo está ambíguo');
  const opcoes = await dlg.locator('select option').evaluateAll((os) => os.map((o) => o.value));
  check(opcoes.includes('itens[].produto') && opcoes.includes('outros[].produto'),
    `[web] o diálogo oferece os DOIS caminhos candidatos (${opcoes.join(', ')})`);
  await page.screenshot({ path: `${OUT}/projecao-publicacao-escolha-web.png`, fullPage: false });

  const naoPublicou = (await api(token, `/api/v1/reports/${rAmbiguo}`)).body?.status;
  check(naoPublicou === 'draft', `[web] enquanto não escolhe, nada é publicado (status=${naoPublicou})`);

  const lwDlg = await medir(page);
  check(!lwDlg.overflows, '[web] diálogo de escolha sem overflow horizontal');
  check(lwDlg.clipped === 0, `[web] diálogo de escolha sem controle recortado (${lwDlg.clipped})`);

  // escolhe a SEGUNDA lista de propósito: se o sistema chutasse, chutaria a 1ª
  await dlg.locator('select').selectOption('outros[].produto');
  await dlg.getByRole('button', { name: 'Publicar com esta escolha' }).click();
  await page.waitForTimeout(1800);
  const depois = (await api(token, `/api/v1/reports/${rAmbiguo}`)).body ?? {};
  check(depois.status === 'published', `[web] com a escolha, publica (status=${depois.status})`);
  check((depois.definitionJson ?? '').includes('outros[].produto')
    && !(depois.definitionJson ?? '').includes('itens[].produto'),
    '[web] gravou o caminho ESCOLHIDO pelo usuário, não o primeiro da lista');

  // ── 5. o editor reidrata: salvar depois não desfaz a migração ─────────────
  await page.locator('button', { hasText: 'Salvar rascunho' }).click();
  await page.waitForTimeout(1500);
  const depoisDeSalvar = (await api(token, `/api/v1/reports/${rAmbiguo}`)).body?.definitionJson ?? '';
  check(depoisDeSalvar.includes('outros[].produto'),
    '[web] salvar rascunho depois de publicar NÃO devolve a key ambígua (editor reidratado)');

  // ── 4. campo repetido como agrupamento é recusado com mensagem legível ────
  await abrirBuilder(page, rRepetido);
  await publicar(page);
  const dlgRec = page.locator('[role=dialog]');
  check(await dlgRec.count() > 0, '[web] agrupar por campo de lista abre a explicação da recusa');
  const textoRec = await dlgRec.innerText().catch(() => '');
  check(textoRec.includes('itens[].produto'), '[web] a recusa diz QUAL campo é o problema');
  check(/se repete/.test(textoRec), '[web] a recusa explica POR QUE (o campo se repete a cada item)');
  check(!/(500|Internal Server Error)/.test(textoRec), '[web] recusa é mensagem de negócio, não erro de servidor');
  const aindaRascunho = (await api(token, `/api/v1/reports/${rRepetido}`)).body?.status;
  check(aindaRascunho === 'draft', `[web] relatório recusado continua rascunho (status=${aindaRascunho})`);
  await page.screenshot({ path: `${OUT}/projecao-publicacao-recusa-web.png`, fullPage: false });

  const lwRec = await medir(page);
  check(!lwRec.overflows, '[web] diálogo de recusa sem overflow horizontal');
  check(lwRec.clipped === 0, `[web] diálogo de recusa sem controle recortado (${lwRec.clipped})`);

  // ── 6. costura: o botão "publicar" da LISTA usa outra rota (PATCH status) ──
  // Ela também precisa migrar as chaves e, quando não dá para publicar, dizer ao
  // usuário onde resolver — o diálogo de escolha mora no editor, não aqui.
  await page.goto(`${BASE}/admin/relatorios`, { waitUntil: 'networkidle' });
  await page.fill('input[type=search]', `F5 repetido ${rid}`);
  await page.waitForTimeout(1200);
  const linha = page.locator('tr', { hasText: `F5 repetido ${rid}` }).first();
  check(await linha.count() > 0, '[web] o relatório recusado aparece na lista do admin');
  await linha.locator('button[title="Publicar"]').click();
  await page.waitForTimeout(1500);
  const aviso = await page.innerText('body');
  check(/valor único por processo/.test(aviso),
    '[web] publicar pela LISTA explica o motivo (mesma regra da rota do editor)');
  check(/Abra o editor/.test(aviso),
    '[web] e diz ONDE resolver, em vez de deixar o usuário sem saída');
  await page.screenshot({ path: `${OUT}/projecao-publicacao-lista-web.png`, fullPage: false });
  await ctx.close();

  // ══════════ MOBILE 375 ══════════
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => console.log('pageerror(mobile):', e.message.slice(0, 160)));
  await login(m);

  // um relatório ambíguo novo, para repetir o fluxo inteiro no celular
  const rAmbiguoMob = await criarRelatorio(`F5 ambiguo mob ${rid}`, {
    blocks: [{ id: 't', type: 'table', columns: [{ key: 'produto' }] }],
  });
  criados.push(rAmbiguoMob);

  await abrirBuilder(m, rAmbiguoMob);
  await publicar(m);
  const dlgM = m.locator('[role=dialog]');
  check(await dlgM.count() > 0, '[mobile] key ambígua abre o diálogo de escolha');
  const opcoesM = await dlgM.locator('select option').evaluateAll((os) => os.map((o) => o.value));
  check(opcoesM.includes('itens[].produto') && opcoesM.includes('outros[].produto'),
    '[mobile] os dois caminhos candidatos aparecem');
  const lm = await medir(m);
  check(!lm.overflows, '[mobile] diálogo de escolha sem overflow horizontal');
  check(lm.clipped === 0, `[mobile] diálogo de escolha sem controle recortado (${lm.clipped})`);
  await m.screenshot({ path: `${OUT}/projecao-publicacao-escolha-mobile.png`, fullPage: false });

  await dlgM.locator('select').selectOption('itens[].produto');
  await dlgM.getByRole('button', { name: 'Publicar com esta escolha' }).click();
  await m.waitForTimeout(1800);
  const mobDepois = (await api(token, `/api/v1/reports/${rAmbiguoMob}`)).body ?? {};
  check(mobDepois.status === 'published', `[mobile] com a escolha, publica (status=${mobDepois.status})`);
  check((mobDepois.definitionJson ?? '').includes('itens[].produto'),
    '[mobile] gravou o caminho escolhido no celular');

  // o relatório escolhido roda de verdade e traz o valor da lista
  const run = await api(token, `/api/v1/reports/${mobDepois.key}/run`, 'POST', { refresh: true });
  const linhas = JSON.stringify(run.body?.blocks ?? []);
  check(run.status === 200, `[mobile] o relatório publicado pela escolha executa (${run.status})`);
  check(linhas.includes('Caneta'),
    '[mobile] e traz o valor do campo de lista escolhido (efeito, não só o salvar)');
} finally {
  await browser.close();
}

// limpa as fixtures desta rodada (o processo fica: versões são histórico do modelador)
for (const k of criados) await api(token, `/api/v1/reports/${k}`, 'DELETE');

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Fase 2 do PLANO_PROJECAO_FORMULARIO — DUAL-WRITE pela tela.
//
// Prova que os quatro caminhos de escrita do formulário gravam, na MESMA
// transação, o JSON canônico (`flow_executions.FormData`) e a projeção
// consultável (`flow_execution_form_values`):
//   1. iniciar a requisição pela tela, com lista dinâmica de 2 itens;
//   2. salvar RASCUNHO com um campo só — sem apagar o que ninguém tocou;
//   3. mexer na lista (remover um item) — a subárvore é substituída em bloco;
//   4. concluir a tarefa;
//   5. editar pelo relatório da solicitação.
//
// A projeção ainda não tem API pública (o leitor é a Fase 4), então a evidência é
// lida direto do banco de DEV com `psql` — SELECT apenas. Se o psql não estiver
// disponível, os checks de projeção falham com a razão à mostra, em vez de passar
// em falso.
//
// Web 1280×900 e mobile 375×812, com overflow/clipped medidos no DOM.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const DB = process.env.SEPTEM_TENANT_DB || 'db_prefeitura_x';
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

// ── leitura da projeção (somente SELECT) ────────────────────────────────────
const sql = (q) => execFileSync('psql', ['-h', 'localhost', '-U', 'postgres', '-d', DB, '-tAc', q],
  { env: { ...process.env, PGPASSWORD: 'postgres' }, encoding: 'utf8' });

/** Projeção de uma execução como { 'caminho@ocorrência': valor }. */
const projecao = (execId) => {
  const linhas = sql(`
    SELECT v."FieldPath" || '@' || v."OccurrencePath" || '~~~' || v."Value"
      FROM flow_execution_form_values v
      JOIN flow_executions e ON e."Id" = v."ExecutionId"
     WHERE e."PublicId" = '${execId}'
     ORDER BY 1;`).trim();
  const mapa = {};
  for (const l of linhas ? linhas.split('\n') : []) {
    const i = l.indexOf('~~~');
    mapa[l.slice(0, i)] = l.slice(i + 3);
  }
  return mapa;
};
const versaoProjecao = (execId) =>
  sql(`SELECT "FormDataProjectionVersion" FROM flow_executions WHERE "PublicId" = '${execId}';`).trim();

try {
  sql('SELECT 1;');
} catch (e) {
  bad.push(`[setup] não consegui ler a projeção no banco de dev (${DB}): ${e.message.split('\n')[0]}`);
  ok.forEach((m) => console.log('✓ ' + m));
  bad.forEach((m) => console.log('✗ ' + m));
  console.log(`\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
  process.exit(1);
}

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;
const rid = Math.floor(Math.random() * 1e9);
const pkey = `projecao_escrita_${rid}`;

const FORM = JSON.stringify({
  type: 'default', schemaVersion: 17,
  components: [
    { type: 'textfield', key: 'nome', label: 'Nome do solicitante' },
    { type: 'textfield', key: 'observacao', label: 'Observacao' },
    { type: 'dynamiclist', key: 'itens', label: 'Itens', components: [
      { type: 'textfield', key: 'produto', label: 'Produto' },
      { type: 'number', key: 'quantidade', label: 'Quantidade' }] },
  ],
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${rid}" targetNamespace="x">
  <bpmn:process id="P_${rid}" name="Projecao Escrita ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig status="published" accessRules='[{"type":"all","action":"allow","capability":"view"},{"type":"all","action":"allow","capability":"edit"}]' />
      <septem:formSchema>${FORM.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Conferir ${rid}">
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

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

const linhasDa = (raiz, key) => raiz.locator(`[data-testid=lista-dinamica][data-lista="${key}"] > div > [data-testid=lista-item]`);
const addItem = async (page, raiz, key) => {
  const antes = await linhasDa(raiz, key).count();
  await raiz.locator(`[data-testid=lista-dinamica][data-lista="${key}"] > header [data-testid=lista-adicionar]`).first().click();
  await page.waitForTimeout(150);
  return linhasDa(raiz, key).nth(antes);
};

// Ação da tarefa (Salvar / Concluir). No desktop os botões ficam no <footer>; abaixo
// de 640px o rodapé só mostra "Botões de conclusão", e as ações — inclusive Salvar —
// vivem no bottom-sheet, que é um <dialog> renderizado por portal FORA do footer.
// Caminho real do usuário nos dois tamanhos.
const acao = async (page, nome) => {
  const abrir = page.getByRole('button', { name: /Botões de conclusão/ });
  if (await abrir.isVisible().catch(() => false)) {
    await abrir.click();
    await page.waitForTimeout(400);
    await page.locator('dialog [data-action] button', { hasText: nome }).first().click();
  } else {
    await page.locator('footer button', { hasText: nome }).first().click();
  }
  await page.waitForTimeout(300);
};

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

/** Preenche e envia o formulário do serviço; devolve o id da execução criada. */
const iniciarPelaTela = async (page, view, sufixo, itens) => {
  await page.goto(`${BASE}/servico/${pkey}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=lista-dinamica]', { timeout: 20000 });

  await page.locator('main input[type=text]').nth(0).fill(`Solicitante ${sufixo}`);
  await page.locator('main input[type=text]').nth(1).fill(`Observacao ${sufixo}`);
  const main = page.locator('main');
  for (const [prod, qtd] of itens) {
    const row = await addItem(page, main, 'itens');
    await row.locator('input[type=text]').first().fill(prod);
    await row.locator('input[type=number]').first().fill(qtd);
  }

  const m = await medir(page);
  check(!m.overflows, `[${view}] formulário do serviço sem overflow horizontal`);
  check(m.clipped === 0, `[${view}] formulário do serviço sem controle recortado (${m.clipped})`);
  await page.screenshot({ path: `${OUT}/projecao-escrita-form-${view}.png`, fullPage: true });

  const sheet = page.getByRole('button', { name: /Botões de conclusão/ });
  if (await sheet.isVisible().catch(() => false)) { await sheet.click(); await page.waitForTimeout(400); }
  await page.getByRole('button', { name: /^Iniciar$/ }).first().click();
  await page.waitForSelector('text=Solicitação iniciada com sucesso', { timeout: 25000 });

  const insts = await api(token, '/api/v1/workflow/instances?page=1&pageSize=50');
  const minhas = (insts.body?.items ?? []).filter((i) => i.processKey === pkey);
  return minhas[0]?.id;
};

/** Compara, campo a campo, o FormData da API com o que está na projeção. */
const conferirParidade = async (execId, view, rotulo) => {
  const det = await api(token, `/api/v1/workflow/instances/${execId}`);
  const data = det.body?.data ?? {};
  const p = projecao(execId);
  const divergencias = [];
  let comparados = 0;
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        for (const [ck, cv] of Object.entries(item ?? {})) {
          if (cv === null || cv === undefined) continue;
          const chave = `${k}[].${ck}@${i}`;
          comparados++;
          if (p[chave] !== String(cv)) divergencias.push(`${chave}: projeção="${p[chave]}" json="${cv}"`);
        }
      });
    } else {
      // Objeto de estrutura desconhecida vira UMA linha com o JSON compacto.
      const esperado = typeof v === 'object' ? JSON.stringify(v) : String(v);
      comparados++;
      if (p[`${k}@`] !== esperado) divergencias.push(`${k}: projeção="${p[`${k}@`]}" json="${esperado}"`);
    }
  }
  // Sem esta guarda o check passaria EM FALSO caso o detalhe viesse vazio: zero
  // campos comparados = zero divergências. Compara também o total de linhas, para
  // pegar sobra na projeção (valor que o JSON não tem mais).
  check(comparados > 0 && divergencias.length === 0 && Object.keys(p).length === comparados,
    `[${view}] paridade JSON × projeção ${rotulo} (${comparados} campos, ${Object.keys(p).length} linhas)` +
    (divergencias.length ? ': ' + divergencias.join(' | ') : ''));
};

try {
  // ══════════════ WEB 1280 ══════════════
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  await login(page);

  // ── 2.7 iniciar ──────────────────────────────────────────────────────────
  const execId = await iniciarPelaTela(page, 'web', 'web', [['Caneta', '2'], ['Papel', '5']]);
  check(!!execId, '[web] requisição iniciada pela tela com 2 itens na lista');

  const p1 = projecao(execId);
  check(p1['nome@'] === 'Solicitante web', `[web] o campo simples nasce projetado ("${p1['nome@']}")`);
  check(p1['itens[].produto@0'] === 'Caneta' && p1['itens[].produto@1'] === 'Papel',
    '[web] as DUAS ocorrências da lista são projetadas sem se sobrescrever');
  check(p1['itens[].quantidade@0'] === '2' && p1['itens[].quantidade@1'] === '5',
    '[web] campos do mesmo item compartilham a ocorrência (produto e quantidade lado a lado)');
  check(versaoProjecao(execId) === '1', `[web] execução marcada com a versão 1 da projeção (${versaoProjecao(execId)})`);
  await conferirParidade(execId, 'web', 'ao iniciar');

  // ── 2.8 salvar rascunho: upsert só do que foi enviado ────────────────────
  const det = await api(token, `/api/v1/workflow/instances/${execId}`);
  const taskId = (det.body?.tasks ?? []).find((t) => t.status === 'pendente')?.id;
  check(!!taskId, '[web] tarefa pendente encontrada para o rascunho');

  await page.goto(`${BASE}/tarefa/${taskId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=lista-dinamica]', { timeout: 20000 });
  await page.locator('main input[type=text]').nth(1).fill('Observacao editada');
  await acao(page, 'Salvar');
  await page.waitForFunction(() => document.body.innerText.includes('Rascunho salvo'), { timeout: 12000 })
    .then(() => true).catch(() => false);
  await page.waitForTimeout(600);

  const p2 = projecao(execId);
  check(p2['observacao@'] === 'Observacao editada', `[web] rascunho atualiza o campo enviado ("${p2['observacao@']}")`);
  check(p2['nome@'] === 'Solicitante web', '[web] o campo INTOCADO sobrevive ao upsert parcial (na projeção)');
  check(p2['itens[].produto@1'] === 'Papel', '[web] a lista intocada sobrevive ao upsert parcial');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=lista-dinamica]', { timeout: 20000 });
  check(await page.locator('main input[type=text]').nth(0).inputValue() === 'Solicitante web',
    '[web] e o campo intocado continua na TELA ao reabrir a tarefa');

  // ── lista: remover um item substitui a subárvore em bloco ────────────────
  await linhasDa(page.locator('main'), 'itens').nth(0).getByRole('button', { name: 'Remover item' }).click();
  await page.waitForTimeout(300);
  await acao(page, 'Salvar');
  await page.waitForTimeout(1500);

  const p3 = projecao(execId);
  check(p3['itens[].produto@0'] === 'Papel', `[web] remover o 1º item reindexa a lista na projeção ("${p3['itens[].produto@0']}")`);
  check(p3['itens[].produto@1'] === undefined, '[web] a ocorrência que sobrava foi REMOVIDA (subárvore substituída em bloco)');
  await conferirParidade(execId, 'web', 'após mexer na lista');

  // ── 2.9 concluir ─────────────────────────────────────────────────────────
  await acao(page, 'Concluir conferencia');
  await page.waitForTimeout(2500);
  const p4 = projecao(execId);
  check(p4['nome@'] === 'Solicitante web' && p4['itens[].produto@0'] === 'Papel',
    '[web] concluir a tarefa mantém a projeção coerente');
  await conferirParidade(execId, 'web', 'após concluir');

  // ── 2.10 editar pelo relatório da solicitação ────────────────────────────
  await page.goto(`${BASE}/solicitacao/${execId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1', { timeout: 20000 });
  await page.waitForTimeout(1200);
  const mRel = await medir(page);
  check(!mRel.overflows, '[web] relatório da solicitação sem overflow horizontal');
  check(mRel.clipped === 0, `[web] relatório da solicitação sem controle recortado (${mRel.clipped})`);

  await page.getByRole('button', { name: 'Editar' }).first().click();
  await page.waitForTimeout(800);
  const campoObs = page.locator('input[type=text]').filter({ hasNot: page.locator('[disabled]') })
    .locator('visible=true');
  await campoObs.nth(1).fill('Corrigido pelo relatorio');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.waitForTimeout(2000);

  const p5 = projecao(execId);
  check(p5['observacao@'] === 'Corrigido pelo relatorio',
    `[web] editar pelo relatório projeta o valor novo ("${p5['observacao@']}")`);
  check(p5['nome@'] === 'Solicitante web', '[web] a edição pelo relatório não derrubou os outros campos');
  await conferirParidade(execId, 'web', 'após editar pelo relatório');
  await page.screenshot({ path: `${OUT}/projecao-escrita-solicitacao-web.png`, fullPage: true });
  await ctx.close();

  // ══════════════ MOBILE 375 — percurso do zero ══════════════
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => console.log('pageerror(mobile):', e.message.slice(0, 160)));
  await login(m);

  const execMob = await iniciarPelaTela(m, 'mobile', 'mob', [['Caderno', '3']]);
  check(!!execMob && execMob !== execId, '[mobile] segunda requisição iniciada pela tela');

  const pm = projecao(execMob);
  check(pm['nome@'] === 'Solicitante mob' && pm['itens[].produto@0'] === 'Caderno',
    '[mobile] a projeção nasce junto com o JSON também no celular');
  check(versaoProjecao(execMob) === '1', '[mobile] execução do celular marcada com a versão 1');
  await conferirParidade(execMob, 'mobile', 'ao iniciar');

  const detM = await api(token, `/api/v1/workflow/instances/${execMob}`);
  const taskM = (detM.body?.tasks ?? []).find((t) => t.status === 'pendente')?.id;
  await m.goto(`${BASE}/tarefa/${taskM}`, { waitUntil: 'networkidle' });
  await m.waitForSelector('[data-testid=lista-dinamica]', { timeout: 20000 });
  const mt = await medir(m);
  check(!mt.overflows, '[mobile] tela da tarefa sem overflow horizontal');
  check(mt.clipped === 0, `[mobile] tela da tarefa sem controle recortado (${mt.clipped})`);
  await m.locator('main input[type=text]').nth(1).fill('Obs do celular');
  await acao(m, 'Salvar');
  await m.waitForTimeout(1800);
  await m.screenshot({ path: `${OUT}/projecao-escrita-tarefa-mobile.png`, fullPage: true });

  const pm2 = projecao(execMob);
  check(pm2['observacao@'] === 'Obs do celular', `[mobile] rascunho do celular chega à projeção ("${pm2['observacao@']}")`);
  check(pm2['nome@'] === 'Solicitante mob', '[mobile] campo intocado preservado no upsert parcial');
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

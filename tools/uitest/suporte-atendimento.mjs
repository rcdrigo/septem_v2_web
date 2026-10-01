// Fase 5 do plano 26_09 — o atendimento, pela tela (SUP-03/04/06/08; aceites S-A02, S-A10–S-A12).
//
// O que esta suíte prova, e por quê:
//  (a) o ciclo inteiro pela TELA da área central: a fila de triagem mostra o chamado COM o nome
//      do cliente → analisar → classificar → encaminhar → criar tarefa → iniciar → concluir (com
//      o aviso de que descrição e horas ficam públicas) → solicitar retorno com motivo → retomar →
//      resolver. Cada passo é medido pelo EFEITO (estado, totais), não pelo clique;
//  (b) os botões vêm do SERVIDOR (`actions`, `canStart`…): a sonda confere que só aparece o que
//      a tabela SUP-03 permite naquele estado;
//  (c) o requisitante vê "Sem estimativa", as horas executadas e cobráveis em h/min, e NADA do
//      painel de atendimento nem das tarefas internas (S-A12);
//  (d) a transferência exige destino para cada tarefa aberta — o botão só habilita com todos;
//  (e) "Fila da equipe" aparece no menu de quem participa de equipe, e só de quem participa;
//  (f) 1280 e 375 sem overflow horizontal.
import { chromium } from 'playwright-core';
import { checarResponsivo, checarAcessibilidade } from './lib-responsivo.mjs';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const CENTRAL_EMAIL = 'super@septem.local';
const CENTRAL_SENHA = 'super123';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (t, p, m = 'GET', b, extra = {}) => {
  const r = await fetch(API + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

/** Token central pela API (senha + 2FA pela caixa de dev) — só para PREPARAR o cenário. */
async function tokenCentral() {
  await fetch(`${API}/api/v1/platform/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CENTRAL_EMAIL, password: CENTRAL_SENHA }),
  });
  const code = (await (await fetch(`${API}/api/v1/platform/auth/dev/last-code?email=${encodeURIComponent(CENTRAL_EMAIL)}`)).json()).code;
  const r = await fetch(`${API}/api/v1/platform/auth/2fa`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CENTRAL_EMAIL, code }),
  });
  return (await r.json()).accessToken;
}
const central = (t, p, m = 'GET', b) => fetch(`${API}/api/v1/platform${p}`, {
  method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
  body: b ? JSON.stringify(b) : undefined,
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const rid = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
const admin = (await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' })).body.accessToken;

// Requisitante sem nenhum papel de atendimento.
const perfil = await api(admin, '/api/v1/access-profiles', 'POST', { name: `Req F5 ${rid}`, permissions: ['workflow:read'] });
const req = await api(admin, '/api/v1/users', 'POST', {
  name: `Requisitante F5 ${rid}`, email: `req5-${rid}@prefeitura-x.local`, isInternal: true, accessProfileIds: [perfil.body.id],
});
const tokenReq = (await api(null, '/api/v1/auth/login', 'POST', { identifier: `req5-${rid}@prefeitura-x.local`, password: req.body.initialPassword })).body.accessToken;

// Equipe da Septem com o próprio super admin dentro (ele é triagem E responsável neste cenário).
const tc = await tokenCentral();
const eu = (await central(tc, '/me')).body;
const equipeA = (await central(tc, '/support/teams/', 'POST', { name: `Atendimento F5 ${rid}` })).body;
await central(tc, `/support/teams/${equipeA.id}/members/${eu.id}`, 'PUT');
const equipeB = (await central(tc, '/support/teams/', 'POST', { name: `Segundo nível F5 ${rid}` })).body;
await central(tc, `/support/teams/${equipeB.id}/members/${eu.id}`, 'PUT');

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true });

async function entrarCentral(page, destino) {
  await page.goto(BASE + destino, { waitUntil: 'networkidle' });
  await page.fill('input[name=email]', CENTRAL_EMAIL);
  await page.fill('input[name=password]', CENTRAL_SENHA);
  await page.click('button[type=submit]');
  await page.waitForSelector('input[name=code]', { timeout: 10000 });
  const code = await page.evaluate(async (e) => (await (await fetch(`/api/v1/platform/auth/dev/last-code?email=${encodeURIComponent(e)}`)).json()).code, CENTRAL_EMAIL);
  await page.fill('input[name=code]', code);
  await page.click('button[type=submit]');
  // `platform-sair`, não `platform-identidade`: o nome fica `hidden` abaixo de 640px, de propósito,
  // e esperar por ele no 375 é esperar por algo que o design esconde.
  await page.waitForSelector('[data-testid=platform-sair]', { timeout: 20000 });
}

async function entrarAmbiente(page, email, senha) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', email);
  await page.fill('input[name=password]', senha);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}

/** Espera o botão de transição que o SERVIDOR ofereceu e clica. */
async function transicao(page, acao) {
  const botao = page.locator(`[data-testid=transicao-${acao}]`);
  await botao.waitFor({ timeout: 15000 });
  await botao.click();
}

/** Espera o estado do cabeçalho mudar para o rótulo esperado (efeito, não clique). */
const esperarEstado = (page, rotulo) => page.waitForFunction(
  (r) => document.querySelector('[data-testid=detalhe-estado]')?.textContent?.trim() === r, rotulo, { timeout: 15000 });

const acoesNaTela = (page) => page.locator('[data-testid=transicoes] button').evaluateAll(
  (bs) => bs.map((b) => b.getAttribute('data-testid')?.replace('transicao-', '')).sort());

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const chamado = (await api(tokenReq, '/api/v1/support/tickets', 'POST', {
      subject: `Emissão travada ${vp.n} ${rid}`, description: 'A guia não sai.', nature: 'bug',
    })).body;

    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    // ── 1) Fila de triagem com cliente inequívoco ───────────────────────────
    await entrarCentral(page, '/platform/support/triage');
    await page.goto(BASE + '/platform/support/triage', { waitUntil: 'networkidle' });
    await page.fill('[data-testid=busca-chamados]', chamado.protocol);
    const linha = page.locator('[data-testid=chamado-linha]', { hasText: chamado.protocol }).first();
    await linha.waitFor({ timeout: 15000 });
    const cliente = (await linha.locator('[data-testid=chamado-cliente]').innerText()).trim();
    check(cliente.length > 0 && cliente !== 'Cliente não identificado',
      `[${vp.n}] a fila de triagem mostra o CLIENTE do chamado (${cliente})`);
    await linha.click();
    await page.waitForSelector('[data-testid=painel-atendimento]', { timeout: 15000 });

    // ── 2) Só as ações que a tabela permite: aberto → só "analisar" ───────────
    check(JSON.stringify(await acoesNaTela(page)) === JSON.stringify(['analyze']),
      `[${vp.n}] chamado aberto oferece só "Iniciar análise" (${JSON.stringify(await acoesNaTela(page))})`);
    await transicao(page, 'analyze');
    await esperarEstado(page, 'Em análise');
    check(true, `[${vp.n}] analisar muda o estado para "Em análise"`);

    // ── 3) Classificar ────────────────────────────────────────────────────────
    await page.selectOption('[data-testid=prioridade]', 'high');
    await page.click('[data-testid=salvar-classificacao]');
    await page.waitForFunction(() => document.body.innerText.includes('Prioridade Alta'), null, { timeout: 15000 });
    check(true, `[${vp.n}] a classificação vira "Prioridade Alta" no cabeçalho`);

    // ── 4) Encaminhar para a equipe A ─────────────────────────────────────────
    await page.click('[data-testid=abrir-transferencia]');
    await page.waitForSelector('[data-testid=dialogo-transferencia]');
    await page.selectOption('[data-testid=transferir-equipe]', equipeA.id);
    await page.selectOption('[data-testid=transferir-dono]', eu.id);
    await page.click('[data-testid=confirmar-transferencia]');
    await page.waitForFunction((n) => document.querySelector('[data-testid=equipe-atual]')?.textContent?.includes(n),
      equipeA.name, { timeout: 15000 });
    check(true, `[${vp.n}] encaminha para a equipe e mostra equipe e responsável`);

    // ── 5) Tarefa: criar → iniciar → concluir com o aviso público ─────────────
    await page.click('[data-testid=nova-tarefa]');
    await page.waitForSelector('[data-testid=form-tarefa]');
    await page.fill('[data-testid=form-tarefa] input[name=title]', `Corrigir emissão ${vp.n}`);
    await page.fill('[data-testid=form-tarefa] textarea[name=description]', 'Ajustar a validação do formulário.');
    await page.selectOption('[data-testid=form-tarefa] select[name=assignee]', eu.id);
    await page.selectOption('[data-testid=form-tarefa] select[name=category]', 'development');
    await page.click('[data-testid=criar-tarefa]');
    const tarefa = page.locator('[data-testid=tarefa]', { hasText: `Corrigir emissão ${vp.n}` }).first();
    await tarefa.waitFor({ timeout: 15000 });

    await tarefa.locator('[data-testid=iniciar-tarefa]').click();
    await page.waitForFunction((t) => [...document.querySelectorAll('[data-testid=tarefa]')]
      .some((el) => el.textContent.includes(t) && el.textContent.includes('Em execução')), `Corrigir emissão ${vp.n}`, { timeout: 15000 });
    check(true, `[${vp.n}] a tarefa inicia pelo botão que o servidor ofereceu`);

    await tarefa.locator('[data-testid=concluir-tarefa]').click();
    await page.waitForSelector('[data-testid=form-concluir]');
    check((await page.locator('[data-testid=aviso-publico]').innerText()).includes('visíveis para o requisitante'),
      `[${vp.n}] concluir AVISA que descrição e horas ficam públicas`);
    // Negativo não passa (a tela mostra e o botão trava).
    await page.fill('[data-testid=form-concluir] textarea[name=activityDescription]', 'Validação corrigida e testada.');
    await page.fill('[data-testid=form-concluir] input[name=durationMinutes]', '-5');
    check(await page.locator('[data-testid=erro-negativo]').count() === 1
      && !(await page.locator('[data-testid=confirmar-concluir]').isEnabled()),
      `[${vp.n}] duração negativa é bloqueada`);
    await page.fill('[data-testid=form-concluir] input[name=durationMinutes]', '90');
    await page.click('[data-testid=confirmar-concluir]');
    await page.waitForFunction(() => document.querySelector('[data-testid=total-executado]')?.textContent?.trim() === '1 h 30 min',
      null, { timeout: 15000 });
    check((await page.locator('[data-testid=total-cobravel]').innerText()).trim() === '1 h 30 min',
      `[${vp.n}] desenvolvimento da Septem entra como cobrável (1 h 30 min)`);

    // ── 6) Iniciar atendimento → solicitar retorno (motivo) → retomar ─────────
    await transicao(page, 'start');
    await esperarEstado(page, 'Em execução');
    await transicao(page, 'wait');
    await page.waitForSelector('[data-testid=dialogo-motivo]');
    check(!(await page.locator('[data-testid=confirmar-motivo]').isEnabled()), `[${vp.n}] solicitar retorno exige motivo`);
    await page.fill('[data-testid=dialogo-motivo] textarea[name=reason]', 'Preciso do número da guia.');
    await page.click('[data-testid=confirmar-motivo]');
    await esperarEstado(page, 'Aguardando você');
    await transicao(page, 'resume');
    await esperarEstado(page, 'Em execução');
    check(true, `[${vp.n}] retomar volta para "Em execução", de onde saiu`);

    // ── 7) Resolver ───────────────────────────────────────────────────────────
    await transicao(page, 'resolve');
    await page.waitForSelector('[data-testid=dialogo-resolver]');
    await page.click('[data-testid=confirmar-resolver]');
    await esperarEstado(page, 'Resolvido');
    check(JSON.stringify(await acoesNaTela(page).catch(() => [])) === '[]'
      || await page.locator('[data-testid=sem-transicoes]').count() === 1,
      `[${vp.n}] resolvido não oferece mais transições desta fase`);

    await checarResponsivo(page, check, `[${vp.n}] atendimento`);

    await checarAcessibilidade(page, check, `[${vp.n}] atendimento`);
    await page.screenshot({ path: `${OUT}/suporte-atendimento-${vp.n}.png`, fullPage: true });
    await ctx.close();

    // ── 8) O requisitante: horas sim, tarefa interna não ──────────────────────
    const ctxReq = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const pReq = await ctxReq.newPage();
    await entrarAmbiente(pReq, `req5-${rid}@prefeitura-x.local`, req.body.initialPassword);
    await pReq.goto(`${BASE}/support/tickets/${chamado.id}`, { waitUntil: 'networkidle' });
    await pReq.waitForSelector('[data-testid=atividades]', { timeout: 15000 });
    check((await pReq.locator('[data-testid=total-estimado]').innerText()).trim() === 'Sem estimativa',
      `[${vp.n}] sem proposta, o requisitante vê "Sem estimativa" (não "0 min")`);
    check((await pReq.locator('[data-testid=total-executado]').innerText()).trim() === '1 h 30 min',
      `[${vp.n}] o requisitante vê as horas executadas em h/min`);
    check(await pReq.locator('[data-testid=painel-atendimento]').count() === 0,
      `[${vp.n}] o requisitante NÃO vê o painel de atendimento`);
    const corpoReq = await pReq.locator('body').innerText();
    check(corpoReq.includes('Validação corrigida e testada.'), `[${vp.n}] a atividade concluída é pública`);
    await checarResponsivo(pReq, check, `[${vp.n}] visão do requisitante`);
    await checarAcessibilidade(pReq, check, `[${vp.n}] visão do requisitante`);
    await pReq.screenshot({ path: `${OUT}/suporte-atendimento-requisitante-${vp.n}.png`, fullPage: true });
    await ctxReq.close();
  }

  // ── 8b) Lacunas da reauditoria: modos do compositor, cancelar, corrigir, filtro, navegação ──
  {
    const chamado = (await api(tokenReq, '/api/v1/support/tickets', 'POST',
      { subject: `Reauditoria ${rid}`, description: 'Cobrir o que faltava.', nature: 'question' })).body;
    const v = (await central(tc, `/support/tickets/${chamado.id}`)).body.version;
    await central(tc, `/support/tickets/${chamado.id}/assign`, 'POST', { teamId: equipeA.id, ownerId: eu.id, taskResolutions: [], expectedVersion: v });
    const tarefaParaCancelar = (await central(tc, `/support/tickets/${chamado.id}/tasks`, 'POST',
      { title: `Descartável ${rid}`, description: 'Vai ser cancelada.', assigneeId: eu.id, category: 'other' })).body;
    const tarefaParaCorrigir = (await central(tc, `/support/tickets/${chamado.id}/tasks`, 'POST',
      { title: `Horas ${rid}`, description: 'Vai ter o apontamento corrigido.', assigneeId: eu.id, category: 'requirements' })).body;
    await central(tc, `/support/tickets/${chamado.id}/tasks/${tarefaParaCorrigir.id}/complete`, 'POST',
      { activityDescription: 'Levantamento.', durationMinutes: 120, expectedVersion: tarefaParaCorrigir.version });

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await entrarCentral(page, `/platform/support/tickets/${chamado.id}`);

    // Navegação central por papel: o super admin vê Triagem, Fila e Equipes.
    check(await page.locator('[data-testid=platform-nav-triagem]').count() === 1
      && await page.locator('[data-testid=platform-nav-fila]').count() === 1,
      'a navegação central oferece Triagem e Fila a quem tem o papel');

    // Filtro por responsável na fila de triagem: ele mesmo casa; filtrar por outro esvazia.
    await page.goto(BASE + '/platform/support/triage', { waitUntil: 'networkidle' });
    await page.fill('[data-testid=busca-chamados]', chamado.protocol);
    await page.locator('[data-testid=chamado-linha]').first().waitFor({ timeout: 15000 });
    await page.selectOption('[data-testid=filtro-responsavel]', eu.id);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=chamado-linha]').length === 1, null, { timeout: 15000 });
    const outrosResp = await page.locator('[data-testid=filtro-responsavel] option').evaluateAll(
      (os, meu) => os.map((o) => o.value).filter((v) => v && v !== meu), eu.id);
    if (outrosResp.length > 0) {
      await page.selectOption('[data-testid=filtro-responsavel]', outrosResp[0]);
      const vazio = await page.waitForSelector('[data-testid=chamados-vazio]', { timeout: 15000 }).then(() => true, () => false);
      check(vazio, 'o filtro por responsável é aplicado no servidor (outro responsável → vazio)');
    } else {
      check(true, 'o filtro por responsável é aplicado (sem outro responsável para contrastar)');
    }

    await page.goto(`${BASE}/platform/support/tickets/${chamado.id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=painel-atendimento]', { timeout: 15000 });

    // Compositor: os dois modos são DISTINTOS na tela, e o modo interno produz nota interna.
    check(await page.locator('[data-testid=compositor]').getAttribute('data-modo') === 'publica',
      'o compositor começa em "Mensagem ao requisitante"');
    await page.click('[data-testid=marcar-interna]');
    check(await page.locator('[data-testid=compositor]').getAttribute('data-modo') === 'interna',
      'escolher "Nota interna da organização" muda o modo visivelmente');
    await page.fill('[data-testid=compositor] textarea[name=body]', `Anotação reservada ${rid}`);
    await page.click('[data-testid=enviar-mensagem]');
    await page.waitForFunction((t) => [...document.querySelectorAll('[data-testid=mensagem]')]
      .some((m) => m.textContent.includes(t) && m.getAttribute('data-visibilidade') === 'internal'), `Anotação reservada ${rid}`, { timeout: 15000 });
    check(true, 'a mensagem enviada no modo interno é gravada como nota interna');

    // Cancelar tarefa pelo botão, com motivo obrigatório.
    const descartavel = page.locator('[data-testid=tarefa]', { hasText: `Descartável ${rid}` }).first();
    await descartavel.locator('[data-testid=cancelar-tarefa]').click();
    await page.waitForSelector('[data-testid=dialogo-motivo]');
    check(!(await page.locator('[data-testid=confirmar-motivo]').isEnabled()), 'cancelar tarefa exige motivo');
    await page.fill('[data-testid=dialogo-motivo] textarea[name=reason]', 'Não é mais necessária.');
    await page.click('[data-testid=confirmar-motivo]');
    await page.waitForFunction((t) => [...document.querySelectorAll('[data-testid=tarefa]')]
      .some((el) => el.textContent.includes(t) && el.textContent.includes('Cancelada')), `Descartável ${rid}`, { timeout: 15000 });
    check(true, 'a tarefa é cancelada pelo botão');

    // Corrigir apontamento pela tela: motivo obrigatório; o total passa a somar a revisão nova.
    check((await page.locator('[data-testid=total-executado]').innerText()).trim() === '2 h', 'antes da correção: 2 h');
    await page.locator('[data-testid=corrigir-apontamento]').first().click();
    await page.waitForSelector('[data-testid=form-correcao]');
    await page.fill('[data-testid=form-correcao] input[name=durationMinutes]', '75');
    check(!(await page.locator('[data-testid=salvar-correcao]').isEnabled()), 'corrigir horas exige motivo');
    await page.fill('[data-testid=form-correcao] textarea[name=reason]', 'Descontei a pausa do almoço.');
    await page.click('[data-testid=salvar-correcao]');
    await page.waitForFunction(() => document.querySelector('[data-testid=total-executado]')?.textContent?.trim() === '1 h 15 min',
      null, { timeout: 15000 });
    check(true, 'a correção vale: o total soma a revisão nova (1 h 15 min), sem duplicar a antiga');
    await ctx.close();
  }

  // ── 9) Transferência exige destino para cada tarefa aberta ──────────────────
  {
    const chamado = (await api(tokenReq, '/api/v1/support/tickets', 'POST',
      { subject: `Com tarefa aberta ${rid}`, description: 'Vai transferir.', nature: 'bug' })).body;
    const v = (await central(tc, `/support/tickets/${chamado.id}`)).body.version;
    await central(tc, `/support/tickets/${chamado.id}/assign`, 'POST', { teamId: equipeA.id, ownerId: eu.id, taskResolutions: [], expectedVersion: v });
    await central(tc, `/support/tickets/${chamado.id}/tasks`, 'POST',
      { title: `Pendente ${rid}`, description: 'Fica aberta.', assigneeId: eu.id, category: 'development' });

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await entrarCentral(page, `/platform/support/tickets/${chamado.id}`);
    await page.goto(`${BASE}/platform/support/tickets/${chamado.id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=painel-atendimento]', { timeout: 15000 });

    // Tira o super admin da equipe B? Não: para a tarefa precisar de destino, o responsável dela
    // não pode estar na nova equipe. Criamos uma equipe C sem ele.
    const equipeC = (await central(tc, '/support/teams/', 'POST', { name: `Terceiro nível ${rid}` })).body;
    const outro = (await central(tc, '/identities/')).body.find((i) => i.userId !== eu.id);
    if (outro) await central(tc, `/support/teams/${equipeC.id}/members/${outro.userId}`, 'PUT');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=painel-atendimento]', { timeout: 15000 });

    await page.click('[data-testid=abrir-transferencia]');
    await page.waitForSelector('[data-testid=dialogo-transferencia]');
    await page.selectOption('[data-testid=transferir-equipe]', equipeC.id);
    if (outro) await page.selectOption('[data-testid=transferir-dono]', outro.userId);
    await page.waitForSelector('[data-testid=tarefas-a-resolver]', { timeout: 10000 });
    check(true, 'a transferência lista a tarefa aberta que precisa de destino');
    check(!(await page.locator('[data-testid=confirmar-transferencia]').isEnabled()),
      'sem destino para a tarefa, o botão de transferir fica travado');

    await page.selectOption('[data-testid=destino-tarefa]', 'cancel');
    await page.fill('[data-testid=motivo-cancelar-tarefa]', 'Escalado para o terceiro nível.');
    check(await page.locator('[data-testid=confirmar-transferencia]').isEnabled(),
      'com destino e motivo, o botão habilita');
    await page.click('[data-testid=confirmar-transferencia]');
    await page.waitForFunction((n) => document.querySelector('[data-testid=equipe-atual]')?.textContent?.includes(n)
      || document.body.innerText.includes('não está disponível'), equipeC.name, { timeout: 15000 });
    const depois = (await central(tc, `/support/tickets/${chamado.id}/tasks`)).body;
    check(Array.isArray(depois) && depois.some((t) => t.status === 'cancelled' && t.cancelReason === 'Escalado para o terceiro nível.'),
      'a transferência cancelou a tarefa com o motivo informado');
    await page.screenshot({ path: `${OUT}/suporte-transferencia.png`, fullPage: true });
    await ctx.close();
  }

  // ── 10) "Fila da equipe" no menu: só para quem participa de equipe ─────────
  {
    const membro = await api(admin, '/api/v1/users', 'POST', {
      name: `Atendente cliente ${rid}`, email: `atc-${rid}@prefeitura-x.local`, isInternal: true, accessProfileIds: [perfil.body.id],
    });
    const equipe = (await api(admin, '/api/v1/support/teams/', 'POST', { name: `Equipe local ${rid}` })).body;
    await api(admin, `/api/v1/support/teams/${equipe.id}/members/${membro.body.id}`, 'PUT');

    for (const [quem, email, senha, deveVer] of [
      ['atendente do cliente', `atc-${rid}@prefeitura-x.local`, membro.body.initialPassword, true],
      ['requisitante', `req5-${rid}@prefeitura-x.local`, req.body.initialPassword, false],
    ]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await entrarAmbiente(page, email, senha);
      await page.locator('aside a', { hasText: 'Meus chamados' }).first().waitFor({ state: 'visible', timeout: 15000 });
      const tem = await page.locator('aside a', { hasText: 'Fila da equipe' }).count() === 1;
      check(tem === deveVer, `"Fila da equipe" ${deveVer ? 'aparece' : 'NÃO aparece'} para o ${quem}`);
      await ctx.close();
    }
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

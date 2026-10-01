// Fase 8 do plano 26_09 — o FLUXO COMPLETO do suporte (aceite S-A24):
// abertura → triagem → requisitos → desenvolvimento → ajustes → validação → implementação →
// resolução → encerramento → reabertura, "com horas, arquivos e histórico íntegros".
//
// O que a pessoa faz na tela é feito na TELA (abrir com anexo, aceitar a proposta, rejeitar e depois
// aceitar a validação, resolver, encerrar com confirmação, reabrir respondendo). O trabalho de
// bastidor das tarefas vai pela API, como nas outras suítes. No fim, a conferência é nas DUAS telas:
//  - horas: estimadas = a proposta (4 h); executadas = 60 + 120 + 30 + 20 = 3 h 50 min;
//  - arquivo: o anexo da abertura continua lá e abre;
//  - histórico: os marcos na ordem em que aconteceram, e a tela mostra o que a API devolve;
//  - estado final "Em análise" (reaberto) e 1280/375 sem overflow.
import { chromium } from 'playwright-core';
import { checarResponsivo, checarAcessibilidade } from './lib-responsivo.mjs';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const CENTRAL_EMAIL = 'super@septem.local';
const CENTRAL_SENHA = 'super123';
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
async function tokenCentral() {
  await fetch(`${API}/api/v1/platform/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CENTRAL_EMAIL, password: CENTRAL_SENHA }) });
  const code = (await (await fetch(`${API}/api/v1/platform/auth/dev/last-code?email=${encodeURIComponent(CENTRAL_EMAIL)}`)).json()).code;
  return (await (await fetch(`${API}/api/v1/platform/auth/2fa`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CENTRAL_EMAIL, code }) })).json()).accessToken;
}
const central = (t, p, m = 'GET', b) => fetch(`${API}/api/v1/platform${p}`, {
  method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: b ? JSON.stringify(b) : undefined,
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const rid = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
const admin = (await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' })).body.accessToken;
const perfil = await api(admin, '/api/v1/access-profiles', 'POST', { name: `Fluxo F8 ${rid}`, permissions: ['workflow:read'] });
const tc = await tokenCentral();
const eu = (await central(tc, '/me')).body;
const equipe = (await central(tc, '/support/teams/', 'POST', { name: `Fluxo F8 ${rid}` })).body;
await central(tc, `/support/teams/${equipe.id}/members/${eu.id}`, 'PUT');

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true });

async function entrarCentral(page) {
  await page.goto(BASE + '/platform/support/triage', { waitUntil: 'networkidle' });
  await page.fill('input[name=email]', CENTRAL_EMAIL);
  await page.fill('input[name=password]', CENTRAL_SENHA);
  await page.click('button[type=submit]');
  await page.waitForSelector('input[name=code]', { timeout: 10000 });
  const code = await page.evaluate(async (e) => (await (await fetch(`/api/v1/platform/auth/dev/last-code?email=${encodeURIComponent(e)}`)).json()).code, CENTRAL_EMAIL);
  await page.fill('input[name=code]', code);
  await page.click('button[type=submit]');
  await page.waitForSelector('[data-testid=platform-sair]', { timeout: 20000 });
}
async function entrarAmbiente(page, quem) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', quem.email);
  await page.fill('input[name=password]', quem.senha);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}
const abrir = async (page, url) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=detalhe-protocolo]', { timeout: 15000 });
};
const esperarEstado = (page, rotulo) => page.waitForFunction(
  (r) => document.querySelector('[data-testid=detalhe-estado]')?.textContent?.trim() === r, rotulo, { timeout: 15000 });

/** Tarefa inteira pela API (bastidor): cria, inicia e conclui com as horas dadas. */
async function tarefa(id, titulo, categoria, minutos) {
  const t = (await central(tc, `/support/tickets/${id}/tasks`, 'POST',
    { title: titulo, description: `${titulo}.`, assigneeId: eu.id, category: categoria })).body;
  const versao = async () => (await central(tc, `/support/tickets/${id}/tasks`)).body.find((x) => x.id === t.id).version;
  const ini = await central(tc, `/support/tickets/${id}/tasks/${t.id}/start`, 'POST', { expectedVersion: await versao() });
  const fim = await central(tc, `/support/tickets/${id}/tasks/${t.id}/complete`, 'POST',
    { activityDescription: `${titulo} feito.`, durationMinutes: minutos, expectedVersion: await versao() });
  return ini.status === 204 && fim.status === 200;
}
async function aprovacao(id, kind, texto, estimativa) {
  const r = (await central(tc, `/support/tickets/${id}/approvals`, 'POST',
    { kind, description: texto, estimatedMinutes: estimativa, scope: 'ticket' })).body;
  const s = await central(tc, `/support/tickets/${id}/approvals/${r.id}/submit`, 'POST', { expectedVersion: r.version });
  return { id: r.id, ok: s.status === 204 };
}
/** O requisitante decide NA TELA, vendo o resumo; rejeitar leva motivo. */
async function decidir(page, url, botao, motivo) {
  await abrir(page, url);
  await page.waitForSelector('[data-testid=solicitacao][data-status=pending]', { timeout: 15000 });
  await page.locator('[data-testid=solicitacao][data-status=pending]').first().locator(`[data-testid=${botao}]`).click();
  await page.waitForSelector('[data-testid=dialogo-decisao]');
  if (motivo) await page.fill('[data-testid=dialogo-decisao] textarea[name=reason]', motivo);
  const resp = page.waitForResponse((r) => r.url().includes('/decide') && r.request().method() === 'POST', { timeout: 15000 });
  await page.click('[data-testid=confirmar-decisao]');
  return (await resp).status();
}

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const email = `fluxo-${vp.n}-${rid}@prefeitura-x.local`;
    const u = await api(admin, '/api/v1/users', 'POST', { name: `Fluxo ${vp.n} ${rid}`, email, isInternal: true, accessProfileIds: [perfil.body.id] });
    const quem = { email, senha: u.body.initialPassword };
    const ctxR = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const pr = await ctxR.newPage();
    const ctxC = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const pc = await ctxC.newPage();
    await entrarAmbiente(pr, quem);
    await entrarCentral(pc);

    // ── 1) ABERTURA, na tela, com anexo ────────────────────────────────────
    const assunto = `Relatório de protocolos ${vp.n} ${rid}`;
    const anexoNome = `tela-${vp.n}.png`;
    await pr.goto(BASE + '/support/new', { waitUntil: 'networkidle' });
    await pr.fill('[data-testid=form-chamado] input[name=subject]', assunto);
    await pr.locator('input[name=nature][value=feature]').check({ force: true });
    await pr.fill('[data-testid=form-chamado] textarea[name=description]', 'Precisamos de um relatório mensal de protocolos por setor.');
    await pr.setInputFiles('[data-testid=input-anexo]', { name: anexoNome, mimeType: 'image/png',
      buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(96)]) });
    await pr.waitForFunction(() => { const i = [...document.querySelectorAll('[data-testid=anexo-escolhido]')]; return i.length === 1 && !i[0].querySelector('.animate-spin'); }, null, { timeout: 20000 });
    const criado = pr.waitForResponse((r) => r.url().endsWith('/api/v1/support/tickets') && r.request().method() === 'POST', { timeout: 20000 });
    await pr.click('[data-testid=enviar-chamado]');
    const chamado = await (await criado).json();
    await pr.waitForURL((x) => x.pathname === `/support/tickets/${chamado.id}`, { timeout: 15000 });
    check(!!chamado.protocol, `[${vp.n}] 1. abertura na tela, com anexo (${chamado.protocol})`);
    const id = chamado.id;
    const urlR = `${BASE}/support/tickets/${id}`;
    const urlC = `${BASE}/platform/support/tickets/${id}`;

    // ── 2) TRIAGEM ─────────────────────────────────────────────────────────
    let v = (await central(tc, `/support/tickets/${id}`)).body.version;
    const an = await central(tc, `/support/tickets/${id}/transitions`, 'POST', { action: 'analyze', expectedVersion: v });
    v = (await central(tc, `/support/tickets/${id}`)).body.version;
    const cl = await central(tc, `/support/tickets/${id}/classification`, 'PATCH', { priority: 'high', expectedVersion: v });
    v = (await central(tc, `/support/tickets/${id}`)).body.version;
    const enc = await central(tc, `/support/tickets/${id}/assign`, 'POST', { teamId: equipe.id, ownerId: eu.id, taskResolutions: [], expectedVersion: v });
    check(an.status === 204 && cl.status === 204 && enc.status === 204, `[${vp.n}] 2. triagem: análise, prioridade alta e encaminhamento`);

    // ── 3) REQUISITOS + proposta aceita NA TELA ─────────────────────────────
    check(await tarefa(id, 'Levantar requisitos', 'requirements', 60), `[${vp.n}] 3. requisitos: tarefa concluída com 60 min`);
    const proposta = await aprovacao(id, 'proposal', 'Relatório com filtro por setor e mês.', 240);
    check(proposta.ok && await decidir(pr, urlR, 'aprovar') === 204, `[${vp.n}] 3b. o requisitante ACEITA a proposta na tela`);

    // ── 4) DESENVOLVIMENTO ─────────────────────────────────────────────────
    check(await tarefa(id, 'Desenvolver relatório', 'development', 120), `[${vp.n}] 4. desenvolvimento: 120 min`);

    // ── 5) VALIDAÇÃO rejeitada → AJUSTES → validação aceita ────────────────
    const validacao = await aprovacao(id, 'solution', 'Relatório pronto em homologação.', null);
    check(validacao.ok && await decidir(pr, urlR, 'rejeitar', 'Falta o total por setor.') === 204, `[${vp.n}] 5. o requisitante REJEITA a validação, com motivo`);
    await esperarEstado(pr, 'Em análise');
    const versoes = (await central(tc, `/support/tickets/${id}/approvals`)).body;
    const rejeitada = versoes.find((x) => x.id === validacao.id);
    const rev = await central(tc, `/support/tickets/${id}/approvals/${validacao.id}/revisions`, 'POST',
      { description: 'Relatório com total por setor.', scope: 'ticket', expectedVersion: rejeitada.version });
    check(rev.status === 201 && await tarefa(id, 'Ajustar totais', 'development', 30), `[${vp.n}] 5b. ajustes: nova versão da validação e 30 min de trabalho`);
    const sub = await central(tc, `/support/tickets/${id}/approvals/${rev.body.id}/submit`, 'POST', { expectedVersion: rev.body.version });
    check(sub.status === 204 && await decidir(pr, urlR, 'aprovar') === 204, `[${vp.n}] 5c. o requisitante ACEITA a validação revisada`);

    // ── 6) IMPLEMENTAÇÃO ───────────────────────────────────────────────────
    check(await tarefa(id, 'Publicar em produção', 'other', 20), `[${vp.n}] 6. implementação: 20 min`);

    // ── 7) RESOLUÇÃO na tela da central ────────────────────────────────────
    await abrir(pc, urlC);
    await pc.click('[data-testid=transicao-resolve]');
    await pc.waitForSelector('[data-testid=dialogo-resolver]');
    await pc.click('[data-testid=confirmar-resolver]');
    await esperarEstado(pc, 'Resolvido');
    check(true, `[${vp.n}] 7. resolução pela tela de quem atende`);

    // ── 8) ENCERRAMENTO, com confirmação ───────────────────────────────────
    await abrir(pr, urlR);
    await pr.waitForSelector('[data-testid=aviso-encerramento-automatico]', { timeout: 15000 });
    await pr.click('[data-testid=transicao-close]');
    await pr.getByRole('dialog').getByRole('button', { name: 'Encerrar', exact: true }).click();
    await esperarEstado(pr, 'Encerrado');
    check(true, `[${vp.n}] 8. encerramento confirmado pelo requisitante`);

    // ── 9) REABERTURA respondendo ──────────────────────────────────────────
    await pr.waitForSelector('[data-testid=aviso-reabre]');
    await pr.fill('[data-testid=compositor] textarea[name=body]', 'O filtro por mês não aparece no celular.');
    await pr.click('[data-testid=enviar-mensagem]');
    await esperarEstado(pr, 'Em análise');
    check(true, `[${vp.n}] 9. a resposta reabre: "Em análise"`);

    // ── Conferência: horas, arquivo e histórico ────────────────────────────
    await abrir(pr, urlR);
    await pr.waitForFunction(() => !!document.querySelector('[data-testid=total-executado]'), null, { timeout: 15000 });
    const executado = (await pr.locator('[data-testid=total-executado]').innerText()).trim();
    const estimado = (await pr.locator('[data-testid=total-estimado]').innerText()).trim();
    check(executado === '3 h 50 min', `[${vp.n}] horas: executadas = 60 + 120 + 30 + 20 = 3 h 50 min (${executado})`);
    check(estimado === '4 h', `[${vp.n}] horas: estimadas = a proposta aceita, 4 h (${estimado})`);
    const logs = (await api(null, '/api/v1/auth/login', 'POST', { identifier: email, password: quem.senha })).body.accessToken;
    const apont = (await api(logs, `/api/v1/support/tickets/${id}/work-logs`)).body;
    check(apont.items.length === 4 && apont.totals.executedMinutes === 230, `[${vp.n}] horas: 4 atividades e 230 min na API`);

    const anexo = pr.locator('[data-testid=anexo]', { hasText: anexoNome }).first();
    check(await anexo.count() === 1, `[${vp.n}] arquivo: o anexo da abertura continua no chamado`);
    const href = await anexo.locator('a').getAttribute('href');
    // O link da tela, baixado com a sessão do requisitante.
    const baixou = (await fetch(API + new URL(href, BASE).pathname, { headers: { Authorization: `Bearer ${logs}`, 'X-Tenant': 'prefeitura-x' } })).status;
    check(baixou === 200, `[${vp.n}] arquivo: o anexo abre para o requisitante (${baixou})`);

    const linha = (await api(logs, `/api/v1/support/tickets/${id}/timeline?pageSize=100`)).body.items;
    const pos = (pred) => linha.findIndex(pred);
    const marcos = [
      pos((e) => e.type === 'opened'),
      pos((e) => e.type === 'assigned'),
      pos((e) => e.type === 'approval_decided' && /Proposta aprovada/.test(e.summary)),
      pos((e) => e.type === 'approval_decided' && /rejeitada/.test(e.summary)),
      pos((e) => e.type === 'approval_decided' && /Validação da solução aprovada/.test(e.summary)),
      pos((e) => e.type === 'state_changed' && e.toState === 'resolved'),
      pos((e) => e.type === 'state_changed' && e.toState === 'closed'),
      pos((e) => e.type === 'state_changed' && e.fromState === 'closed' && e.toState === 'in_analysis'),
    ];
    check(marcos.every((m) => m >= 0) && marcos.every((m, i) => i === 0 || m > marcos[i - 1]),
      `[${vp.n}] histórico: abertura → encaminhamento → proposta → rejeição → validação → resolução → encerramento → reabertura, em ordem (${marcos.join(',')})`);
    const naTela = await pr.locator('[data-testid=evento]').count();
    // A tela pede a página padrão (25); a comparação é com o que ESSA página traria.
    check(naTela > 0 && naTela === Math.min(linha.length, 25), `[${vp.n}] histórico: a tela mostra o que a API devolve (${naTela} de ${linha.length})`);
    check(!linha.some((e) => e.visibility === 'internal'), `[${vp.n}] histórico do requisitante sem nenhum evento interno`);

    await checarResponsivo(pr, check, `[${vp.n}] requisitante (fim do fluxo)`);

    await checarAcessibilidade(pr, check, `[${vp.n}] requisitante (fim do fluxo)`);
    await checarResponsivo(pc, check, `[${vp.n}] central (fim do fluxo)`);
    await checarAcessibilidade(pc, check, `[${vp.n}] central (fim do fluxo)`);
    await pr.screenshot({ path: `${OUT}/suporte-fluxo-requisitante-${vp.n}.png`, fullPage: true });
    await abrir(pc, urlC);
    // Título de tarefa INTEIRO na tela (no celular ele chegou a sobrar com uma letra e reticências —
    // nem overflow nem controle cortado: texto truncado, que só a captura mostrava).
    await pc.waitForSelector('[data-testid=tarefa-titulo]', { timeout: 15000 });
    const titulos = await pc.locator('[data-testid=tarefa-titulo]').evaluateAll((els) => els.map((e) => ({
      texto: e.textContent, inteiro: e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().width > 40 })));
    check(titulos.length === 4 && titulos.every((t) => t.inteiro),
      `[${vp.n}] os 4 títulos de tarefa aparecem inteiros (${titulos.map((t) => `${t.texto}:${t.inteiro ? 'ok' : 'TRUNCADO'}`).join(', ')})`);
    await pc.screenshot({ path: `${OUT}/suporte-fluxo-central-${vp.n}.png`, fullPage: true });
    await ctxR.close();
    await ctxC.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

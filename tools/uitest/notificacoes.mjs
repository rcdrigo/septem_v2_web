// Fase 7 do plano 26_09 — o sino de notificações (SUP-08; aceite S-A21 pela tela).
//
// O que esta suíte prova, e por quê:
//  (a) o requisitante NÃO é avisado do que ele mesmo fez (abrir, responder);
//  (b) a resposta de quem atende acende o sino do requisitante; abrir o aviso leva ao chamado
//      (link do SERVIDOR) e o marca como lido — o contador desce;
//  (c) na área central, a resposta do requisitante acende o sino do responsável e o link abre a
//      rota da central;
//  (d) transferência: o atendente da equipe do cliente via o aviso; o chamado vai para a equipe
//      da Septem e o aviso SOME do sino dele — a tela não mostra de cache o que a API já não
//      autoriza;
//  (e) 1280 e 375 sem overflow, com o painel do sino dentro da tela.
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
const perfil = await api(admin, '/api/v1/access-profiles', 'POST', { name: `Sino ${rid}`, permissions: ['workflow:read'] });
async function pessoa(prefixo) {
  const email = `${prefixo}-${rid}@prefeitura-x.local`;
  const u = await api(admin, '/api/v1/users', 'POST', { name: `${prefixo} ${rid}`, email, isInternal: true, accessProfileIds: [perfil.body.id] });
  const token = (await api(null, '/api/v1/auth/login', 'POST', { identifier: email, password: u.body.initialPassword })).body.accessToken;
  return { id: u.body.id, email, senha: u.body.initialPassword, token };
}
const req = await pessoa('sino-req');
const atendente = await pessoa('sino-atd');

// Equipe DO CLIENTE com o atendente (criada pelo admin com `support:admin`).
const equipeCliente = (await api(admin, '/api/v1/support/teams/', 'POST', { name: `Sino cliente ${rid}` })).body;
await api(admin, `/api/v1/support/teams/${equipeCliente.id}/members/${atendente.id}`, 'PUT');

const tc = await tokenCentral();
const eu = (await central(tc, '/me')).body;
const equipeSeptem = (await central(tc, '/support/teams/', 'POST', { name: `Sino Septem ${rid}` })).body;
await central(tc, `/support/teams/${equipeSeptem.id}/members/${eu.id}`, 'PUT');

async function encaminhar(id, equipe, dono) {
  let v = (await central(tc, `/support/tickets/${id}`)).body.version;
  const d = (await central(tc, `/support/tickets/${id}`)).body;
  if (d.state === 'open') {
    await central(tc, `/support/tickets/${id}/transitions`, 'POST', { action: 'analyze', expectedVersion: v });
    v = (await central(tc, `/support/tickets/${id}`)).body.version;
  }
  return central(tc, `/support/tickets/${id}/assign`, 'POST', { teamId: equipe, ownerId: dono, taskResolutions: [], expectedVersion: v });
}

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

/** O sino VISÍVEL (no ambiente há dois: barra do mobile e topo da sidebar; um deles fica oculto). */
const sino = (page) => page.locator('[data-testid=sino]:visible').first();

/**
 * Abre o painel do sino com a caixa já CARREGADA e devolve os links dos avisos. Espera o fim do
 * "Carregando…" — antes disso, "não tem aviso" passaria em falso.
 */
async function abrirSino(page) {
  await sino(page).click();
  await page.waitForSelector('[data-testid=sino-painel]', { timeout: 10000 });
  await page.waitForFunction(() => {
    const p = document.querySelector('[data-testid=sino-painel]');
    return p && !p.textContent.includes('Carregando');
  }, null, { timeout: 15000 });
  return page.locator('[data-testid=notificacao]').evaluateAll((els) => els.map((e) => ({
    link: e.getAttribute('data-link'), lida: e.getAttribute('data-lida'), texto: e.textContent,
  })));
}
const naoLidas = async (page) => Number(await sino(page).getAttribute('data-nao-lidas'));
const recarregar = async (page) => {
  await page.reload({ waitUntil: 'networkidle' });
  // `networkidle` já inclui a consulta do sino; o atributo do contador sai dela.
  await sino(page).waitFor({ timeout: 15000 });
};

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctxR = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const pr = await ctxR.newPage();
    const ctxC = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const pc = await ctxC.newPage();
    const ctxA = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const pa = await ctxA.newPage();
    await entrarAmbiente(pr, req);
    await entrarCentral(pc);
    await entrarAmbiente(pa, atendente);

    // ── 0) Sino com falha de rede: erro com "Tentar de novo" ──────────────────
    const soSino = (u) => new URL(u).pathname === '/api/v1/notifications';
    await pr.route(soSino, (r) => r.abort());
    await pr.reload({ waitUntil: 'domcontentloaded' });
    await sino(pr).waitFor({ timeout: 15000 });
    await sino(pr).click();
    const errou = await pr.waitForSelector('[data-testid=sino-erro]', { timeout: 20000 }).then(() => true).catch(() => false);
    check(errou, `[${vp.n}] sino com falha de rede mostra erro com "Tentar de novo"`);
    await pr.keyboard.press('Escape');
    await pr.unroute(soSino);

    // ── 1) Chamado com a Septem: o autor não é avisado do que fez ────────────
    const t1 = (await api(req.token, '/api/v1/support/tickets', 'POST',
      { subject: `Sino ${vp.n} ${rid}`, description: 'Relatório vazio.', nature: 'bug' })).body;
    await encaminhar(t1.id, equipeSeptem.id, eu.id);
    await api(req.token, `/api/v1/support/tickets/${t1.id}/messages`, 'POST', { body: 'Mais detalhes: acontece só às segundas.' });
    const linkR1 = `/support/tickets/${t1.id}`;
    const linkC1 = `/platform/support/tickets/${t1.id}`;

    await recarregar(pr);
    let itens = await abrirSino(pr);
    check(!itens.some((i) => i.link === linkR1), `[${vp.n}] o requisitante não é avisado do que ele mesmo fez`);
    await pr.keyboard.press('Escape');

    // ── 2) Central: a resposta do requisitante acende o sino do responsável ─
    await recarregar(pc);
    itens = await abrirSino(pc);
    const doT1 = itens.find((i) => i.link === linkC1 && /Nova mensagem/.test(i.texto));
    check(!!doT1 && doT1.lida === 'nao', `[${vp.n}] central: o responsável recebe "Nova mensagem", não lida`);
    const antesC = await naoLidas(pc);
    await pc.locator(`[data-testid=notificacao][data-link="${linkC1}"]`).first().click();
    await pc.waitForURL((u) => u.pathname === linkC1, { timeout: 15000 });
    check(true, `[${vp.n}] central: o aviso abre o chamado na rota da central`);
    await pc.waitForFunction((n) => Number(document.querySelector('[data-testid=sino]')?.getAttribute('data-nao-lidas')) < n,
      antesC, { timeout: 15000 });
    check(true, `[${vp.n}] central: abrir marca como lido (o contador desce)`);

    // ── 3) Requisitante: a resposta de quem atende acende o sino ────────────
    await central(tc, `/support/tickets/${t1.id}/messages`, 'POST', { body: 'Pode mandar um print da tela?' });
    await recarregar(pr);
    check(await naoLidas(pr) >= 1, `[${vp.n}] requisitante: o contador acende (${await naoLidas(pr)})`);
    itens = await abrirSino(pr);
    check(itens.some((i) => i.link === linkR1 && i.lida === 'nao' && /Nova mensagem/.test(i.texto)),
      `[${vp.n}] requisitante: o aviso aponta para o chamado`);
    const caixaSino = await pr.locator('[data-testid=sino-painel]').boundingBox();
    check(!!caixaSino && caixaSino.x >= 0 && caixaSino.x + caixaSino.width <= vp.w + 1,
      `[${vp.n}] o painel do sino cabe na tela (${Math.round(caixaSino?.x ?? -1)}–${Math.round((caixaSino?.x ?? 0) + (caixaSino?.width ?? 0))})`);
    await checarResponsivo(pr, check, `[${vp.n}] painel do sino aberto`);
    await checarAcessibilidade(pr, check, `[${vp.n}] painel do sino aberto`);
    await pr.screenshot({ path: `${OUT}/notificacoes-sino-${vp.n}.png` });
    const antesR = await naoLidas(pr);
    await pr.locator(`[data-testid=notificacao][data-link="${linkR1}"]`).first().click();
    await pr.waitForURL((u) => u.pathname === linkR1, { timeout: 15000 });
    await pr.waitForSelector('[data-testid=detalhe-protocolo]', { timeout: 15000 });
    check(true, `[${vp.n}] requisitante: o aviso abre o chamado`);
    await pr.waitForFunction((n) => Number([...document.querySelectorAll('[data-testid=sino]')]
      .find((e) => e.offsetParent)?.getAttribute('data-nao-lidas')) < n, antesR, { timeout: 15000 });
    check(true, `[${vp.n}] requisitante: lido, o contador desce`);
    await checarResponsivo(pr, check, `[${vp.n}] requisitante`);
    await checarAcessibilidade(pr, check, `[${vp.n}] requisitante`);

    // ── 4) Transferência: o aviso some do sino de quem perdeu o acesso ───────
    const t2 = (await api(req.token, '/api/v1/support/tickets', 'POST',
      { subject: `Transferência ${vp.n} ${rid}`, description: 'Integração parou.', nature: 'bug' })).body;
    await encaminhar(t2.id, equipeCliente.id, atendente.id);
    await api(req.token, `/api/v1/support/tickets/${t2.id}/messages`, 'POST', { body: 'Alguma novidade?' });
    const linkA2 = `/support/tickets/${t2.id}`;
    await recarregar(pa);
    itens = await abrirSino(pa);
    check(itens.some((i) => i.link === linkA2), `[${vp.n}] atendente do cliente: recebe o aviso do chamado da equipe`);
    await pa.keyboard.press('Escape');

    const tr = await encaminhar(t2.id, equipeSeptem.id, eu.id);
    check(tr.status === 204, `[${vp.n}] o chamado é transferido para a equipe da Septem (${tr.status})`);
    await recarregar(pa);
    itens = await abrirSino(pa);
    check(!itens.some((i) => i.link === linkA2), `[${vp.n}] depois da transferência o aviso SOME do sino dele`);
    await pa.keyboard.press('Escape');
    await pa.goto(BASE + linkA2, { waitUntil: 'networkidle' });
    await pa.waitForSelector('[data-testid=chamado-indisponivel]', { timeout: 15000 });
    check(true, `[${vp.n}] e o link antigo não abre o chamado`);

    await checarResponsivo(pc, check, `[${vp.n}] central`);

    await checarAcessibilidade(pc, check, `[${vp.n}] central`);
    await checarResponsivo(pa, check, `[${vp.n}] atendente do cliente`);
    await checarAcessibilidade(pa, check, `[${vp.n}] atendente do cliente`);
    await pc.screenshot({ path: `${OUT}/notificacoes-central-${vp.n}.png` });

    await ctxR.close();
    await ctxC.close();
    await ctxA.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Fase 8 do plano 26_09 — troca de identidade na MESMA aba (S-A23: "alterar identidade/tenant limpa
// dados anteriores; URL direta, paginação e cache não revelam chamados sem permissão").
//
// O que esta suíte prova, e por quê:
//  (a) A entra, vê o chamado dele na lista e o aviso no sino (a tela CARREGOU os dados de A);
//  (b) A sai e B entra na mesma aba, sem recarregar a página: a lista de B não mostra o chamado de A,
//      nem por um instante de cache, e o sino de B não mostra o aviso de A;
//  (c) a URL direta do chamado de A, aberta por B, diz que não está disponível;
//  (d) 1280 e 375 sem overflow horizontal.
import { chromium } from 'playwright-core';
import { checarResponsivo, checarAcessibilidade } from './lib-responsivo.mjs';
import { abrirMenuDoUsuario } from './lib-shell.mjs';

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
const perfil = await api(admin, '/api/v1/access-profiles', 'POST', { name: `Sessao F8 ${rid}`, permissions: ['workflow:read'] });
async function pessoa(prefixo) {
  const email = `${prefixo}-${rid}@prefeitura-x.local`;
  const u = await api(admin, '/api/v1/users', 'POST', { name: `${prefixo} ${rid}`, email, isInternal: true, accessProfileIds: [perfil.body.id] });
  const token = (await api(null, '/api/v1/auth/login', 'POST', { identifier: email, password: u.body.initialPassword })).body.accessToken;
  return { email, senha: u.body.initialPassword, token };
}
const tc = await tokenCentral();
const eu = (await central(tc, '/me')).body;
const equipe = (await central(tc, '/support/teams/', 'POST', { name: `Sessão F8 ${rid}` })).body;
await central(tc, `/support/teams/${equipe.id}/members/${eu.id}`, 'PUT');

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true });

/** `recarregar=false`: entra pelo login em que o "Sair" deixou a aba — SEM recarregar o SPA. */
async function entrar(page, quem, recarregar = true) {
  if (recarregar) await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  else await page.waitForSelector('input[name=identifier]', { timeout: 15000 });
  await page.fill('input[name=identifier]', quem.email);
  await page.fill('input[name=password]', quem.senha);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}
async function sair(page, mobile) {
  if (mobile) {
    await page.locator('button[aria-label="Abrir menu"]').click();
    await page.waitForFunction(() => { const a = document.querySelector('aside'); return !!a && a.getBoundingClientRect().left >= 0; }, null, { timeout: 8000 }).catch(() => {});
  }
  await abrirMenuDoUsuario(page);
  await page.getByRole('menuitem', { name: /^Sair$/ }).click();
  await page.waitForURL(/\/login/, { timeout: 10000 });
}
/** Lista "Meus chamados" CARREGADA: linhas ou o vazio — antes disso, "não mostra" passaria em falso. */
async function protocolosDaLista(page, mobile) {
  // Navegação INTERNA do SPA (o link "Meus chamados" da barra lateral), não `goto`: recarregar a página
  // zera o cache em memória, e a sonda não mediria o que o S-A23 teme — o dado de quem saiu aparecendo
  // para quem entrou.
  if (mobile) {
    await page.locator('button[aria-label="Abrir menu"]').click();
    await page.waitForFunction(() => { const a = document.querySelector('aside'); return !!a && a.getBoundingClientRect().left >= 0; }, null, { timeout: 8000 }).catch(() => {});
  }
  await page.locator('aside a[href="/support"]').first().click();
  await page.waitForURL((u) => u.pathname === '/support', { timeout: 15000 });
  await page.waitForSelector('[data-testid=chamado-linha], [data-testid=chamados-vazio]', { timeout: 15000 });
  return page.locator('[data-testid=chamado-protocolo]').allInnerTexts();
}
const sino = (page) => page.locator('[data-testid=sino]:visible').first();
async function linksDoSino(page) {
  await sino(page).click();
  await page.waitForSelector('[data-testid=sino-painel]', { timeout: 10000 });
  await page.waitForFunction(() => { const p = document.querySelector('[data-testid=sino-painel]'); return p && !p.textContent.includes('Carregando'); }, null, { timeout: 15000 });
  const links = await page.locator('[data-testid=notificacao]').evaluateAll((els) => els.map((e) => e.getAttribute('data-link')));
  await page.keyboard.press('Escape');
  return links;
}

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const a = await pessoa(`sessao-a-${vp.n}`);
    const b = await pessoa(`sessao-b-${vp.n}`);
    // O chamado de A, com resposta da Septem (vira aviso no sino de A).
    const chamado = (await api(a.token, '/api/v1/support/tickets', 'POST', { subject: `Só de A ${vp.n} ${rid}`, description: 'Privado.', nature: 'bug' })).body;
    let v = (await central(tc, `/support/tickets/${chamado.id}`)).body.version;
    await central(tc, `/support/tickets/${chamado.id}/transitions`, 'POST', { action: 'analyze', expectedVersion: v });
    v = (await central(tc, `/support/tickets/${chamado.id}`)).body.version;
    await central(tc, `/support/tickets/${chamado.id}/assign`, 'POST', { teamId: equipe.id, ownerId: eu.id, taskResolutions: [], expectedVersion: v });
    await central(tc, `/support/tickets/${chamado.id}/messages`, 'POST', { body: 'Estamos olhando.' });
    const link = `/support/tickets/${chamado.id}`;

    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    // ── 1) A vê o que é dele ───────────────────────────────────────────────
    await entrar(page, a);
    check((await protocolosDaLista(page, vp.n === 'mobile')).includes(chamado.protocol), `[${vp.n}] A vê o próprio chamado na lista`);
    check((await linksDoSino(page)).includes(link), `[${vp.n}] A tem o aviso da resposta no sino`);

    // ── 2) Troca na MESMA aba: nada de A aparece para B ────────────────────
    await sair(page, vp.n === 'mobile');
    const marcador = await page.evaluate(() => (window.__mesmaAba = Math.random()));
    await entrar(page, b, false);
    const deB = await protocolosDaLista(page, vp.n === 'mobile');
    // A prova de que NÃO houve recarga: a variável plantada antes de B entrar continua lá.
    check(await page.evaluate(() => window.__mesmaAba) === marcador, `[${vp.n}] a troca foi na mesma aba, sem recarregar a página`);
    check(!deB.includes(chamado.protocol), `[${vp.n}] B, na mesma aba, NÃO vê o chamado de A na lista (${deB.length} linha(s))`);
    check(!(await linksDoSino(page)).includes(link), `[${vp.n}] e o sino de B não traz o aviso de A`);

    // ── 3) URL direta ──────────────────────────────────────────────────────
    await page.goto(BASE + link, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=chamado-indisponivel], [data-testid=detalhe-protocolo]', { timeout: 15000 });
    check(await page.locator('[data-testid=chamado-indisponivel]').count() === 1
      && await page.locator('[data-testid=detalhe-protocolo]').count() === 0, `[${vp.n}] a URL direta do chamado de A diz "não disponível" para B`);
    check(!(await page.content()).includes(`Só de A ${vp.n} ${rid}`), `[${vp.n}] e o assunto de A não está em lugar nenhum da página`);
    await checarResponsivo(page, check, `[${vp.n}] chamado indisponível`);
    await checarAcessibilidade(page, check, `[${vp.n}] chamado indisponível`);
    await page.screenshot({ path: `${OUT}/suporte-sessao-${vp.n}.png`, fullPage: true });
    await ctx.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

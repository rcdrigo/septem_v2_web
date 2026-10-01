// Fase 7 do plano 26_09 — ciclo completo pela tela (SUP-03/SUP-06; aceites S-A17 a S-A19).
//
// O que esta suíte prova, e por quê:
//  (a) o REQUISITANTE tem as próprias ações (a lista vem do servidor): cancelar pede motivo, e o
//      cancelamento não oferece o aviso de "reabrirá" (mensagem comum não reabre Cancelado);
//  (b) quem atende registra o trabalho RESIDUAL da tarefa cancelada em execução — e a tarefa
//      continua cancelada, com as horas contadas;
//  (c) reabrir o Cancelado exige justificativa;
//  (d) resolvido: a tela mostra a data do encerramento automático (a do servidor, +30 dias) e
//      avisa o requisitante de que responder reabre;
//  (e) encerrar pede CONFIRMAÇÃO — "Voltar" não encerra; confirmar encerra;
//  (f) a resposta ao Encerrado reabre de fato ("Em análise");
//  (g) 1280 e 375 sem overflow horizontal.
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
const perfil = await api(admin, '/api/v1/access-profiles', 'POST', { name: `Req F7 ${rid}`, permissions: ['workflow:read'] });
const req = await api(admin, '/api/v1/users', 'POST', {
  name: `Requisitante F7 ${rid}`, email: `req7-${rid}@prefeitura-x.local`, isInternal: true, accessProfileIds: [perfil.body.id],
});
const tokenReq = (await api(null, '/api/v1/auth/login', 'POST', { identifier: `req7-${rid}@prefeitura-x.local`, password: req.body.initialPassword })).body.accessToken;

const tc = await tokenCentral();
const eu = (await central(tc, '/me')).body;
const equipe = (await central(tc, '/support/teams/', 'POST', { name: `Ciclo F7 ${rid}` })).body;
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
async function entrarAmbiente(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', `req7-${rid}@prefeitura-x.local`);
  await page.fill('input[name=password]', req.body.initialPassword);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}
const esperarEstado = (page, rotulo) => page.waitForFunction(
  (r) => document.querySelector('[data-testid=detalhe-estado]')?.textContent?.trim() === r, rotulo, { timeout: 15000 });
const estadoDa = (page) => page.locator('[data-testid=detalhe-estado]').innerText().then((t) => t.trim());
/** Abre a tela e espera o detalhe CARREGADO (o protocolo) — antes disso, "não tem botão" passaria em falso. */
const abrir = async (page, url) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=detalhe-protocolo]', { timeout: 15000 });
};

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    // Cenário: chamado em análise, encaminhado, com uma tarefa EM EXECUÇÃO do atendente.
    const chamado = (await api(tokenReq, '/api/v1/support/tickets', 'POST',
      { subject: `Ciclo ${vp.n} ${rid}`, description: 'Exportação falha.', nature: 'bug' })).body;
    let v = (await central(tc, `/support/tickets/${chamado.id}`)).body.version;
    await central(tc, `/support/tickets/${chamado.id}/transitions`, 'POST', { action: 'analyze', expectedVersion: v });
    v = (await central(tc, `/support/tickets/${chamado.id}`)).body.version;
    await central(tc, `/support/tickets/${chamado.id}/assign`, 'POST', { teamId: equipe.id, ownerId: eu.id, taskResolutions: [], expectedVersion: v });
    const tarefa = (await central(tc, `/support/tickets/${chamado.id}/tasks`, 'POST',
      { title: `Corrigir exportação ${vp.n}`, description: 'Ajustar o CSV.', assigneeId: eu.id, category: 'development' })).body;
    await central(tc, `/support/tickets/${chamado.id}/tasks/${tarefa.id}/start`, 'POST', { expectedVersion: tarefa.version });

    const ctxC = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const pc = await ctxC.newPage();
    const ctxR = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const pr = await ctxR.newPage();
    await entrarCentral(pc);
    await entrarAmbiente(pr);
    const urlC = `${BASE}/platform/support/tickets/${chamado.id}`;
    const urlR = `${BASE}/support/tickets/${chamado.id}`;

    // ── 0) Falha de rede NÃO vira "indisponível": erro com "Tentar de novo" ───
    const soDetalhe = (u) => new URL(u).pathname === `/api/v1/support/tickets/${chamado.id}`;
    await pr.route(soDetalhe, (r) => r.abort());
    await pr.goto(urlR, { waitUntil: 'domcontentloaded' });
    const caiu = await pr.waitForSelector('[data-testid=chamado-erro]', { timeout: 20000 }).then(() => true).catch(() => false);
    check(caiu && await pr.locator('[data-testid=chamado-indisponivel]').count() === 0,
      `[${vp.n}] falha de rede mostra erro com "Tentar de novo" (e não "indisponível")`);
    await pr.unroute(soDetalhe);
    await pr.click('[data-testid=chamado-tentar-de-novo]');
    await pr.waitForSelector('[data-testid=detalhe-protocolo]', { timeout: 15000 });
    check(true, `[${vp.n}] "Tentar de novo" carrega o chamado quando a rede volta`);

    // ── 1) Requisitante cancela, com motivo ──────────────────────────────────
    await abrir(pr, urlR);
    await pr.waitForSelector('[data-testid=acoes-requisitante]', { timeout: 15000 });
    check(await pr.locator('[data-testid=painel-atendimento]').count() === 0, `[${vp.n}] o requisitante não vê o painel de atendimento`);
    check(await pr.locator('[data-testid=transicao-cancel]').count() === 1, `[${vp.n}] o requisitante vê "Cancelar chamado"`);
    check(await pr.locator('[data-testid=transicao-close]').count() === 0, `[${vp.n}] e não vê "Encerrar" antes de resolvido`);
    // Foco devolvido após diálogo (acessibilidade): abrir, fechar com Esc, o foco volta ao botão.
    await pr.focus('[data-testid=transicao-cancel]');
    await pr.keyboard.press('Enter');
    await pr.waitForSelector('[data-testid=dialogo-motivo]');
    await pr.keyboard.press('Escape');
    await pr.waitForSelector('[data-testid=dialogo-motivo]', { state: 'detached', timeout: 10000 });
    await pr.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'transicao-cancel', null, { timeout: 5000 })
      .then(() => check(true, `[${vp.n}] fechar o diálogo com Esc devolve o foco ao botão que o abriu`))
      .catch(async () => check(false, `[${vp.n}] fechar o diálogo com Esc devolve o foco ao botão que o abriu (foco em: ${await pr.evaluate(() => document.activeElement?.outerHTML?.slice(0, 80))})`));

    await pr.click('[data-testid=transicao-cancel]');
    await pr.waitForSelector('[data-testid=dialogo-motivo]');
    check(!(await pr.locator('[data-testid=confirmar-motivo]').isEnabled()), `[${vp.n}] cancelar sem motivo fica travado`);
    await checarResponsivo(pr, check, `[${vp.n}] diálogo de cancelar aberto`);
    await checarAcessibilidade(pr, check, `[${vp.n}] diálogo de cancelar aberto`);
    await pr.fill('[data-testid=dialogo-motivo] textarea[name=reason]', 'Resolvemos com outra ferramenta.');
    await pr.click('[data-testid=confirmar-motivo]');
    await esperarEstado(pr, 'Cancelado');
    check(true, `[${vp.n}] o chamado fica "Cancelado"`);
    check(await pr.locator('[data-testid=aviso-reabre]').count() === 0, `[${vp.n}] em Cancelado, responder NÃO avisa que reabre`);
    check(await pr.locator('[data-testid=transicao-reopen]').count() === 1, `[${vp.n}] e "Reabrir chamado" aparece`);

    // ── 2) Atendente registra o trabalho residual; a tarefa segue cancelada ──
    await abrir(pc, urlC);
    const linha = pc.locator('[data-testid=tarefa]').first();
    await linha.locator('[data-testid=registrar-residual]').waitFor({ timeout: 15000 });
    check((await linha.locator('[data-testid=tarefa-status]').innerText()).trim() === 'Cancelada', `[${vp.n}] a tarefa em execução foi cancelada junto`);
    await linha.locator('[data-testid=registrar-residual]').click();
    await pc.waitForSelector('[data-testid=form-residual]');
    check((await pc.locator('[data-testid=explicacao-residual]').innerText()).includes('continua cancelada'), `[${vp.n}] o diálogo diz que a tarefa não volta`);
    await checarResponsivo(pc, check, `[${vp.n}] diálogo do apontamento residual aberto`);
    await checarAcessibilidade(pc, check, `[${vp.n}] diálogo do apontamento residual aberto`);
    await pc.fill('[data-testid=form-residual] textarea[name=activityDescription]', 'Metade do ajuste já estava pronta.');
    await pc.fill('[data-testid=form-residual] input[name=durationMinutes]', '25');
    await pc.click('[data-testid=confirmar-residual]');
    await pc.waitForSelector('[data-testid=form-residual]', { state: 'detached', timeout: 15000 });
    await pc.waitForFunction(() => !document.querySelector('[data-testid=registrar-residual]'), null, { timeout: 15000 });
    check((await pc.locator('[data-testid=tarefa] >> nth=0 >> [data-testid=tarefa-status]').innerText()).trim() === 'Cancelada',
      `[${vp.n}] depois do registro a tarefa CONTINUA cancelada, e o botão some`);
    await pc.waitForFunction(() => document.querySelector('[data-testid=total-executado]')?.textContent?.includes('25'), null, { timeout: 15000 });
    check(true, `[${vp.n}] as horas residuais entram no total (25 min)`);

    // ── 3) Reabrir o Cancelado exige justificativa ───────────────────────────
    await abrir(pr, urlR);
    await pr.click('[data-testid=transicao-reopen]');
    await pr.waitForSelector('[data-testid=dialogo-motivo]');
    check(!(await pr.locator('[data-testid=confirmar-motivo]').isEnabled()), `[${vp.n}] reabrir sem justificativa fica travado`);
    await pr.fill('[data-testid=dialogo-motivo] textarea[name=reason]', 'A ferramenta nova também falhou.');
    await pr.click('[data-testid=confirmar-motivo]');
    await esperarEstado(pr, 'Em análise');
    check(true, `[${vp.n}] reaberto: "Em análise"`);

    // ── 4) Resolvido: prazo do encerramento automático + aviso de reabertura ─
    await abrir(pc, urlC);
    await pc.click('[data-testid=transicao-resolve]');
    await pc.waitForSelector('[data-testid=dialogo-resolver]');
    await pc.click('[data-testid=confirmar-resolver]');
    await esperarEstado(pc, 'Resolvido');
    const detalhe = (await api(tokenReq, `/api/v1/support/tickets/${chamado.id}`)).body;
    const esperado = new Date(detalhe.autoCloseAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dias = Math.round((new Date(detalhe.autoCloseAt) - new Date(detalhe.resolvedAt)) / 86_400_000);
    check(dias === 30, `[${vp.n}] o servidor calcula o encerramento para resolvido + 30 dias (${dias})`);
    await abrir(pr, urlR);
    await pr.waitForSelector('[data-testid=aviso-encerramento-automatico]', { timeout: 15000 });
    const aviso = await pr.locator('[data-testid=aviso-encerramento-automatico]').innerText();
    check(aviso.includes(esperado), `[${vp.n}] a tela mostra a data do servidor (${esperado})`);
    const completa = await pr.locator('[data-testid=aviso-encerramento-automatico] time').getAttribute('title');
    check(!!completa && completa.includes('2026') && /\d{2}:\d{2}/.test(completa),
      `[${vp.n}] a data completa (com hora) fica consultável no título ("${completa}")`);
    check(await pr.locator('[data-testid=aviso-reabre]').count() === 1, `[${vp.n}] o compositor avisa: "este envio reabrirá o chamado"`);

    // ── 5) Encerrar pede confirmação: "Voltar" não encerra ───────────────────
    await pr.click('[data-testid=transicao-close]');
    const dialogo = pr.getByRole('dialog');
    await dialogo.waitFor({ timeout: 10000 });
    await dialogo.getByRole('button', { name: 'Voltar', exact: true }).click();
    await dialogo.waitFor({ state: 'detached', timeout: 10000 });
    await pr.waitForTimeout(300);
    check(await estadoDa(pr) === 'Resolvido', `[${vp.n}] "Voltar" na confirmação NÃO encerra`);
    await pr.click('[data-testid=transicao-close]');
    await pr.getByRole('dialog').getByRole('button', { name: 'Encerrar', exact: true }).click();
    await esperarEstado(pr, 'Encerrado');
    check(true, `[${vp.n}] confirmado, o chamado fica "Encerrado"`);
    check(await pr.locator('[data-testid=aviso-encerramento-automatico]').count() === 0, `[${vp.n}] encerrado, o aviso do prazo some`);
    check(await pr.locator('[data-testid=aviso-reabre]').count() === 1, `[${vp.n}] e o aviso de reabertura continua`);
    await pr.screenshot({ path: `${OUT}/suporte-ciclo-encerrado-${vp.n}.png`, fullPage: true });
    await checarResponsivo(pr, check, `[${vp.n}] requisitante (encerrado)`);
    await checarAcessibilidade(pr, check, `[${vp.n}] requisitante (encerrado)`);

    // ── 6) Responder ao Encerrado reabre de fato ─────────────────────────────
    await pr.fill('[data-testid=compositor] textarea[name=body]', 'Voltou a falhar hoje.');
    await pr.click('[data-testid=enviar-mensagem]');
    await esperarEstado(pr, 'Em análise');
    check(true, `[${vp.n}] a resposta ao Encerrado reabre ("Em análise")`);
    await pr.waitForFunction(() => !document.querySelector('[data-testid=aviso-reabre]'), null, { timeout: 15000 });
    check(true, `[${vp.n}] reaberto, o aviso de reabertura some`);
    await checarResponsivo(pc, check, `[${vp.n}] atendente`);
    await checarAcessibilidade(pc, check, `[${vp.n}] atendente`);
    await pc.screenshot({ path: `${OUT}/suporte-ciclo-atendente-${vp.n}.png`, fullPage: true });

    await ctxC.close();
    await ctxR.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Fase 6 do plano 26_09 — aprovações pela tela (SUP-05; aceites S-A13 a S-A16).
//
// O que esta suíte prova, e por quê:
//  (a) quem atende cria RASCUNHO, e o requisitante NÃO o vê; ao enviar, a tarefa abrangida mostra
//      que aguarda a proposta (com link) e perde o botão de iniciar — o bloqueio é visível;
//  (b) o requisitante decide VENDO versão, conteúdo e estimativa (a spec exige os três); rejeitar
//      exige motivo, e a rejeição devolve o chamado para análise;
//  (c) a revisão vira nova versão, a anterior fica visível ("versões anteriores"), e o aceite da
//      nova libera a tarefa e passa a compor a estimativa;
//  (d) dispensar a proposta exige motivo;
//  (e) 1280 e 375 sem overflow horizontal.
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
const perfil = await api(admin, '/api/v1/access-profiles', 'POST', { name: `Req F6 ${rid}`, permissions: ['workflow:read'] });
const req = await api(admin, '/api/v1/users', 'POST', {
  name: `Requisitante F6 ${rid}`, email: `req6-${rid}@prefeitura-x.local`, isInternal: true, accessProfileIds: [perfil.body.id],
});
const tokenReq = (await api(null, '/api/v1/auth/login', 'POST', { identifier: `req6-${rid}@prefeitura-x.local`, password: req.body.initialPassword })).body.accessToken;

const tc = await tokenCentral();
const eu = (await central(tc, '/me')).body;
const equipe = (await central(tc, '/support/teams/', 'POST', { name: `Aprovações F6 ${rid}` })).body;
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
  await page.fill('input[name=identifier]', `req6-${rid}@prefeitura-x.local`);
  await page.fill('input[name=password]', req.body.initialPassword);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}
const statusDa = (page) => page.locator('[data-testid=solicitacao] >> nth=0').getAttribute('data-status');
const esperarStatus = (page, st) => page.waitForFunction(
  (s) => document.querySelector('[data-testid=solicitacao]')?.getAttribute('data-status') === s, st, { timeout: 15000 });

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    // Cenário: chamado em análise, encaminhado, com uma tarefa de desenvolvimento.
    const chamado = (await api(tokenReq, '/api/v1/support/tickets', 'POST',
      { subject: `Relatório lento ${vp.n} ${rid}`, description: 'Demora minutos.', nature: 'improvement' })).body;
    let v = (await central(tc, `/support/tickets/${chamado.id}`)).body.version;
    await central(tc, `/support/tickets/${chamado.id}/transitions`, 'POST', { action: 'analyze', expectedVersion: v });
    v = (await central(tc, `/support/tickets/${chamado.id}`)).body.version;
    await central(tc, `/support/tickets/${chamado.id}/assign`, 'POST', { teamId: equipe.id, ownerId: eu.id, taskResolutions: [], expectedVersion: v });
    await central(tc, `/support/tickets/${chamado.id}/tasks`, 'POST',
      { title: `Otimizar consulta ${vp.n}`, description: 'Índice novo.', assigneeId: eu.id, category: 'development' });

    const ctxC = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const pc = await ctxC.newPage();
    const ctxR = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const pr = await ctxR.newPage();
    await entrarCentral(pc);
    await entrarAmbiente(pr);
    const urlC = `${BASE}/platform/support/tickets/${chamado.id}`;
    const urlR = `${BASE}/support/tickets/${chamado.id}`;

    // ── 1) Rascunho: invisível ao requisitante ───────────────────────────────
    await pc.goto(urlC, { waitUntil: 'networkidle' });
    await pc.click('[data-testid=nova-proposta]');
    await pc.waitForSelector('[data-testid=form-aprovacao]');
    await pc.fill('[data-testid=form-aprovacao] textarea[name=description]', 'Criar índice e paginar o relatório.');
    await pc.fill('[data-testid=form-aprovacao] input[name=estimatedMinutes]', '480');
    await pc.click('[data-testid=salvar-aprovacao]');
    await esperarStatus(pc, 'draft');
    check(true, `[${vp.n}] quem atende cria o rascunho`);

    await pr.goto(urlR, { waitUntil: 'networkidle' });
    await pr.waitForSelector('[data-testid=detalhe-protocolo]');
    check(await pr.locator('[data-testid=solicitacao]').count() === 0, `[${vp.n}] o rascunho é INVISÍVEL ao requisitante`);

    // ── 2) Enviar: a tarefa passa a mostrar o bloqueio, com link ─────────────
    await pc.click('[data-testid=submeter-aprovacao]');
    await esperarStatus(pc, 'pending');
    const tarefa = pc.locator('[data-testid=tarefa]').first();
    await tarefa.locator('[data-testid=tarefa-bloqueada]').waitFor({ timeout: 15000 });
    const link = await tarefa.locator('[data-testid=tarefa-bloqueada]').getAttribute('href');
    check(!!link && link.startsWith('#aprovacao-'), `[${vp.n}] a tarefa bloqueada aponta para a solicitação (${link})`);
    check(await tarefa.locator('[data-testid=iniciar-tarefa]').count() === 0, `[${vp.n}] e perde o botão de iniciar`);

    // ── 3) Requisitante rejeita VENDO versão, conteúdo e estimativa ──────────
    await pr.reload({ waitUntil: 'networkidle' });
    await pr.waitForSelector('[data-testid=solicitacao]', { timeout: 15000 });
    await pr.click('[data-testid=rejeitar]');
    await pr.waitForSelector('[data-testid=dialogo-decisao]');
    const resumo = await pr.locator('[data-testid=decisao-resumo]').innerText();
    check(/versão 1/.test(resumo) && resumo.includes('Criar índice e paginar') && /8 h/.test(resumo),
      `[${vp.n}] a decisão mostra versão, conteúdo e estimativa (${resumo.replace(/\s+/g, ' ').slice(0, 80)})`);
    check(!(await pr.locator('[data-testid=confirmar-decisao]').isEnabled()), `[${vp.n}] rejeitar sem motivo fica travado`);
    await pr.fill('[data-testid=dialogo-decisao] textarea[name=reason]', 'Oito horas é demais para isso.');
    await pr.click('[data-testid=confirmar-decisao]');
    await esperarStatus(pr, 'rejected');
    await pr.waitForFunction(() => document.querySelector('[data-testid=detalhe-estado]')?.textContent?.trim() === 'Em análise',
      null, { timeout: 15000 });
    check(true, `[${vp.n}] a rejeição devolve o chamado para "Em análise"`);

    // ── 4) Revisão → nova versão; a anterior continua visível ────────────────
    await pc.reload({ waitUntil: 'networkidle' });
    await pc.waitForSelector('[data-testid=revisar-aprovacao]', { timeout: 15000 });
    await pc.click('[data-testid=revisar-aprovacao]');
    await pc.waitForSelector('[data-testid=form-aprovacao]');
    await pc.fill('[data-testid=form-aprovacao] textarea[name=description]', 'Só o índice, sem paginação.');
    await pc.fill('[data-testid=form-aprovacao] input[name=estimatedMinutes]', '300');
    await pc.click('[data-testid=salvar-aprovacao]');
    await esperarStatus(pc, 'draft');
    await pc.click('[data-testid=submeter-aprovacao]');
    await esperarStatus(pc, 'pending');

    await pr.reload({ waitUntil: 'networkidle' });
    await esperarStatus(pr, 'pending');
    check(await pr.locator('[data-testid=versoes-anteriores]').count() === 1, `[${vp.n}] o requisitante vê que há versão anterior`);
    await pr.locator('[data-testid=versoes-anteriores] summary').click();
    const anteriores = await pr.locator('[data-testid=versoes-anteriores]').innerText();
    check(anteriores.includes('Criar índice e paginar') && anteriores.includes('Oito horas é demais'),
      `[${vp.n}] a versão anterior aparece com o motivo da rejeição`);

    // ── 5) Aprovar → libera a tarefa e a estimativa passa a valer ───────────
    await pr.click('[data-testid=aprovar]');
    await pr.waitForSelector('[data-testid=dialogo-decisao]');
    check(/versão 2/.test(await pr.locator('[data-testid=decisao-resumo]').innerText()), `[${vp.n}] aprova a versão 2 — a exata`);
    await pr.click('[data-testid=confirmar-decisao]');
    await esperarStatus(pr, 'approved');
    check((await pr.locator('[data-testid=total-estimado]').innerText()).trim() === '5 h',
      `[${vp.n}] a estimativa pública passa a ser a da proposta aprovada (5 h)`);

    await pc.reload({ waitUntil: 'networkidle' });
    await pc.locator('[data-testid=tarefa]').first().waitFor({ timeout: 15000 });
    check(await pc.locator('[data-testid=tarefa-bloqueada]').count() === 0
      && await pc.locator('[data-testid=iniciar-tarefa]').count() === 1,
      `[${vp.n}] aprovada, a tarefa volta a poder ser iniciada`);

    // ── 6) Dispensa exige motivo ──────────────────────────────────────────────
    await pc.click('[data-testid=dispensar-proposta]');
    await pc.waitForSelector('[data-testid=form-dispensa]');
    check(!(await pc.locator('[data-testid=confirmar-dispensa]').isEnabled()), `[${vp.n}] dispensar sem motivo fica travado`);
    await pc.keyboard.press('Escape');

    // ── 7) Validação da solução pela tela: grupo separado, SEM campo de estimativa ─────
    await pc.click('[data-testid=nova-validacao]');
    await pc.waitForSelector('[data-testid=form-aprovacao]');
    check(await pc.locator('[data-testid=form-aprovacao] input[name=estimatedMinutes]').count() === 0,
      `[${vp.n}] a validação da solução não oferece estimativa (é da proposta)`);
    await pc.fill('[data-testid=form-aprovacao] textarea[name=description]', 'Validar o relatório em homologação.');
    await pc.click('[data-testid=salvar-aprovacao]');
    await pc.waitForFunction(() => [...document.querySelectorAll('[data-testid=solicitacao]')]
      .some((el) => el.getAttribute('data-kind') === 'solution'), null, { timeout: 15000 });
    const kinds = await pc.locator('[data-testid=solicitacao]').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')).sort());
    check(JSON.stringify(kinds) === JSON.stringify(['proposal', 'solution']),
      `[${vp.n}] a validação é uma solicitação SEPARADA da proposta (${JSON.stringify(kinds)})`);

    await checarResponsivo(pc, check, `[${vp.n}] central`);

    await checarAcessibilidade(pc, check, `[${vp.n}] central`);
    await checarResponsivo(pr, check, `[${vp.n}] requisitante`);
    await checarAcessibilidade(pr, check, `[${vp.n}] requisitante`);
    await pc.screenshot({ path: `${OUT}/suporte-aprovacoes-central-${vp.n}.png`, fullPage: true });
    await pr.screenshot({ path: `${OUT}/suporte-aprovacoes-requisitante-${vp.n}.png`, fullPage: true });
    await ctxC.close();
    await ctxR.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Fase 11 — Plataforma: BFF + sessão em cookie httpOnly + SSR de bootstrap.
// Prova, no navegador real (web 1280 + mobile 375), que:
//  1) NENHUMA requisição a /api/tenant/config ou /api/v1/me sai do browser (o BFF
//     injeta o estado inicial no HTML) — interceptação de rede;
//  2) a sessão vive em cookie httpOnly (fim do token em localStorage);
//  3) login / logout funcionam por cookie; abas standalone continuam logadas;
//  4) as OG tags saem no HTML servido (crawlers sem JS).
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

// ── 1) OG / bootstrap / CSP no HTML servido (sem JS — como um crawler vê) ──────
{
  const r = await fetch(BASE + '/', { headers: { Accept: 'text/html' } });
  const html = await r.text();
  check(/<meta property="og:title" content="Prefeitura X[^"]*"/.test(html), 'HTML servido tem og:title com o nome do tenant');
  check(/<meta property="og:description"/.test(html), 'HTML servido tem og:description');
  check(/<title>Prefeitura X[^<]*<\/title>/.test(html), 'title do documento vem do tenant (SSR)');
  check(html.includes('window.__SEPTEM_BFF__') && html.includes('window.__BOOTSTRAP__'), 'HTML injeta __BOOTSTRAP__ (bootstrap no servidor)');
  check(/"tenant":\{"tenantId":"prefeitura-x"/.test(html.replace(/\s/g, '')), '__BOOTSTRAP__ traz o tenant resolvido pelo host');
  check((r.headers.get('content-security-policy') || '').includes("default-src 'self'"), 'resposta traz Content-Security-Policy');
  check((r.headers.get('x-content-type-options') || '') === 'nosniff', 'resposta traz X-Content-Type-Options: nosniff');
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

for (const view of [
  { name: 'web', width: 1280, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height } });
  const page = await ctx.newPage();

  // Grava toda chamada de bootstrap que ESCAPAR para o browser.
  const vazou = [];
  page.on('request', (req) => {
    const p = new URL(req.url()).pathname;
    if (p === '/api/tenant/config' || p === '/api/v1/me') vazou.push(`${view.name}:${p}`);
  });

  // ── 2) Carga anônima (/login): bootstrap NÃO chama /tenant/config nem /me ────
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.innerText.includes('Prefeitura X'), { timeout: 10000 }).catch(() => {});
  check(vazou.length === 0, `[${view.name}] carga anônima: nada de /tenant/config ou /me saiu do browser (${vazou.join(',') || 'ok'})`);

  // ── 3) Login por cookie: sessão httpOnly, nada em localStorage ───────────────
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
  const cookies = await ctx.cookies(BASE);
  const at = cookies.find((c) => c.name === 'septem_at');
  check(!!at && at.httpOnly, `[${view.name}] login grava sessão em cookie httpOnly (septem_at)`);
  const ls = await page.evaluate(() => ({ a: localStorage.getItem('septem.accessToken'), r: localStorage.getItem('septem.refreshToken') }));
  check(!ls.a && !ls.r, `[${view.name}] nenhum token em localStorage (só cookie httpOnly)`);
  const jsCookie = await page.evaluate(() => document.cookie);
  check(!/septem_at|septem_rt/.test(jsCookie), `[${view.name}] o token é inacessível ao JS (document.cookie sem septem_at/rt)`);

  // ── 4) Reload autenticado: bootstrap ainda não vaza /me nem /tenant/config ───
  vazou.length = 0;
  await page.goto(BASE + '/tarefas', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 10000 }).catch(() => {});
  check(vazou.length === 0, `[${view.name}] reload autenticado: /me e /tenant/config continuam server-side (${vazou.join(',') || 'ok'})`);

  // ── 5) Aba standalone continua logada (cookie compartilhado no contexto) ─────
  const tab = await ctx.newPage();
  await tab.goto(BASE + '/tarefas', { waitUntil: 'networkidle' });
  await tab.waitForTimeout(800);
  check(await tab.evaluate(() => !location.pathname.includes('/login')), `[${view.name}] aba standalone abre logada (cookie compartilhado)`);
  await tab.close();

  if (view.name === 'mobile') {
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!over, '[mobile] sem overflow horizontal');
  }

  // ── 6) Logout por cookie: o BFF limpa a sessão; protegido volta pro login ─────
  // (o botão de Sair da UI é coberto pelo fase0-bugs; aqui provamos o EFEITO do
  //  logout-por-cookie sem depender do menu off-canvas.)
  const logoutStatus = await page.evaluate(async () => {
    const r = await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    return r.status;
  });
  check(logoutStatus === 204, `[${view.name}] POST /auth/logout responde 204 (BFF limpa cookies)`);
  const apos = await ctx.cookies(BASE);
  const aindaTem = apos.find((c) => c.name === 'septem_at' && c.value);
  check(!aindaTem, `[${view.name}] logout limpa o cookie de sessão (septem_at)`);
  await page.goto(BASE + '/tarefas', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => location.pathname.includes('/login'), { timeout: 10000 }).catch(() => {});
  check(page.url().includes('login'), `[${view.name}] após logout, página protegida redireciona ao login`);

  await page.screenshot({ path: `${OUT}/bff-f11-${view.name}.png`, fullPage: true }).catch(() => {});
  await ctx.close();
}

await browser.close();
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

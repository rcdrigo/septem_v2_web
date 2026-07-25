import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
const BASE = 'http://localhost:5173';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

// Fase 11: a sessão vive em cookie httpOnly. "Expirar o access" = corromper o
// cookie septem_at; o BFF renova sozinho pelo septem_rt (refresh).
async function loginFresh(keep) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const cb = page.locator('label:has-text("Manter-me conectado") input');
  if (keep) await cb.check(); else await cb.uncheck();
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
  return { ctx, page };
}
const corromperAccess = async (ctx) => {
  await ctx.clearCookies({ name: 'septem_at' });
  await ctx.addCookies([{ name: 'septem_at', value: 'invalido.expirado.token', url: BASE, httpOnly: true }]);
};

// ── Cenário 1: MARCADO — access "expira" → sessão se RENOVA sozinha (refresh) ──
{
  const { ctx, page } = await loginFresh(true);
  const antes = (await ctx.cookies(BASE)).find((c) => c.name === 'septem_at')?.value;
  await corromperAccess(ctx);
  await page.goto(`${BASE}/admin/usuarios`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => location.pathname.includes('/admin/usuarios')
      && (document.body.innerText.includes('Usuários') || document.body.innerText.includes('usuário')),
    { timeout: 12000 },
  ).catch(() => {});
  const naPagina = await page.evaluate(() => location.pathname.includes('/admin/usuarios')
    && (document.body.innerText.includes('Usuários') || document.body.innerText.includes('usuário')));
  const depois = (await ctx.cookies(BASE)).find((c) => c.name === 'septem_at')?.value;
  check(naPagina, 'marcado: sessão RENOVADA — página protegida abriu normalmente');
  check(!!depois && depois !== 'invalido.expirado.token' && depois !== antes, 'marcado: access token foi trocado pelo refresh (cookie rotacionado)');
  await ctx.close();
}

// ── Cenário 2: DESMARCADO — access "expira" e SEM refresh → volta pro LOGIN ────
{
  const { ctx, page } = await loginFresh(false);
  // Sem "manter conectado": simula fim da sessão apagando o refresh e corrompendo o access.
  await ctx.clearCookies();
  await ctx.addCookies([{ name: 'septem_at', value: 'invalido.expirado.token', url: BASE, httpOnly: true }]);
  await page.goto(`${BASE}/admin/usuarios`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => location.pathname.includes('/login'), { timeout: 10000 }).catch(() => {});
  check(await page.evaluate(() => location.pathname.includes('/login')), 'desmarcado: sem refresh, sessão expirada CAI para o login');
  await ctx.close();
}

// ── Cenário 3: abas standalone continuam logadas (cookie compartilhado no ctx) ─
{
  const { ctx, page } = await loginFresh(true);
  const tab2 = await ctx.newPage();
  await tab2.goto(`${BASE}/tarefas`, { waitUntil: 'networkidle' });
  await tab2.waitForTimeout(1200);
  check(await tab2.evaluate(() => !location.pathname.includes('/login')), 'segunda aba entra logada (cookie httpOnly compartilhado)');
  await ctx.close();
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function loginFresh(keep) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  const cb = page.locator('label:has-text("Manter-me conectado") input');
  if (keep) await cb.check(); else await cb.uncheck();
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
  return { ctx, page };
}

// ── Cenário 1: MARCADO — access token "expira" → sessão se RENOVA sozinha ────
{
  const { ctx, page } = await loginFresh(true);
  // simula expiração corrompendo o access token (o refresh continua válido)
  await page.evaluate(() => localStorage.setItem('septem.accessToken', 'token-expirado-invalido'));
  await page.goto('http://localhost:5173/admin/usuarios', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const renovada = await page.evaluate(() => ({
    naPagina: location.pathname.includes('/admin/usuarios'),
    conteudo: document.body.innerText.includes('Usuários') || document.body.innerText.includes('usuário'),
    tokenNovo: localStorage.getItem('septem.accessToken') !== 'token-expirado-invalido',
  }));
  check(renovada.naPagina && renovada.conteudo, 'marcado: sessão RENOVADA — página protegida abriu normalmente');
  check(renovada.tokenNovo, 'marcado: access token foi trocado pelo refresh automático');
  await ctx.close();
}

// ── Cenário 2: DESMARCADO — access "expira" → volta pro LOGIN ────────────────
{
  const { ctx, page } = await loginFresh(false);
  await page.evaluate(() => localStorage.setItem('septem.accessToken', 'token-expirado-invalido'));
  await page.goto('http://localhost:5173/admin/usuarios', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const caiu = await page.evaluate(() => location.pathname.includes('/login'));
  check(caiu, 'desmarcado: sem refresh token, sessão expirada CAI para o login');
  await ctx.close();
}

// ── Cenário 3: MARCADO — abas standalone continuam compartilhando a sessão ───
{
  const { ctx, page } = await loginFresh(true);
  const tab2 = await ctx.newPage();
  await tab2.goto('http://localhost:5173/tarefas', { waitUntil: 'networkidle' });
  await tab2.waitForTimeout(1200);
  check(await tab2.evaluate(() => !location.pathname.includes('/login')), 'segunda aba entra logada (localStorage compartilhado)');
  await ctx.close();
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

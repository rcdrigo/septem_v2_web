import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));

// ── layout desktop ────────────────────────────────────────────────────────────
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
// tenant chega via bootstrap (fetch anônimo) — espera o nome real renderizar
await page.waitForFunction(() => document.body.innerText.includes('Prefeitura X'), { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/login-desktop.png` });

const layout = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ').trim();
  return {
    headline: t.includes('Processos claros, conformidade em cada decisão.'),
    eyebrow: t.includes('PROCESSOS & COMPLIANCE'),
    welcome: t.includes('Bem-vindo de volta') && t.includes('Entre com seus dados para acessar o Septem.'),
    cards: t.includes('Precisa de ajuda?') && t.includes('Consultar processo'),
    extras: t.includes('Manter-me conectado') && t.includes('Esqueci minha senha') && t.includes('Solicitar acesso') && t.includes('Tecnologia'),
    tenant: t.includes('Prefeitura X') && t.includes('Gestão integrada'),
  };
});
for (const [k, v] of Object.entries(layout)) check(v, `layout: ${k}`);

// toggle de senha (olho)
await page.fill('input[type=password]', 'segredo123');
await page.locator('button[aria-label="Mostrar senha"]').click();
check(await page.locator('input[type=text][placeholder*="•"]').count() === 1, 'olho revela a senha (type=text)');
await page.locator('button[aria-label="Esconder senha"]').click();
check(await page.locator('input[type=password]').count() === 1, 'olho esconde de volta (type=password)');

// ── mobile ────────────────────────────────────────────────────────────────────
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(500);
const mob = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
check(!mob, 'mobile sem scroll horizontal');
await page.screenshot({ path: `${OUT}/login-mobile.png`, fullPage: true });
await page.setViewportSize({ width: 1440, height: 900 });

// ── Fase 11: a sessão vive em COOKIE httpOnly (fim do token em localStorage). ──
// SEM "manter-me conectado" → cookies de SESSÃO (sem expiração persistente).
await page.locator('label:has-text("Manter-me conectado") input').uncheck();
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
const ck1 = await ctx.cookies('http://localhost:5173');
const at1 = ck1.find((c) => c.name === 'septem_at');
const rt1 = ck1.find((c) => c.name === 'septem_rt');
const ls1 = await page.evaluate(() => ({
  access: !!localStorage.getItem('septem.accessToken'),
  refresh: !!localStorage.getItem('septem.refreshToken'),
}));
check(!!at1 && at1.httpOnly && !!rt1 && rt1.httpOnly, 'sessão em cookie httpOnly (at + rt)');
check(!ls1.access && !ls1.refresh, 'NENHUM token em localStorage (só cookie httpOnly)');
check(rt1?.expires === -1, `desmarcado: refresh é cookie de SESSÃO (expires=${rt1?.expires})`);

// COM "manter-me conectado" (default) → refresh cookie PERSISTENTE (com expiração).
await ctx.clearCookies();
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
const ck2 = await ctx.cookies('http://localhost:5173');
const rt2 = ck2.find((c) => c.name === 'septem_rt');
check(!!rt2 && rt2.expires > 0, `marcado (default): refresh cookie PERSISTENTE (expires=${rt2?.expires})`);

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

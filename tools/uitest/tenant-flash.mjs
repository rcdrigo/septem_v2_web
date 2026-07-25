// Fase 11 — fim do "flash" do fallback de tenant. Antes, o cliente buscava
// /api/tenant/config e piscava "Septem" até responder. Agora o BFF injeta o
// tenant no HTML (SSR): o branding real aparece no 1º byte e o cliente NEM chama
// /tenant/config. Provamos bloqueando esse endpoint por completo — se o cliente
// dependesse dele, quebraria; como vem do SSR, o branding aparece mesmo assim.
import { chromium } from 'playwright-core';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

// Contexto NOVO (sem cache) + /api/tenant/config ABORTADO: o branding só pode vir do SSR.
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
let tenantConfigChamado = false;
await page.route('**/api/tenant/config', async (r) => { tenantConfigChamado = true; await r.abort(); });

// 1) Login: o tenant vem do SSR mesmo com /tenant/config bloqueado.
await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
const login = await page.evaluate(() => ({
  og: document.querySelector('meta[property="og:title"]')?.content ?? '',
  cached: localStorage.getItem('septem.tenant'),
  body: document.body.innerText,
}));
check(login.og.includes('Prefeitura X'), `SSR injeta og:title com o tenant (og:title="${login.og}")`);
check(!!login.cached && login.cached.includes('Prefeitura X'), 'tenant do SSR fica cacheado no localStorage');
check(!tenantConfigChamado, 'o cliente NÃO chama /api/tenant/config (veio do SSR)');

// 2) Login normal → tenant continua cacheado após entrar.
await page.unroute('**/api/tenant/config');
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
await page.waitForTimeout(500);
check(await page.evaluate(() => !!localStorage.getItem('septem.tenant')), 'tenant cacheado no localStorage após o login');

// 3) Aba STANDALONE (/servico) com /tenant/config atrasado 4s: branding do SSR
//    aparece bem antes, sem flash do fallback "Septem".
await page.route('**/api/tenant/config', async (r) => { await new Promise((res) => setTimeout(res, 4000)); await r.continue(); });
await page.goto('http://localhost:5173/servico/teste_condicoes_ui', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200); // bem antes dos 4s
const standalone = await page.evaluate(() => ({
  og: document.querySelector('meta[property="og:title"]')?.content ?? '',
  header: (document.querySelector('header')?.innerText ?? '').toUpperCase(),
}));
check(standalone.og.includes('Prefeitura X'), `aba standalone traz o branding do SSR (og:title="${standalone.og}")`);
check(!/\bSEPTEM\b/.test(standalone.header), 'sem fallback "Septem" no header (fim do flash)');

await ctx.close();
console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

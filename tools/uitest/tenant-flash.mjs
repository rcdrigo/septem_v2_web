import { chromium } from 'playwright-core';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// 1ª visita: login normal (aquece o cache do tenant)
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
await page.waitForTimeout(1000);
check(await page.evaluate(() => !!localStorage.getItem('septem.tenant')), 'tenant cacheado no localStorage após o bootstrap');

// Aba STANDALONE (/servico) com /api/tenant/config atrasado 4s. O cabeçalho de
// execução não exibe mais o nome do cliente (decisão de produto — servico-header.mjs
// exige o header sem a linha de ambiente/cliente), então o que se prova aqui é o
// efeito que resta do cache: o branding do tenant já está APLICADO antes do fetch
// (meta tags de compartilhamento) e não há flash do fallback "Septem".
await page.route('**/api/tenant/config', async (r) => {
  await new Promise((res) => setTimeout(res, 4000));
  await r.continue();
});
await page.goto('http://localhost:5173/servico/teste_condicoes_ui', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200); // bem antes dos 4s do fetch
const standalone = await page.evaluate(() => ({
  og: document.querySelector('meta[property="og:title"]')?.content ?? '',
  header: (document.querySelector('header')?.innerText ?? '').toUpperCase(),
}));
check(standalone.og.includes('Prefeitura X'), `aba standalone aplica o branding do cache antes do fetch (og:title="${standalone.og}")`);
check(!/\bSEPTEM\b/.test(standalone.header), 'sem fallback "Septem" no header (fim do flash)');

// LOGIN: painel usa copy fixa — não depende do tenant, logo não pisca.
await page.unroute('**/api/tenant/config');
await page.evaluate(() => { localStorage.clear(); });
await page.route('**/api/tenant/config', async (r) => {
  await new Promise((res) => setTimeout(res, 4000));
  await r.continue();
});
await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
const loginText = await page.evaluate(() => document.body.innerText);
check(loginText.includes('Prefeitura Municipal'), 'login mostra a copy fixa imediatamente (sem tenant)');

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

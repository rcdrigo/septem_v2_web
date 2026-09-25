/**
 * Área central da Septem (Fase 2a do plano 26_09).
 *
 * O que esta suíte protege, em ordem de importância:
 *  1. **Segregação** — a sessão de um AMBIENTE não abre a área central, e a sessão
 *     central não vaza para o ambiente. É a propriedade que justifica a fase.
 *  2. **2FA obrigatório** — a senha sozinha nunca entra (Q5).
 *  3. Guarda de rota, listagem/detalhe, logout e layout em 1280 e 375.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const EMAIL = 'super@septem.local';
const SENHA = 'super123';

let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

/** Faz o login central pela TELA, lendo o código do 2FA da caixa de dev. */
async function entrarNaCentral(page) {
  await page.goto(BASE + '/platform/clients', { waitUntil: 'networkidle' });
  await page.waitForSelector('input[name=email]');
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', SENHA);
  await page.click('button[type=submit]');
  await page.waitForSelector('input[name=code]', { timeout: 10000 });
  // Pelo caminho relativo: o proxy do Vite leva ao backend. Um fetch direto para
  // :5000 de dentro da página seria barrado por CORS.
  const code = await page.evaluate(async () => {
    const r = await fetch('/api/v1/platform/auth/dev/last-code?email=super@septem.local');
    return (await r.json()).code;
  });
  await page.fill('input[name=code]', code);
  await page.click('button[type=submit]');
  await page.waitForSelector('[data-testid=platform-clientes-lista], [data-testid=platform-clientes-vazio]', { timeout: 15000 });
}

// ── 1. Guarda de rota: sem sessão central, /platform cai no login ─────────────
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));

await page.goto(BASE + '/platform/clients', { waitUntil: 'networkidle' });
check(page.url().includes('/platform/login'), `sem sessão, /platform/clients vai para o login central (${page.url()})`);
check(await page.locator('input[name=email]').count() === 1, 'o login central pede e-mail');
await page.screenshot({ path: `${OUT}/platform-login-desktop.png` });

// ── 2. A senha sozinha NÃO entra: o 2FA é obrigatório ────────────────────────
await page.fill('input[name=email]', EMAIL);
await page.fill('input[name=password]', SENHA);
await page.click('button[type=submit]');
await page.waitForSelector('input[name=code]', { timeout: 10000 });
check(await page.locator('input[name=code]').count() === 1, 'senha correta leva ao código, não à sessão');
check(
  await page.evaluate(() => localStorage.getItem('septem.platform.accessToken')) === null,
  'nenhum token é gravado antes do 2FA',
);
check(
  (await page.locator('[data-testid=platform-2fa-aviso]').innerText()).includes('@septem.local'),
  'a tela diz para onde o código foi (e-mail mascarado)',
);

// ── 3. Código errado é recusado com motivo ───────────────────────────────────
await page.fill('input[name=code]', '000000');
await page.click('button[type=submit]');
await page.waitForSelector('[data-testid=platform-login-aviso]', { timeout: 10000 });
const avisoErro = await page.locator('[data-testid=platform-login-aviso]').innerText();
check(/[Cc]ódigo/.test(avisoErro), `código errado é recusado com motivo: "${avisoErro}"`);

// ── 4. Código certo entra e lista os clientes ────────────────────────────────
const code = await page.evaluate(async () => {
  const r = await fetch('/api/v1/platform/auth/dev/last-code?email=super@septem.local');
  return (await r.json()).code;
});
await page.fill('input[name=code]', code);
await page.click('button[type=submit]');
await page.waitForSelector('[data-testid=platform-clientes-lista], [data-testid=platform-clientes-vazio]', { timeout: 15000 });
check(page.url().includes('/platform/clients'), 'o 2FA correto leva à lista de clientes');
check(
  (await page.locator('[data-testid=platform-identidade]').innerText()).length > 0,
  'o cabeçalho mostra quem está logado na central',
);
await page.screenshot({ path: `${OUT}/platform-clientes-desktop.png` });

const cartoes = await page.locator('[data-testid=platform-clientes-lista] a').allTextContents();
check(cartoes.length > 0, `lista de clientes com ${cartoes.length} cartão(ões)`);
check(cartoes.every((t) => /ambiente/.test(t)), 'cada cartão diz quantos ambientes o cliente tem');

// ── 5. A sessão central NÃO carrega o token do ambiente, nem vice-versa ──────
const chaves = await page.evaluate(() => ({
  central: localStorage.getItem('septem.platform.accessToken'),
  ambiente: localStorage.getItem('septem.accessToken'),
}));
check(!!chaves.central, 'a sessão central guarda o token em chave própria');
check(chaves.central !== chaves.ambiente, 'o token central é diferente do token de ambiente');

// A prova que interessa: o token central não vale numa rota de ambiente.
const cruzado = await page.evaluate(async () => {
  const token = localStorage.getItem('septem.platform.accessToken');
  const r = await fetch('/api/v1/audit-logs', {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant': 'prefeitura-x' },
  });
  return r.status;
});
check(cruzado === 401, `token central recusado em rota de ambiente (HTTP ${cruzado})`);

// ── 6. Detalhe do cliente: finalidade e modo aparecem ────────────────────────
await page.locator('[data-testid=platform-clientes-lista] a').first().click();
await page.waitForSelector('[data-testid=platform-cliente-nome]', { timeout: 10000 });
check(page.url().includes('/platform/clients/'), 'o cartão abre o detalhe do cliente');
const ambientes = await page.locator('[data-testid=platform-ambientes] li').allTextContents();
check(ambientes.length > 0, `detalhe lista ${ambientes.length} ambiente(s)`);
check(
  ambientes.every((t) => /Finalidade/.test(t) && /Modo/.test(t)),
  'todo ambiente mostra finalidade e modo (a spec pede em todo detalhe)',
);
check(
  // Q18 (Fase 12): o rótulo do ambiente de homologação passou a dizer "Ambiente de
  // homologação", para não se confundir com a "versão em homologação". A checagem
  // continua sendo a mesma: valor traduzido, nunca o cru da API.
  ambientes.every((t) => /Produção|homologação|Demonstração/i.test(t))
    && ambientes.every((t) => !/\b(production|staging|demo)\b/.test(t)),
  'a finalidade aparece traduzida, não com o valor cru da API',
);
await page.screenshot({ path: `${OUT}/platform-cliente-desktop.png` });

// ── 7. Cliente inexistente não quebra a tela ─────────────────────────────────
await page.goto(BASE + '/platform/clients/00000000-0000-0000-0000-000000000000', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid=platform-cliente-404]', { timeout: 10000 });
check(true, 'cliente inexistente mostra "não encontrado", sem tela quebrada');

// ── 8. Recarregar mantém a sessão central ────────────────────────────────────
await page.goto(BASE + '/platform/clients', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid=platform-clientes-lista]', { timeout: 10000 });
check(!page.url().includes('login'), 'F5 na área central não devolve ao login');

// ── 9. Sair limpa a sessão central ───────────────────────────────────────────
await page.click('[data-testid=platform-sair]');
await page.waitForURL((u) => u.pathname.includes('/platform/login'), { timeout: 10000 });
check(
  await page.evaluate(() => localStorage.getItem('septem.platform.accessToken')) === null,
  'sair apaga o token central do navegador',
);
await ctx.close();

// ── 10. Sessão de AMBIENTE não abre a área central ───────────────────────────
const ctxAmb = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const amb = await ctxAmb.newPage();
await amb.goto(BASE + '/login', { waitUntil: 'networkidle' });
await amb.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await amb.fill('input[type=password]', 'admin123');
await amb.click('button[type=submit]');
await amb.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
check(
  await amb.evaluate(() => localStorage.getItem('septem.accessToken')) !== null,
  'a sessão de ambiente foi estabelecida (pré-condição do caso)',
);
await amb.goto(BASE + '/platform/clients', { waitUntil: 'networkidle' });
check(
  amb.url().includes('/platform/login'),
  `admin do ambiente logado NÃO entra na área central (${amb.url()})`,
);
// E o token do ambiente também não vale na rota central.
const central = await amb.evaluate(async () => {
  const token = localStorage.getItem('septem.accessToken');
  const r = await fetch('/api/v1/platform/clients/', { headers: { Authorization: `Bearer ${token}` } });
  return r.status;
});
check(central === 401 || central === 403, `token de ambiente recusado na rota central (HTTP ${central})`);
await ctxAmb.close();

// ── 11. Mobile 375: login e lista sem estouro horizontal ─────────────────────
const ctxMob = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mob = await ctxMob.newPage();
await mob.goto(BASE + '/platform/login', { waitUntil: 'networkidle' });
await mob.screenshot({ path: `${OUT}/platform-login-mobile.png` });
check(
  await mob.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  'login central não rola na horizontal em 375',
);
await entrarNaCentral(mob);
await mob.screenshot({ path: `${OUT}/platform-clientes-mobile.png` });
check(
  await mob.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  'lista de clientes não rola na horizontal em 375',
);
check(
  await mob.locator('[data-testid=platform-sair]').isVisible(),
  'o botão Sair continua alcançável em 375',
);
await mob.locator('[data-testid=platform-clientes-lista] a').first().click();
await mob.waitForSelector('[data-testid=platform-ambientes]', { timeout: 10000 });
await mob.screenshot({ path: `${OUT}/platform-cliente-mobile.png` });
check(
  await mob.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  'detalhe do cliente não rola na horizontal em 375',
);
await ctxMob.close();

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

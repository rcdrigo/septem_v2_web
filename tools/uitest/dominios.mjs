/**
 * Domínio próprio e verificação (ADM-03/M-A09, Fase 11b).
 *
 * O que a tela precisa deixar claro, e é o que esta suíte mede:
 *  - o endereço da plataforma funciona desde o primeiro dia;
 *  - cadastrar um domínio próprio NÃO o verifica — e a tela diz o que fazer no DNS;
 *  - verificar um domínio que não aponta continua pendente, com motivo acionável.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ALVO = 'prefeitura-x';
const host = `servicos${Math.random().toString(36).slice(2, 7)}.prefeitura.test`;

let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function entrarNaCentral(page) {
  await page.goto(BASE + '/platform/clients', { waitUntil: 'networkidle' });
  await page.waitForSelector('input[name=email]', { timeout: 60000 });
  await page.fill('input[name=email]', 'super@septem.local');
  await page.fill('input[name=password]', 'super123');
  await page.click('button[type=submit]');
  await page.waitForSelector('input[name=code]', { timeout: 15000 });
  const code = await page.evaluate(async () => {
    const r = await fetch('/api/v1/platform/auth/dev/last-code?email=super@septem.local');
    return (await r.json()).code;
  });
  await page.fill('input[name=code]', code);
  await page.click('button[type=submit]');
  await page.waitForSelector('[data-testid=platform-clientes-lista]', { timeout: 20000 });
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));

await entrarNaCentral(page);
await page.goto(`${BASE}/platform/environments/${ALVO}`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid=dominios]', { timeout: 20000 });

// ── 1. O endereço da plataforma aparece ──────────────────────────────────────
const daPlataforma = await page.locator('[data-testid=host-da-plataforma]').innerText();
check(/prefeitura-x/.test(daPlataforma),
  `o endereço da plataforma aparece ("${daPlataforma.slice(0, 60)}")`);

const explicacao = await page.locator('[data-testid=dominios]').innerText();
check(/depois de verificado/i.test(explicacao),
  'a tela explica que o domínio próprio só vale depois de verificado');

// ── 2. Cadastrar não verifica — e a tela diz o que fazer no DNS ──────────────
await page.fill('input[name=novoDominio]', host);
await page.locator('[data-testid=adicionar-dominio]').click();
await page.waitForSelector('[data-testid=instrucao-dns]', { timeout: 15000 });

const instrucao = await page.locator('[data-testid=instrucao-dns]').innerText();
check(/CNAME/.test(instrucao) && instrucao.includes(host),
  `a tela dá a instrução de DNS ("${instrucao.slice(0, 70)}")`);

await page.waitForSelector(`[data-testid="dominio-status-${host}"]`, { timeout: 15000 });
const situacao = await page.locator(`[data-testid="dominio-status-${host}"]`).innerText();
check(/pendente/i.test(situacao), `cadastrar NÃO verifica: continua "${situacao}"`);
await page.screenshot({ path: `${OUT}/dominios-pendente.png` });

// ── 3. Verificar um domínio que não aponta continua pendente, COM motivo ─────
await page.locator(`[data-testid="verificar-${host}"]`).click();
await page.waitForFunction((h) => {
  const item = document.querySelector(`[data-testid="dominio-status-${h}"]`)?.closest('li');
  return item && /DNS|não respondeu|Confira/i.test(item.innerText);
}, host, { timeout: 20000 }).catch(() => {});

const depois = await page.locator(`[data-testid="dominio-status-${host}"]`).innerText();
check(/pendente/i.test(depois),
  `verificar sem DNS não marca como verificado (continua "${depois}")`);

const linha = await page.locator(`[data-testid="dominio-status-${host}"]`).locator('xpath=ancestor::li').innerText();
check(/DNS|não respondeu|Confira/i.test(linha),
  'a falha vem com motivo acionável na tela');
check(!/Exception|Socket|at Septem/i.test(linha),
  'o motivo não expõe detalhe técnico');
await page.screenshot({ path: `${OUT}/dominios-verificacao.png` });

// ── 4. Mobile ────────────────────────────────────────────────────────────────
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(400);
check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  'a seção de endereços não rola na horizontal em 375');
await page.screenshot({ path: `${OUT}/dominios-mobile.png` });

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

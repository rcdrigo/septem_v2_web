/**
 * Funcionalidades por ambiente (ADM-04, Fase 10).
 *
 * Prova o EFEITO, não a existência da tela: desligar uma funcionalidade na área central
 * some com o item no menu do ambiente, e a rota direta é recusada — com os dados
 * intactos quando ela volta (M-A13).
 *
 * ⚠️ Mexe nas funcionalidades do ambiente de dev e SEMPRE as devolve ao padrão no fim,
 * em duas camadas (tela e API), senão as suítes seguintes herdam um ambiente capado.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ALVO = 'prefeitura-x';
const PADRAO = ['documents', 'signatures', 'reports', 'public_portal', 'public_validation', 'manuals'];

let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function entrarNaCentral(page) {
  await page.goto(BASE + '/platform/clients', { waitUntil: 'networkidle' });
  await page.waitForSelector('input[name=email]');
  await page.fill('input[name=email]', 'super@septem.local');
  await page.fill('input[name=password]', 'super123');
  await page.click('button[type=submit]');
  await page.waitForSelector('input[name=code]', { timeout: 10000 });
  const code = await page.evaluate(async () => {
    const r = await fetch('/api/v1/platform/auth/dev/last-code?email=super@septem.local');
    return (await r.json()).code;
  });
  await page.fill('input[name=code]', code);
  await page.click('button[type=submit]');
  await page.waitForSelector('[data-testid=platform-clientes-lista]', { timeout: 15000 });
}

/** Define o conjunto pela API central, usando o token que a tela já guardou. */
async function definirFuncionalidades(page, chaves) {
  return page.evaluate(async ({ alvo, chaves }) => {
    const token = localStorage.getItem('septem.platform.accessToken');
    const r = await fetch(`/api/v1/platform/environments/${alvo}/features`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: chaves }),
    });
    return r.status;
  }, { alvo: ALVO, chaves });
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));

try {
  await entrarNaCentral(page);

  // ── 1. A central mostra o catálogo, com o que ainda não existe marcado ─────
  await page.goto(`${BASE}/platform/environments/${ALVO}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=funcionalidades]', { timeout: 10000 });
  const quantas = await page.locator('[data-testid=funcionalidades] li').count();
  check(quantas >= 6, `o catálogo lista ${quantas} funcionalidades`);
  check(await page.locator('[data-testid=indisponivel-dashboards]').isVisible(),
    'dashboards aparece no catálogo marcado como indisponível (Q17)');
  check(await page.locator('[data-testid=indisponivel-ai_agents]').isVisible(),
    'agentes de IA aparece no catálogo marcado como indisponível (Q17)');
  const textoAviso = await page.locator('[data-testid=funcionalidades]').locator('xpath=..').innerText();
  check(/nenhum dado é apagado/i.test(textoAviso),
    'a tela avisa que desabilitar não apaga dados');
  await page.screenshot({ path: `${OUT}/funcionalidades-central.png` });

  // ── 2. Ligada: o item aparece no ambiente e a rota responde ────────────────
  check(await definirFuncionalidades(page, PADRAO) === 200, 'funcionalidades voltaram ao padrão');

  const ambCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const amb = await ambCtx.newPage();
  await amb.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await amb.fill('input[name=identifier]', `admin@${ALVO}.local`);
  await amb.fill('input[type=password]', 'admin123');
  await amb.click('button[type=submit]');
  await amb.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
  await amb.waitForTimeout(500);

  // "Manuais" vive DENTRO do grupo "Configurações", que nasce fechado: ler o innerText
  // do menu sem abrir o grupo daria "não está lá" sempre — e o check de "sumiu" passaria
  // em falso mesmo com o filtro quebrado. Abrimos o grupo e medimos o link de verdade.
  const abrirConfiguracoes = async (pagina) => {
    const grupo = pagina.locator('nav button', { hasText: 'Configurações' }).first();
    if (await grupo.count()) await grupo.click();
    await pagina.waitForTimeout(300);
  };
  const temItemManuais = (pagina) => pagina.locator('nav a[href$="/admin/manuals"]').count();

  await abrirConfiguracoes(amb);
  check(await temItemManuais(amb) === 1, 'com a funcionalidade ligada, "Manuais" está no menu');

  const httpCom = await amb.evaluate(async () => (await fetch('/api/v1/manuals', {
    headers: { Authorization: `Bearer ${localStorage.getItem('septem.accessToken')}`, 'X-Tenant': 'prefeitura-x' },
  })).status);
  check(httpCom === 200, `com a funcionalidade ligada, a rota responde (HTTP ${httpCom})`);

  // ── 3. Desligada pela central: some do menu e a rota recusa ────────────────
  check(await definirFuncionalidades(page, PADRAO.filter((k) => k !== 'manuals')) === 200,
    'manuais desligado pela área central');

  await amb.reload({ waitUntil: 'networkidle' });
  await amb.waitForTimeout(800);
  await abrirConfiguracoes(amb);
  // Guarda contra check que passa em falso: o grupo TEM de estar aberto (outros itens
  // visíveis) para "não achei Manuais" significar alguma coisa.
  const irmaosVisiveis = await amb.locator('nav a[href$="/admin/users"]').count();
  check(irmaosVisiveis === 1, 'o grupo Configurações está aberto (pré-condição do caso)');
  check(await temItemManuais(amb) === 0, 'desligada, "Manuais" some do menu do ambiente');

  const resposta = await amb.evaluate(async () => {
    const r = await fetch('/api/v1/manuals', {
      headers: { Authorization: `Bearer ${localStorage.getItem('septem.accessToken')}`, 'X-Tenant': 'prefeitura-x' },
    });
    return { http: r.status, corpo: await r.json() };
  });
  check(resposta.http === 403 && resposta.corpo.error === 'feature_disabled',
    `a rota é recusada com feature_disabled (HTTP ${resposta.http})`);
  check(/Entre em contato com a Septem para resolução\./.test(resposta.corpo.detail ?? ''),
    `a mensagem é a que a spec fixa: "${(resposta.corpo.detail ?? '').slice(0, 60)}"`);
  await amb.screenshot({ path: `${OUT}/funcionalidades-desligada.png` });

  // ── 4. Religada: nada foi perdido ──────────────────────────────────────────
  check(await definirFuncionalidades(page, PADRAO) === 200, 'manuais religado');
  await amb.reload({ waitUntil: 'networkidle' });
  await amb.waitForTimeout(800);
  await abrirConfiguracoes(amb);
  check(await temItemManuais(amb) === 1, 'religada, "Manuais" volta ao menu');
  const httpVolta = await amb.evaluate(async () => (await fetch('/api/v1/manuals', {
    headers: { Authorization: `Bearer ${localStorage.getItem('septem.accessToken')}`, 'X-Tenant': 'prefeitura-x' },
  })).status);
  check(httpVolta === 200, `religada, a rota volta a responder (HTTP ${httpVolta})`);
  await ambCtx.close();

  // ── 5. Mobile: a central de funcionalidades cabe em 375 ────────────────────
  const mobCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const mob = await mobCtx.newPage();
  await mob.goto(BASE + '/platform/login', { waitUntil: 'networkidle' });
  await mob.fill('input[name=email]', 'super@septem.local');
  await mob.fill('input[name=password]', 'super123');
  await mob.click('button[type=submit]');
  await mob.waitForSelector('input[name=code]', { timeout: 10000 });
  const code = await mob.evaluate(async () => {
    const r = await fetch('/api/v1/platform/auth/dev/last-code?email=super@septem.local');
    return (await r.json()).code;
  });
  await mob.fill('input[name=code]', code);
  await mob.click('button[type=submit]');
  await mob.waitForSelector('[data-testid=platform-clientes-lista]', { timeout: 15000 });
  await mob.goto(`${BASE}/platform/environments/${ALVO}`, { waitUntil: 'networkidle' });
  await mob.waitForSelector('[data-testid=funcionalidades]', { timeout: 10000 });
  check(await mob.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'a tela de funcionalidades não rola na horizontal em 375');
  await mob.screenshot({ path: `${OUT}/funcionalidades-mobile.png` });
  await mobCtx.close();
} finally {
  // Rede de segurança: o ambiente volta ao padrão de qualquer jeito.
  try {
    const status = await definirFuncionalidades(page, PADRAO);
    console.log('  (restauração de segurança:', status, ')');
  } catch (e) {
    console.log('! não consegui restaurar as funcionalidades:', e.message.slice(0, 80));
  }
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

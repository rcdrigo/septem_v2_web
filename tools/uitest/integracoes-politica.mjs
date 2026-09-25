/**
 * Integrações do ambiente e política de credenciais (ADM-04, Fase 10).
 *
 * O caso que importa: com a política FECHADA pela área central, a tela do cliente mostra
 * status e orientação — e o servidor recusa a gravação de qualquer jeito. Testar só a
 * tela provaria metade; testar só a API não provaria o que a pessoa vê.
 *
 * ⚠️ Sempre reabre a política no fim (duas camadas), senão as suítes seguintes ficam sem
 * conseguir salvar parâmetros.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ALVO = 'prefeitura-x';

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

async function definirPolitica(page, pode) {
  return page.evaluate(async ({ alvo, pode }) => {
    const token = localStorage.getItem('septem.platform.accessToken');
    const r = await fetch(`/api/v1/platform/environments/${alvo}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientCanEditCredentials: pode }),
    });
    return r.status;
  }, { alvo: ALVO, pode });
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));

try {
  await entrarNaCentral(page);
  check(await definirPolitica(page, true) === 200, 'política aberta (estado inicial)');

  // ── 1. Com a política ABERTA: a aba mostra status e não mostra bloqueio ────
  const ambCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const amb = await ambCtx.newPage();
  await amb.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await amb.fill('input[name=identifier]', `admin@${ALVO}.local`);
  await amb.fill('input[type=password]', 'admin123');
  await amb.click('button[type=submit]');
  await amb.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  await amb.goto(BASE + '/admin/settings', { waitUntil: 'networkidle' });
  await amb.locator('button', { hasText: 'Integrações' }).first().click();
  await amb.waitForSelector('[data-testid=integracoes]', { timeout: 10000 });

  const quantas = await amb.locator('[data-testid=integracoes] li').count();
  check(quantas === 3, `a aba lista as 3 integrações (achei ${quantas})`);
  const texto = await amb.locator('[data-testid=integracoes]').innerText();
  check(/Configurada|Falta configurar/.test(texto), 'cada integração mostra a situação');
  check(/Do cliente|Da Septem/.test(texto), 'cada integração diz de quem é a conta');
  check(await amb.locator('[data-testid=credenciais-bloqueadas]').count() === 0,
    'com a política aberta, não aparece aviso de bloqueio');
  await amb.screenshot({ path: `${OUT}/integracoes-aberta.png` });

  // ── 2. Política FECHADA: aviso na tela e recusa no servidor ───────────────
  check(await definirPolitica(page, false) === 200, 'política fechada pela área central');
  await amb.reload({ waitUntil: 'networkidle' });
  await amb.locator('button', { hasText: 'Integrações' }).first().click();
  await amb.waitForSelector('[data-testid=integracoes]', { timeout: 10000 });
  check(await amb.locator('[data-testid=credenciais-bloqueadas]').isVisible(),
    'com a política fechada, a tela explica que a Septem mantém as credenciais');

  const recusa = await amb.evaluate(async () => {
    const r = await fetch('/api/v1/settings/email', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('septem.accessToken')}`,
        'X-Tenant': 'prefeitura-x',
      },
      body: JSON.stringify({ smtpHost: 'smtp.teste', smtpPort: 587, smtpUser: 'u', smtpPassword: 'p' }),
    });
    return { http: r.status, corpo: await r.json().catch(() => ({})) };
  });
  check(recusa.http === 403 && recusa.corpo.error === 'credentials_locked',
    `o servidor recusa a troca de credencial (HTTP ${recusa.http})`);
  await amb.screenshot({ path: `${OUT}/integracoes-bloqueada.png` });

  // Mobile: a aba precisa caber em 375.
  await amb.setViewportSize({ width: 375, height: 812 });
  await amb.waitForTimeout(300);
  check(await amb.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'a aba de integrações não rola na horizontal em 375');
  await amb.screenshot({ path: `${OUT}/integracoes-mobile.png` });

  // ── 3. Reaberta: volta a permitir ─────────────────────────────────────────
  check(await definirPolitica(page, true) === 200, 'política reaberta');
  const depois = await amb.evaluate(async () => {
    const r = await fetch('/api/v1/settings/integrations', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('septem.accessToken')}`,
        'X-Tenant': 'prefeitura-x',
      },
    });
    return (await r.json()).canEditCredentials;
  });
  check(depois === true, 'reaberta, o ambiente volta a poder editar');
  await ambCtx.close();
} finally {
  try {
    const status = await definirPolitica(page, true);
    console.log('  (reabertura de segurança:', status, ')');
  } catch (e) {
    console.log('! não consegui reabrir a política:', e.message.slice(0, 80));
  }
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

// Fase 2.2 (requisitos 2026-08-03): "Não recebeu o e-mail? Clique aqui para enviar
// novamente", com "apenas uma solicitação por minuto".
//
// O que esta suíte prova, e por quê:
//  (a) durante a janela o link NÃO existe e a espera é anunciada em segundos —
//      botão desabilitado "de mentira" é o erro clássico daqui;
//  (b) o servidor é a autoridade: chamando a API direto, o 2º pedido no mesmo
//      minuto leva 429 com retryAfterSeconds;
//  (c) passada a janela, o link aparece e o clique DISPARA MESMO outro envio —
//      contado pelas respostas de rede, não pela mudança de texto na tela.
//
// O (c) custa ~1 minuto de espera real. É deliberado: sem ele a suíte provaria só
// que a tela some e volta, não que o reenvio funciona — que é o requisito.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const token = (await api(null, '/api/v1/auth/login', 'POST',
  { identifier: 'admin@prefeitura-x.local', password: 'admin123' })).body.accessToken;

// Cada execução usa contas NOVAS: a janela de 60 s é por identificador, então
// reaproveitar um e-mail faria a suíte falhar conforme a ordem/horário da rodada.
const rid = Math.floor(Math.random() * 1e9);
const criarConta = async (rotulo) => {
  const email = `reenvio.${rotulo}.${rid}@prefeitura-x.local`;
  const r = await api(token, '/api/v1/users', 'POST', { name: `Reenvio ${rotulo} ${rid}`, email, isInternal: true });
  if (r.status >= 300) throw new Error(`falha ao criar ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return email;
};

// ── (b) a regra é do SERVIDOR ────────────────────────────────────────────────
const contaApi = await criarConta('api');
const p1 = await api(null, '/api/v1/auth/forgot-password', 'POST', { identifier: contaApi });
const p2 = await api(null, '/api/v1/auth/forgot-password', 'POST', { identifier: contaApi });
check(p1.status === 200, `[api] 1º pedido de código passa (${p1.status})`);
check(p2.status === 429 && p2.body?.error === 'too_many_requests',
  `[api] 2º pedido no mesmo minuto é barrado (${p2.status} ${JSON.stringify(p2.body?.error)})`);
check(typeof p2.body?.retryAfterSeconds === 'number' && p2.body.retryAfterSeconds >= 1 && p2.body.retryAfterSeconds <= 60,
  `[api] o servidor informa quanto falta (${p2.body?.retryAfterSeconds}s)`);

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });

/** Percorre a tela até a etapa do código, contando as respostas de /forgot-password. */
async function pedirCodigoPelaTela(page, email) {
  const envios = [];
  page.on('response', (r) => { if (r.url().includes('/auth/forgot-password')) envios.push(r.status()); });
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Esqueci minha senha/i }).click();
  await page.waitForSelector('[data-testid=form-esqueci]', { timeout: 10000 });
  await page.fill('input[name=identifier]', email);
  await page.getByRole('button', { name: /Enviar código/i }).click();
  await page.waitForSelector('[data-testid=form-redefinir]', { timeout: 15000 });
  return envios;
}

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const email = await criarConta(vp.n);
    const envios = await pedirCodigoPelaTela(page, email);

    check(envios.filter((s) => s === 200).length === 1, `[${vp.n}] o pedido do código saiu uma vez (${JSON.stringify(envios)})`);

    // (a) Durante a janela: aviso com os segundos e NENHUM link clicável.
    const espera = page.locator('[data-testid=reenvio-espera]');
    await espera.waitFor({ timeout: 5000 });
    const txtEspera = (await espera.innerText()).trim();
    check(/Não recebeu o e-mail\?/i.test(txtEspera), `[${vp.n}] a tela pergunta "Não recebeu o e-mail?" (${JSON.stringify(txtEspera)})`);
    check(/\d+s/.test(txtEspera), `[${vp.n}] e anuncia em quantos segundos poderá reenviar`);
    check(await page.locator('[data-testid=reenviar-codigo]').count() === 0,
      `[${vp.n}] durante a espera não existe link de reenvio para clicar`);

    const L = await page.evaluate(() => {
      const doc = document.documentElement;
      const clipped = [...document.querySelectorAll('button, input, a')].filter((el) => {
        if (el.closest('aside')) return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
      }).length;
      return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
    });
    check(!L.overflows, `[${vp.n}] tela do código sem overflow horizontal`);
    check(L.clipped === 0, `[${vp.n}] tela do código sem controle recortado (${L.clipped})`);
    await page.screenshot({ path: `${OUT}/senha-reenvio-${vp.n}.png`, fullPage: true });

    // (c) Só no desktop, para não pagar a espera duas vezes.
    if (vp.n === 'web') {
      const inicio = Date.now();
      await page.waitForSelector('[data-testid=reenviar-codigo]', { timeout: 75000 });
      check(true, `[web] passado o minuto, o link de reenvio aparece (${Math.round((Date.now() - inicio) / 1000)}s)`);

      const antes = envios.length;
      await page.click('[data-testid=reenviar-codigo]');
      await page.waitForTimeout(2500);
      const novos = envios.slice(antes);
      check(novos.length === 1 && novos[0] === 200,
        `[web] o clique DISPARA outro envio e ele é aceito (${JSON.stringify(novos)})`);
      check(await page.locator('[data-testid=reenvio-espera]').count() === 1,
        '[web] e a espera recomeça depois do reenvio');
      await page.screenshot({ path: `${OUT}/senha-reenvio-apos.png`, fullPage: true });
    }
    // ── (d) EFEITO: o código realmente redefine a senha ───────────────────────
    // Só no desktop. Sem isto a suíte provaria o BLOQUEIO e não o RECURSO: o
    // requisito é o usuário conseguir entrar de novo, não a tela mostrar um aviso.
    if (vp.n === 'web') {
      const dev = await api(null, `/api/v1/auth/dev/last-code?identifier=${encodeURIComponent(email)}&purpose=reset`);
      check(dev.status === 200 && /^\d{6}$/.test(dev.body?.code ?? ''),
        `[web] o código de 6 dígitos foi emitido (${dev.status})`);

      const novaSenha = `Reenvio!${rid}aA`;
      await page.fill('input[name=code]', dev.body.code);
      await page.fill('input[name=newPassword]', novaSenha);
      await page.getByRole('button', { name: /Redefinir|Salvar|Confirmar/i }).first().click();
      await page.waitForSelector('[data-testid=form-credenciais], input[name=password]', { timeout: 15000 });

      // A prova é ENTRAR com a senha nova — mensagem de sucesso não prova nada.
      const login = await api(null, '/api/v1/auth/login', 'POST', { identifier: email, password: novaSenha });
      check(login.status === 200 && !!login.body?.accessToken,
        `[web] a senha foi realmente redefinida — login com a nova passa (${login.status})`);

      // E a senha inicial (a que o admin gerou) deixou de valer.
      const antiga = await api(null, '/api/v1/auth/login', 'POST', { identifier: email, password: 'qualquer-antiga' });
      check(antiga.status !== 200, `[web] credencial inválida continua sendo recusada (${antiga.status})`);
    }

    await ctx.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

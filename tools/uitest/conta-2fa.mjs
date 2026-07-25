// Fase 2 — 2FA por e-mail, dispositivo confiável, Meus dados e modal de senha.
// Liga o 2FA em Parâmetros › Segurança (pela TELA), faz o login em duas etapas,
// confia no dispositivo, confere que o próximo acesso não pede código, remove o
// dispositivo em Meus dados e vê o desafio voltar. Web 1280 + mobile 375.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (cond, msg) => (cond ? ok.push(msg) : bad.push(msg));

const api = async (token, path, method = 'GET', body) => {
  const r = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': 'prefeitura-x',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', {
  identifier: 'admin@prefeitura-x.local',
  password: 'admin123',
});
const token = auth.accessToken;

const codigoDe = async (identifier, purpose) => {
  const r = await api(null, `/api/v1/auth/dev/last-code?identifier=${encodeURIComponent(identifier)}&purpose=${purpose}`);
  return r.body?.code;
};

async function criarUsuario(apelido) {
  const email = `${apelido}-${Math.floor(Math.random() * 1e9)}@teste.local`;
  const r = await api(token, '/api/v1/users', 'POST', { name: `Usuário ${apelido}`, email, isInternal: true });
  return { email, senha: r.body.initialPassword };
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

const login = async (page, identifier, senha) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', identifier);
  await page.fill('input[name=password]', senha);
  await page.click('button[type=submit]');
};

// Fase 11: logout = limpar os cookies de sessão. `clearSession` preserva o cookie
// do dispositivo confiável (septem_dt) para simular "novo login no mesmo device".
const clearSession = async (ctx) => {
  const dt = (await ctx.cookies('http://localhost:5173')).find((c) => c.name === 'septem_dt');
  await ctx.clearCookies();
  if (dt) await ctx.addCookies([{ name: 'septem_dt', value: dt.value, url: 'http://localhost:5173', httpOnly: true }]);
};

try {
  for (const view of [
    { name: 'web', width: 1280, height: 900 },
    { name: 'mobile', width: 375, height: 812 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const mobile = view.name === 'mobile';
    const u = await criarUsuario(`2fa-${view.name}`);

    // Cada iteração começa com o 2FA DESLIGADO — senão o próprio admin (interno)
    // cairia no desafio ao entrar para configurar.
    await api(token, '/api/v1/settings/security', 'PUT', {
      twoFactorMode: 'off',
      maxLoginAttempts: 5,
      lockoutMinutes: 15,
    });

    // ── 1) Admin liga o 2FA na aba Segurança (pela tela) ────────────────────
    await login(page, 'admin@prefeitura-x.local', 'admin123');
    await page.waitForURL((x) => !x.pathname.includes('login'), { timeout: 15000 });
    await page.goto(BASE + '/admin/parametros', { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Segurança' }).click();
    await page.waitForSelector('[data-testid=form-seguranca]');
    await page.selectOption('select[name=twoFactorMode]', 'internal');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await page.waitForSelector('text=Configuração de segurança salva.', { timeout: 10000 });
    check(true, `[${view.name}] admin liga o 2FA em Parâmetros › Segurança`);
    await page.screenshot({ path: `${OUT}/parametros-seguranca-${view.name}.png`, fullPage: true });

    // ── 2) Login vira duas etapas ──────────────────────────────────────────
    await ctx.clearCookies(); // logout do admin (sessão em cookie httpOnly)
    await login(page, u.email, u.senha);
    await page.waitForSelector('[data-testid=form-2fa]', { timeout: 15000 });
    const texto = await page.locator('main, body').first().innerText();
    check(texto.includes('•'), `[${view.name}] a tela do código mostra o e-mail mascarado`);
    check(page.url().includes('login'), `[${view.name}] com 2FA ligado, a senha certa não entra direto`);

    // Código errado avisa.
    await page.fill('input[name=code]', '000000');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await page.waitForSelector('[data-testid=login-aviso]', { timeout: 10000 });
    check(true, `[${view.name}] código errado é recusado com aviso`);

    // Código certo + confiar neste dispositivo.
    await page.fill('input[name=code]', await codigoDe(u.email, '2fa'));
    await page.check('input[name=trustDevice]');
    await page.screenshot({ path: `${OUT}/login-2fa-${view.name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await page.waitForURL((x) => !x.pathname.includes('login'), { timeout: 15000 });
    check(true, `[${view.name}] código certo conclui o login`);

    const deviceCookie = (await ctx.cookies('http://localhost:5173')).find((c) => c.name === 'septem_dt');
    check(!!deviceCookie && deviceCookie.httpOnly, `[${view.name}] o dispositivo confiável foi registrado (cookie httpOnly septem_dt)`);

    // ── 3) Próximo login no mesmo dispositivo NÃO pede código ───────────────
    await clearSession(ctx); // desloga mas MANTÉM o device cookie
    await login(page, u.email, u.senha);
    await page.waitForURL((x) => !x.pathname.includes('login'), { timeout: 15000 });
    check(true, `[${view.name}] no dispositivo confiável, o login entra direto (sem código)`);

    // ── 4) Meus dados: editar perfil + ver e remover o dispositivo ──────────
    await page.goto(BASE + '/me', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=form-meus-dados]');
    await page.fill('input[name=name]', 'Servidor Teste');
    await page.fill('input[name=matricula]', '99887');
    await page.fill('input[name=telefone]', '(11) 98888-7777');
    await page.fill('input[name=photoUrl]', 'https://picsum.photos/id/64/200/200');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await page.waitForSelector('text=Dados salvos.', { timeout: 10000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=form-meus-dados]');
    check(
      (await page.locator('input[name=name]').inputValue()) === 'Servidor Teste' &&
        (await page.locator('input[name=matricula]').inputValue()) === '99887',
      `[${view.name}] Meus dados salva nome, matrícula, telefone e foto`,
    );
    check(
      (await page.locator('[data-testid=foto]').getAttribute('src'))?.includes('picsum') ?? false,
      `[${view.name}] a foto do usuário aparece`,
    );

    // Layout da tela (o card + a tabela precisam caber). Medimos só o CONTEÚDO:
    // o menu off-canvas do mobile fica fora da viewport de propósito quando fechado.
    const L = await page.evaluate(() => {
      const doc = document.documentElement;
      const clipped = [...document.querySelectorAll('main input, main button, main table')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
      }).length;
      return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
    });
    check(!L.overflows, `[${view.name}] Meus dados sem overflow horizontal`);
    check(L.clipped === 0, `[${view.name}] Meus dados sem controle recortado (${L.clipped})`);
    await page.screenshot({ path: `${OUT}/meus-dados-${view.name}.png`, fullPage: true });

    // O dispositivo confiável está listado.
    const linha = await page.locator('[data-testid=dispositivos]').innerText();
    check(/Chrome no Linux|Chrome no|Navegador/.test(linha), `[${view.name}] o dispositivo confiável aparece na tabela ("${linha.split('\n').pop()}")`);

    // Modal de mudar senha (antes era página).
    await page.getByRole('button', { name: 'Mudar senha' }).click();
    await page.waitForSelector('[data-testid=form-mudar-senha]', { timeout: 10000 });
    await page.fill('input[name=newPassword]', 'fraca');
    const marcados = await page.evaluate(
      () => [...document.querySelectorAll('[data-testid=password-checklist] li')].filter((l) => l.dataset.ok === 'true').length,
    );
    check(marcados < 5, `[${view.name}] o modal de senha mostra o checklist de requisitos`);
    await page.keyboard.press('Escape');

    // Remover o dispositivo → o próximo login volta a desafiar.
    await page.locator('[data-testid=dispositivos] button[aria-label^="Remover"]').first().click();
    await page.waitForSelector('text=removido', { timeout: 10000 });
    check(true, `[${view.name}] remove o dispositivo confiável em Meus dados`);

    await clearSession(ctx); // desloga; o device foi removido no servidor → volta a desafiar
    await login(page, u.email, u.senha);
    await page.waitForSelector('[data-testid=form-2fa]', { timeout: 15000 });
    check(true, `[${view.name}] sem o dispositivo confiável, o login volta a pedir o código`);

    await ctx.close();
  }
} finally {
  // Desliga o 2FA: as outras suítes (e o dev) logam direto.
  await api(token, '/api/v1/settings/security', 'PUT', {
    twoFactorMode: 'off',
    maxLoginAttempts: 5,
    lockoutMinutes: 15,
  });
  const { body } = await api(token, '/api/v1/settings');
  check(body.security.twoFactorMode === 'off', '[cleanup] 2FA desligado ao final');
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

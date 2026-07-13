// Fase 2 — login e segurança da conta, no navegador real (web 1280 + mobile 375).
// Percorre o que o usuário faz: entrar por CPF, errar a senha até a conta
// bloquear (com o aviso progressivo), recuperar por código com o checklist de
// requisitos, e entrar de novo com a senha nova.
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

// O código de e-mail é lido pela caixa de dev (não há SMTP em dev).
const codigoDe = async (identifier, purpose) => {
  const r = await api(null, `/api/v1/auth/dev/last-code?identifier=${encodeURIComponent(identifier)}&purpose=${purpose}`);
  return r.body?.code;
};

/** Cria um usuário descartável e devolve (email, senha inicial). */
async function criarUsuario(apelido) {
  const email = `${apelido}-${Math.floor(Math.random() * 1e9)}@teste.local`;
  const r = await api(token, '/api/v1/users', 'POST', {
    name: `Usuário ${apelido}`,
    email,
    isInternal: true,
  });
  return { email, senha: r.body.initialPassword, id: r.body.id };
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

for (const view of [
  { name: 'web', width: 1280, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const u = await criarUsuario(`login-${view.name}`);

  // ── 1) Login por CPF (o admin do seed tem CPF) ────────────────────────────
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', '529.982.247-25');
  await page.fill('input[name=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((x) => !x.pathname.includes('login'), { timeout: 15000 });
  check(true, `[${view.name}] entra pelo CPF (não só pelo e-mail)`);
  await page.evaluate(() => localStorage.clear());

  // ── 2) Aviso progressivo e bloqueio na 5ª tentativa ───────────────────────
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  const avisos = [];
  for (let i = 1; i <= 5; i++) {
    await page.fill('input[name=identifier]', u.email);
    await page.fill('input[name=password]', 'senha-errada');
    await page.click('button[type=submit]');
    await page.waitForSelector('[data-testid=login-aviso]', { timeout: 10000 });
    avisos.push(await page.locator('[data-testid=login-aviso]').innerText());
  }
  check(
    avisos[0].includes('4 tentativas') && avisos[3].includes('1 tentativa'),
    `[${view.name}] avisa quantas tentativas restam (4 → 1)`,
  );
  check(
    /bloqueada/i.test(avisos[4]),
    `[${view.name}] na 5ª tentativa a conta é bloqueada ("${avisos[4].slice(0, 48)}...")`,
  );
  await page.screenshot({ path: `${OUT}/login-bloqueio-${view.name}.png`, fullPage: true });

  // Bloqueada, nem a senha certa entra.
  await page.fill('input[name=password]', u.senha);
  await page.click('button[type=submit]');
  await page.waitForTimeout(800);
  check(
    page.url().includes('login') && /bloqueada/i.test(await page.locator('[data-testid=login-aviso]').innerText()),
    `[${view.name}] com a conta bloqueada, nem a senha certa entra`,
  );

  // ── 3) Esqueci minha senha → código → checklist → nova senha ──────────────
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await page.waitForSelector('[data-testid=form-esqueci]');
  await page.fill('input[name=identifier]', u.email);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await page.waitForSelector('[data-testid=form-redefinir]', { timeout: 10000 });
  check(true, `[${view.name}] "Esqueci minha senha" leva à tela de código + nova senha`);

  // Checklist marca em tempo real e o botão só libera com a senha conforme.
  await page.fill('input[name=newPassword]', 'fraca');
  const parcial = await page.evaluate(
    () => [...document.querySelectorAll('[data-testid=password-checklist] li')].filter((l) => l.dataset.ok === 'true').length,
  );
  const botao = page.getByRole('button', { name: 'Redefinir senha' });
  check(parcial < 5 && (await botao.isDisabled()), `[${view.name}] senha fraca: checklist incompleto e botão bloqueado`);

  await page.fill('input[name=newPassword]', 'NovaSenha@2026');
  const completo = await page.evaluate(
    () => [...document.querySelectorAll('[data-testid=password-checklist] li')].filter((l) => l.dataset.ok === 'true').length,
  );
  check(completo === 5 && !(await botao.isDisabled()), `[${view.name}] senha forte: 5/5 requisitos e botão liberado`);
  await page.screenshot({ path: `${OUT}/login-checklist-${view.name}.png`, fullPage: true });

  // Código errado é recusado com o motivo.
  await page.fill('input[name=code]', '000000');
  await botao.click();
  await page.waitForTimeout(1000);
  check(
    /código/i.test(await page.locator('[data-testid=login-aviso]').innerText()),
    `[${view.name}] código errado é recusado com aviso`,
  );

  // Código certo redefine.
  const code = await codigoDe(u.email, 'reset');
  await page.fill('input[name=code]', code);
  await page.fill('input[name=newPassword]', 'NovaSenha@2026');
  await botao.click();
  await page.waitForSelector('[data-testid=form-credenciais]', { timeout: 10000 });
  check(true, `[${view.name}] senha redefinida e volta para o login`);

  // ── 4) A senha nova entra E a conta foi destravada pelo reset ─────────────
  await page.fill('input[name=identifier]', u.email);
  await page.fill('input[name=password]', 'NovaSenha@2026');
  await page.click('button[type=submit]');
  await page.waitForURL((x) => !x.pathname.includes('login'), { timeout: 15000 });
  check(true, `[${view.name}] entra com a senha nova (o reset destravou a conta)`);

  // ── 5) Layout ────────────────────────────────────────────────────────────
  // Sai da sessão: logado, /login redireciona para o app e mediríamos o shell
  // (o menu off-canvas do mobile fica fora da viewport de propósito).
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=form-credenciais]');
  const L = await page.evaluate(() => {
    const doc = document.documentElement;
    const clipped = [...document.querySelectorAll('input, button')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
    }).length;
    return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
  });
  check(!L.overflows, `[${view.name}] login sem overflow horizontal`);
  check(L.clipped === 0, `[${view.name}] nenhum controle recortado no login (${L.clipped})`);

  await ctx.close();
}

await browser.close();

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

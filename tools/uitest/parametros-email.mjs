// Fase 1.2 — Parâmetros › E-mail (SMTP). Salva a configuração, confere que a
// senha é write-only (nunca volta preenchida), que "sem autenticação" esconde
// usuário/senha e que o teste de envio devolve o motivo real da falha.
// Roda em web (1280) e mobile (375).
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (cond, msg) => (cond ? ok.push(msg) : bad.push(msg));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}

async function abrirAbaEmail(page) {
  await page.goto(BASE + '/admin/parametros', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'E-mail' }).click();
  await page.waitForSelector('[data-testid=form-email]', { timeout: 10000 });
}

for (const view of [
  { name: 'web', width: 1280, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);
  await abrirAbaEmail(page);
  check(true, `[${view.name}] aba E-mail abre o formulário SMTP`);

  // 1) Layout: sem overflow e sem campo recortado.
  const L = await page.evaluate(() => {
    const doc = document.documentElement;
    const form = document.querySelector('[data-testid=form-email]');
    const clipped = [...(form?.querySelectorAll('input, select, button') ?? [])].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
    }).length;
    return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
  });
  check(!L.overflows, `[${view.name}] sem overflow horizontal`);
  check(L.clipped === 0, `[${view.name}] nenhum campo recortado (${L.clipped})`);

  // 2) "Sem autenticação" esconde usuário/senha; voltar para Login os traz de volta.
  await page.selectOption('select[name=authMode]', 'none');
  check(
    (await page.locator('input[name=user]').count()) === 0 && (await page.locator('input[name=password]').count()) === 0,
    `[${view.name}] modo "sem autenticação" esconde usuário e senha`,
  );
  await page.selectOption('select[name=authMode]', 'login');
  check(
    (await page.locator('input[name=user]').count()) === 1 && (await page.locator('input[name=password]').count()) === 1,
    `[${view.name}] modo "login" mostra usuário e senha`,
  );

  // 2.1) O destino do teste já vem com o e-mail de quem está logado.
  check(
    (await page.locator('input[name=testTo]').inputValue()) === 'admin@prefeitura-x.local',
    `[${view.name}] e-mail de teste já vem preenchido com o do usuário logado`,
  );

  // 3) Salvar a configuração (com senha).
  await page.fill('input[name=host]', 'smtp.invalido.invalid');
  await page.fill('input[name=port]', '2525');
  await page.fill('input[name=user]', 'no-reply@prefeitura.gov.br');
  await page.fill('input[name=password]', 'segredo123');
  await page.fill('input[name=fromAddress]', 'no-reply@prefeitura.gov.br');
  await page.fill('input[name=fromName]', 'Prefeitura Municipal');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForSelector('text=Configuração de e-mail salva.', { timeout: 10000 });
  check(true, `[${view.name}] salvou a configuração SMTP`);
  await page.screenshot({ path: `${OUT}/parametros-email-${view.name}.png`, fullPage: true });

  // 4) Senha é write-only: após reload o campo volta VAZIO, mas rotulado como configurada.
  await abrirAbaEmail(page);
  check(
    (await page.locator('input[name=host]').inputValue()) === 'smtp.invalido.invalid' &&
      (await page.locator('input[name=port]').inputValue()) === '2525',
    `[${view.name}] host e porta persistidos`,
  );
  check(
    (await page.locator('input[name=password]').inputValue()) === '',
    `[${view.name}] senha nunca volta preenchida (write-only)`,
  );
  check(
    (await page.getByText('Senha (configurada)').count()) > 0,
    `[${view.name}] rótulo indica que a senha já está configurada`,
  );

  // 5) Teste de envio: host inexistente → toast com o motivo real (não um erro genérico).
  await page.fill('input[name=testTo]', 'destino@exemplo.gov.br');
  await page.getByRole('button', { name: 'Enviar teste' }).click();
  await page.waitForTimeout(6000); // resolução de DNS/timeout do MailKit
  const erro = await page.evaluate(() => document.body.innerText);
  check(
    !erro.includes('E-mail de teste enviado') && /invalido\.invalid|Falha ao enviar|resol|host/i.test(erro),
    `[${view.name}] teste de envio falha com o motivo do servidor (não silencia)`,
  );

  // 6) Salvar sem digitar senha mantém a existente.
  await abrirAbaEmail(page);
  await page.fill('input[name=fromName]', 'Prefeitura Municipal 2');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForSelector('text=Configuração de e-mail salva.', { timeout: 10000 });
  await abrirAbaEmail(page);
  check(
    (await page.getByText('Senha (configurada)').count()) > 0 &&
      (await page.locator('input[name=fromName]').inputValue()) === 'Prefeitura Municipal 2',
    `[${view.name}] salvar sem digitar senha preserva a senha atual`,
  );

  await ctx.close();
}

// Limpa o SMTP para não afetar as outras suítes (volta ao sender de log em dev).
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await abrirAbaEmail(page);
  await page.fill('input[name=host]', '');
  await page.fill('input[name=fromName]', '');
  await page.fill('input[name=fromAddress]', '');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForSelector('text=Configuração de e-mail salva.', { timeout: 10000 });
  await abrirAbaEmail(page);
  check((await page.locator('input[name=host]').inputValue()) === '', '[cleanup] SMTP limpo (volta ao log em dev)');
  await ctx.close();
}

await browser.close();

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

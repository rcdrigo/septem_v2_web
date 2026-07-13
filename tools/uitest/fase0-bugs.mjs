import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function login(page, email = 'admin@prefeitura-x.local', pass = 'admin123') {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', pass);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}

// ══ ITEM 1 — Botão "Sair" ═══════════════════════════════════════════════════
for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 150)));
  await login(page);

  // no mobile o sidenav é drawer: abrir pelo hamburger
  if (vp.n === 'mobile') {
    await page.locator('button[aria-label="Abrir menu"]').click();
    await page.waitForTimeout(500);
  }
  await page.locator('aside button', { hasText: 'Sair' }).click();
  await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => ({
    noLogin: location.pathname.includes('/login'),
    semTokens: !localStorage.getItem('septem.accessToken') && !localStorage.getItem('septem.refreshToken'),
    semMock: !document.body.innerText.includes('mock'),
  }));
  check(state.noLogin, `[${vp.n}] "Sair" redireciona para o login`);
  check(state.semTokens, `[${vp.n}] tokens removidos do storage (sessão encerrada de fato)`);
  check(state.semMock, `[${vp.n}] sem a mensagem "(mock)"`);

  // rota protegida não abre mais sem logar
  await page.goto(BASE + '/admin/usuarios', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check(await page.evaluate(() => location.pathname.includes('/login')), `[${vp.n}] rota protegida barrada após sair`);
  await page.screenshot({ path: `${OUT}/fase0-logout-${vp.n}.png` });
  await ctx.close();
}

// ══ ITEM 2 — Sair da personificação (não-admin interno E externo) ═══════════
for (const alvo of ['Maximiliano', 'Cidadao Externo']) {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);
    if (vp.n === 'mobile') { await page.locator('button[aria-label="Abrir menu"]').click(); await page.waitForTimeout(400); }

    await page.locator('aside button', { hasText: 'Personificar' }).click();
    await page.waitForTimeout(1000);
    await page.locator('[role=dialog] button', { hasText: alvo }).first().click();
    await page.waitForTimeout(2000);
    if (vp.n === 'mobile') { await page.locator('button[aria-label="Abrir menu"]').click().catch(() => {}); await page.waitForTimeout(400); }

    const banner = page.locator('aside .bg-amber-50 button', { hasText: 'Sair' });
    const visivel = await banner.count();
    const habilitado = visivel ? await banner.isEnabled() : false;
    check(visivel === 1, `[${vp.n}][${alvo}] botão "Sair da personificação" presente`);
    check(habilitado, `[${vp.n}][${alvo}] botão HABILITADO (bug do dono: ficava desativado)`);

    await banner.click();
    await page.waitForTimeout(2500);
    const voltou = await page.evaluate(() => !document.body.innerText.includes('Personificando'));
    check(voltou, `[${vp.n}][${alvo}] voltou ao usuário original (sem re-login)`);
    await page.screenshot({ path: `${OUT}/fase0-impersonate-${vp.n}-${alvo.split(' ')[0]}.png` });
    await ctx.close();
  }
}

// ══ ITEM 3 — Fluxo com 3 tarefas percorrido do início ao fim (web + mobile) ══
// Usa o processo legado 'tres_tarefas_bug' (tarefa 2 = bpmn:Task genérico), que
// era exatamente o caso do dono: concluía ao terminar a tarefa 1.
for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);

  // inicia o serviço pela UI
  await page.goto(BASE + '/servico/tres_tarefas_bug', { waitUntil: 'networkidle' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.locator('footer button').first().click();
  await page.waitForTimeout(2500);
  check(await page.evaluate(() => document.body.innerText.includes('sucesso')), `[${vp.n}] item3: instância iniciada`);

  // auto-navega para a tarefa 1 → concluir
  await page.waitForURL(/\/tarefa\//, { timeout: 15000 });
  await page.waitForSelector('text=tarefa 1', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.locator('footer button').first().click(); // botão de conclusão
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/fase0-item3-${vp.n}-apos-t1.png` });

  const txt = await page.evaluate(() => document.body.innerText);
  check(!/processo (foi )?conclu/i.test(txt) || /Tarefa conclu/i.test(txt), `[${vp.n}] item3: não encerrou o processo na tarefa 1`);

  // deve seguir para a TAREFA 2 (auto-navegação ou lista)
  let naT2 = /tarefa 2/i.test(txt);
  if (!naT2) {
    await page.goto(BASE + '/tarefas', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    naT2 = await page.evaluate(() => /tarefa 2/i.test(document.body.innerText));
  }
  check(naT2, `[${vp.n}] item3: fluxo SEGUIU para a tarefa 2 (bug do dono corrigido)`);
  await page.screenshot({ path: `${OUT}/fase0-item3-${vp.n}-tarefa2.png` });
  await ctx.close();
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

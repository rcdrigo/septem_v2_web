import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function login(page, email = 'admin@prefeitura-x.local', pass = 'admin123') {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', email);
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

  // no mobile o sidenav é drawer: abrir pelo hamburger. Espera o drawer REALMENTE
  // abrir (aside deslizou pra dentro, borda esquerda em x>=0), não um tempo fixo —
  // sob carga o clique demora a abrir e o aside fica off-canvas (-translate-x-full),
  // deixando o "Sair" "fora do viewport" e o clique falha.
  if (vp.n === 'mobile') {
    await page.locator('button[aria-label="Abrir menu"]').click();
    await page.waitForFunction(() => {
      const a = document.querySelector('aside');
      return !!a && a.getBoundingClientRect().left >= 0;
    }, { timeout: 8000 }).catch(() => {});
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

// ══ ITEM 4 — Mensagem certa em cada origem (início vs demais tarefas) ═══════
for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);

  // (a) INÍCIO → "Solicitação iniciada com sucesso"
  await page.goto(BASE + '/servico/tres_tarefas_bug', { waitUntil: 'networkidle' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.locator('footer button').first().click();
  await page.waitForTimeout(2000);
  const msgInicio = await page.evaluate(() => document.body.innerText);
  check(/Solicitação iniciada com sucesso/i.test(msgInicio), `[${vp.n}] item4: início mostra "Solicitação iniciada com sucesso"`);
  check(!/Tarefa concluída com sucesso/i.test(msgInicio), `[${vp.n}] item4: início NÃO mostra "Tarefa concluída"`);
  await page.screenshot({ path: `${OUT}/fase0-item4-${vp.n}-inicio.png` });

  // (b) TAREFA → "Tarefa concluída com sucesso"
  await page.waitForURL(/\/tarefa\//, { timeout: 15000 });
  await page.waitForSelector('text=tarefa 1', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.locator('footer button').first().click();
  await page.waitForTimeout(2000);
  const msgTarefa = await page.evaluate(() => document.body.innerText);
  check(/Tarefa concluída com sucesso/i.test(msgTarefa), `[${vp.n}] item4: tarefa mostra "Tarefa concluída com sucesso"`);
  check(!/Solicitação iniciada com sucesso/i.test(msgTarefa), `[${vp.n}] item4: tarefa NÃO mostra "Solicitação iniciada"`);
  await page.screenshot({ path: `${OUT}/fase0-item4-${vp.n}-tarefa.png` });
  await ctx.close();
}

// ══ ITEM 5 — "Tarefas executadas" inclui o que o usuário iniciou ════════════
for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);

  // inicia um serviço (a tarefa de início é executada por MIM)
  await page.goto(BASE + '/servico/tres_tarefas_bug', { waitUntil: 'networkidle' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.locator('footer button').first().click();
  await page.waitForTimeout(2500);

  // a lista de executadas deve mostrar o processo que acabei de iniciar
  await page.goto(BASE + '/tarefas-executadas', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const txt = await page.evaluate(() => document.body.innerText);
  check(!/Nenhuma tarefa executada/i.test(txt), `[${vp.n}] item5: lista de executadas NÃO está vazia`);
  check(/Tres Tarefas Bug/i.test(txt), `[${vp.n}] item5: aparece o processo que o usuário iniciou`);
  const semOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  check(semOverflow, `[${vp.n}] item5: sem scroll horizontal`);
  await page.screenshot({ path: `${OUT}/fase0-item5-${vp.n}.png` });
  await ctx.close();
}

// ══ ITEM 6 — Excluir processo (funciona; e protege o histórico) ═════════════
// cria o alvo descartável na hora (teste idempotente — pode rodar quantas vezes quiser)
{
  const r = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x' },
    body: JSON.stringify({ email: 'admin@prefeitura-x.local', password: 'admin123' }),
  });
  const { accessToken } = await r.json();
  const xml = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dx" targetNamespace="x"><bpmn:process id="PX" name="Descartavel UI" isExecutable="true"><bpmn:extensionElements><septem:processConfig status="draft" /></bpmn:extensionElements><bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent><bpmn:userTask id="T" name="T"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask><bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" /><bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" /></bpmn:process></bpmn:definitions>`;
  await fetch('http://localhost:5000/api/v1/workflow/process-definitions/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ key: 'descartavel_ui', bpmnXml: xml }),
  });
}
for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(BASE + '/admin/processos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // (a) processo COM solicitações → excluir é BLOQUEADO com explicação
  const comSolic = page.locator('tr', { hasText: 'Tres Tarefas Bug' }).first();
  if (await comSolic.count()) {
    await comSolic.locator('button[title*="Excluir"]').click();
    await page.locator('button', { hasText: 'Excluir' }).last().click();
    await page.waitForTimeout(1200);
    const txt = await page.evaluate(() => document.body.innerText);
    check(/solicita/i.test(txt) && /Tres Tarefas Bug/.test(txt), `[${vp.n}] item6: excluir com solicitações é bloqueado com explicação`);
  }

  // (b) processo SEM solicitações → some da lista
  if (vp.n === 'web') { // exclui uma vez só (dado destrutivo)
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const alvo = page.locator('tr', { hasText: 'Descartavel UI' }).first();
    check(await alvo.count() === 1, `[${vp.n}] item6: processo descartável está na lista`);
    await alvo.locator('button[title*="Excluir"]').click();
    await page.locator('button', { hasText: 'Excluir' }).last().click();
    await page.waitForTimeout(1500);
    const sumiu = await page.locator('tr', { hasText: 'Descartavel UI' }).count();
    check(sumiu === 0, `[${vp.n}] item6: processo EXCLUÍDO some da lista (botão funciona)`);
    await page.screenshot({ path: `${OUT}/fase0-item6-${vp.n}.png` });
  }
  await ctx.close();
}

// ══ ITEM 7 — Título da aba reflete a página (nada de "Septem" genérico) ═════
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // login (deslogado)
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check(/Entrar/.test(await page.title()), `item7: /login → "${await page.title()}"`);

  await login(page);
  const rotas = [
    ['/servicos', /Serviços/i],
    ['/tarefas', /Tarefas pendentes/i],
    ['/consultas', /Consultas/i],
    ['/admin/processos', /Processos/i],
    ['/admin/relatorios', /Relatórios/i],
    ['/processos/editar?key=tres_tarefas_bug', /Tres Tarefas Bug/i],   // modelador: nome do processo
    ['/servico/tres_tarefas_bug', /Tres Tarefas Bug/i],                // início: nome do serviço
    ['/relatorios/editar?key=painel_de_despesas', /Painel de Despesas/i], // builder: nome do relatório
  ];
  for (const [rota, esperado] of rotas) {
    await page.goto(BASE + rota, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    const t = await page.title();
    check(esperado.test(t) && t !== 'Septem', `item7: ${rota} → "${t}"`);
  }
  await ctx.close();
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

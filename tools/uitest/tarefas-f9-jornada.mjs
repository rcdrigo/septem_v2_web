// Fase 9 — JORNADA COMPLETA da simulação, tudo pelo navegador (nada de concluir
// tarefa por API): catálogo de serviços → iniciar COMO TESTE → executar a 1ª tarefa →
// receber a 2ª (que pelo desenho seria de outra pessoa) → concluir → relatório do
// processo. Web 1280 e mobile 375. O que se prova aqui, e as outras suítes não provam:
// o fluxo inteiro de uma simulação vivido por um usuário, do início ao processo fechado.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;

const rid = Math.floor(Math.random() * 1e9);
const NOME = `Jornada F9 ${rid}`;
const FORM = JSON.stringify({ components: [{ type: 'textfield', key: 'assunto', label: 'Assunto' }] });

// O ator das DUAS tarefas é o analista: numa execução normal nada disso apareceria
// para quem inicia. É o que dá sentido à jornada de simulação.
const unidade = await api(token, '/api/v1/org-units', 'POST', { key: `dep_j9_${rid}`, name: `Depto Jornada ${rid}` });
const posicao = await api(token, '/api/v1/positions', 'POST', { key: `pos_j9_${rid}`, name: `Analista Jornada ${rid}`, orgUnitId: unidade.body.id });
const analista = await api(token, '/api/v1/users', 'POST', { name: `Analista Jornada ${rid}`, email: `analista.j9.${rid}@prefeitura-x.local`, isInternal: true });
const perfis = await api(token, '/api/v1/access-profiles');
await api(token, `/api/v1/users/${analista.body.id}`, 'PUT', {
  positionIds: [posicao.body.id],
  accessProfileIds: [perfis.body.find((p) => p.name === 'Administrador').id],
});
const ator = `<septem:actorConfig actorType="areaPosition" areaId="dep_j9_${rid}" positionId="pos_j9_${rid}" />`;

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dj9" targetNamespace="x">
  <bpmn:process id="Pj9" name="${NOME}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig inbox="Requisição de {{requisitante.nome}}: {{formulario.assunto}}" accessRules='[{"type":"all","action":"allow","capability":"view"}]' />
      <septem:formSchema>${FORM}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Sj9"><bpmn:outgoing>F1j9</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T1j9" name="Analisar jornada ${rid}">
      <bpmn:extensionElements><septem:deadlineConfig expiresIn="48" />${ator}
        <septem:actionButtons><septem:actionButton id="aprovar_j9" label="Aprovar jornada" /></septem:actionButtons>
      </bpmn:extensionElements>
      <bpmn:incoming>F1j9</bpmn:incoming><bpmn:outgoing>F2j9</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="T2j9" name="Homologar jornada ${rid}">
      <bpmn:extensionElements><septem:deadlineConfig expiresIn="72" />${ator}
        <septem:actionButtons><septem:actionButton id="fechar_j9" label="Fechar jornada" /></septem:actionButtons>
      </bpmn:extensionElements>
      <bpmn:incoming>F2j9</bpmn:incoming><bpmn:outgoing>F3j9</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="Ej9"><bpmn:incoming>F3j9</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1j9" sourceRef="Sj9" targetRef="T1j9" />
    <bpmn:sequenceFlow id="F2j9" sourceRef="T1j9" targetRef="T2j9" />
    <bpmn:sequenceFlow id="F3j9" sourceRef="T2j9" targetRef="Ej9" />
  </bpmn:process>
</bpmn:definitions>`;

const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(saved.status === 201, `[setup] processo da jornada publicado (${saved.status})`);
const key = saved.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};
/** Preenche o único campo de texto do formulário da tarefa/serviço. */
const preencher = async (p, valor) => {
  const campo = p.locator('main input[type=text]').first();
  if (await campo.count()) await campo.fill(valor);
};

try {
  // ══════════ WEB 1280 ══════════
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  await login(page);

  // 1) Catálogo de serviços: achar o serviço e abri-lo (abre em aba nova).
  await page.goto(`${BASE}/requisicoes`, { waitUntil: 'networkidle' });
  await page.goto(`${BASE}/servico/${key}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=iniciar-como-teste]', { timeout: 15000 });

  // 2) Iniciar COMO TESTE pelo checkbox.
  await preencher(page, `jornada ${rid}`);
  await page.locator('[data-testid=iniciar-como-teste]').check();
  check(await page.locator('[data-testid=iniciar-como-teste]').isChecked(), '[jornada] checkbox "iniciar como teste" marcado');
  await page.screenshot({ path: `${OUT}/f9j-1-inicio-web.png`, fullPage: true });
  await page.getByRole('button', { name: /Iniciar/ }).first().click();
  await page.waitForSelector('text=Solicitação iniciada com sucesso', { timeout: 20000 });
  check(true, '[jornada] serviço iniciado como teste pela tela');

  const inst = (await api(token, '/api/v1/workflow/instances?page=1&pageSize=50')).body.items.find((i) => i.processKey === key);
  check(inst?.isTest === true, '[jornada] a instância criada está marcada como teste');

  // 3) A 1ª tarefa — do analista pelo desenho — está comigo.
  await page.goto(`${BASE}/tarefas`, { waitUntil: 'networkidle' });
  await page.click('[data-testid=abrir-filtros]');
  await page.fill('[data-testid=filtro-q]', String(rid));
  await page.waitForTimeout(1600);
  const card1 = page.locator('article[role=link]').filter({ hasText: `Analisar jornada ${rid}` }).first();
  check(await card1.count() > 0, '[jornada] a 1ª tarefa da simulação aparece nas minhas pendentes');
  check(await card1.locator('[data-testid=selo-teste]').count() > 0, '[jornada] com o selo de processo de teste');
  await page.screenshot({ path: `${OUT}/f9j-2-pendentes-web.png`, fullPage: true });

  // 4) Abrir e concluir a 1ª tarefa PELA TELA (abre em aba nova).
  const [tarefa1] = await Promise.all([ctx.waitForEvent('page'), card1.click()]);
  await tarefa1.waitForLoadState('networkidle');
  await tarefa1.waitForSelector('header', { timeout: 15000 });
  await tarefa1.waitForTimeout(1000);
  check((await tarefa1.locator('header').first().innerText()).includes('Processo de teste'),
    '[jornada] o topo da tarefa avisa que é processo de teste');
  await preencher(tarefa1, `analisado ${rid}`);
  await tarefa1.screenshot({ path: `${OUT}/f9j-3-tarefa1-web.png`, fullPage: true });
  await tarefa1.getByRole('button', { name: 'Aprovar jornada' }).first().click();
  await tarefa1.waitForSelector('text=Tarefa concluída com sucesso', { timeout: 20000 });
  check(true, '[jornada] 1ª tarefa concluída pelo botão do processo');
  await tarefa1.close();

  // 5) A 2ª tarefa nasceu na conclusão e também veio para mim.
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-testid=abrir-filtros]');
  await page.fill('[data-testid=filtro-q]', String(rid));
  await page.waitForTimeout(1600);
  const card2 = page.locator('article[role=link]').filter({ hasText: `Homologar jornada ${rid}` }).first();
  check(await card2.count() > 0, '[jornada] a 2ª tarefa (criada na conclusão) também é minha');
  check(await card2.locator('[data-testid=selo-teste]').count() > 0, '[jornada] e continua marcada como teste');

  const [tarefa2] = await Promise.all([ctx.waitForEvent('page'), card2.click()]);
  await tarefa2.waitForLoadState('networkidle');
  await tarefa2.waitForSelector('header', { timeout: 15000 });
  await tarefa2.waitForTimeout(800);
  await preencher(tarefa2, `homologado ${rid}`);
  await tarefa2.getByRole('button', { name: 'Fechar jornada' }).first().click();
  await tarefa2.waitForSelector('text=Tarefa concluída com sucesso', { timeout: 20000 });
  check(true, '[jornada] 2ª tarefa concluída — processo chega ao fim');
  await tarefa2.close();

  // 6) O analista NUNCA recebeu nada desta instância (a simulação não vazou).
  const doAnalista = await api(token, '/api/v1/workflow/tasks?assignee=me');
  const login2 = await api(null, '/api/v1/auth/login', 'POST', { identifier: `analista.j9.${rid}@prefeitura-x.local`, password: analista.body.initialPassword });
  const tarefasAnalista = await api(login2.body.accessToken, '/api/v1/workflow/tasks?assignee=me');
  check(!tarefasAnalista.body.items.some((t) => t.executionId === inst.id),
    '[jornada] o ator do desenho não recebeu nenhuma tarefa da simulação');
  check(Array.isArray(doAnalista.body.items), '[jornada] a lista do requisitante continua respondendo');

  // 7) Relatório do processo: concluído, com selo e a tramitação completa.
  await page.goto(`${BASE}/solicitacao/${inst.id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const cabecalho = await page.locator('header').first().innerText();
  check(cabecalho.includes('Processo de teste'), '[jornada] o relatório do processo exibe o selo de teste');
  check(/Conclu[íi]do/i.test(cabecalho), `[jornada] o processo terminou concluído (${cabecalho.split('\n').join(' · ')})`);
  await page.screenshot({ path: `${OUT}/f9j-4-relatorio-web.png`, fullPage: true });

  const detalhe = await api(token, `/api/v1/workflow/instances/${inst.id}`);
  check(detalhe.body.status === 'concluido', `[jornada] status final da instância: ${detalhe.body.status}`);
  const acoes = detalhe.body.tasks.filter((t) => t.action).map((t) => t.action);
  check(acoes.includes('Aprovar jornada') && acoes.includes('Fechar jornada'),
    `[jornada] a tramitação guardou as duas ações pelo nome (${acoes.join(', ')})`);
  await ctx.close();

  // ══════════ MOBILE 375 ══════════
  const mobCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const m = await mobCtx.newPage();
  await login(m);
  await m.goto(`${BASE}/servico/${key}`, { waitUntil: 'networkidle' });
  await m.waitForSelector('[data-testid=iniciar-como-teste]', { timeout: 15000 });
  await preencher(m, `jornada mobile ${rid}`);
  await m.locator('[data-testid=iniciar-como-teste]').check();
  await m.screenshot({ path: `${OUT}/f9j-5-inicio-mobile.png`, fullPage: true });
  // No mobile os botões vivem no bottom sheet.
  await m.getByRole('button', { name: /Botões de conclusão/ }).click();
  await m.waitForTimeout(600);
  await m.getByRole('button', { name: /Iniciar/ }).first().click();
  await m.waitForSelector('text=Solicitação iniciada com sucesso', { timeout: 20000 });
  check(true, '[mobile] serviço iniciado como teste pelo bottom sheet');

  const instMob = (await api(token, '/api/v1/workflow/instances?page=1&pageSize=50')).body.items
    .filter((i) => i.processKey === key && i.isTest).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
  check(instMob && instMob.id !== inst.id, '[mobile] uma nova instância de teste foi criada pelo celular');

  await m.goto(`${BASE}/tarefas`, { waitUntil: 'networkidle' });
  await m.click('[data-testid=abrir-filtros]');
  await m.fill('[data-testid=filtro-q]', String(rid));
  await m.waitForTimeout(1600);
  const cardMob = m.locator('article[role=link]').filter({ hasText: `Analisar jornada ${rid}` }).first();
  check(await cardMob.count() > 0, '[mobile] a tarefa da simulação aparece nas pendentes');
  check(await cardMob.locator('[data-testid=selo-teste]').count() > 0, '[mobile] com o selo de processo de teste');
  check(!(await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)),
    '[mobile] sem rolagem horizontal na jornada');
  await m.screenshot({ path: `${OUT}/f9j-6-pendentes-mobile.png`, fullPage: true });

  const [tarefaMob] = await Promise.all([mobCtx.waitForEvent('page'), cardMob.click()]);
  await tarefaMob.waitForLoadState('networkidle');
  await tarefaMob.waitForSelector('header', { timeout: 15000 });
  await tarefaMob.waitForTimeout(800);
  check((await tarefaMob.locator('header').first().innerText()).includes('Processo de teste'),
    '[mobile] o topo da tarefa avisa que é processo de teste');
  await tarefaMob.screenshot({ path: `${OUT}/f9j-7-tarefa-mobile.png`, fullPage: true });
  await tarefaMob.close();
  await mobCtx.close();
} finally {
  await browser.close();
}

console.log(ok.map((m) => `✓ ${m}`).join('\n'));
if (bad.length) console.log(bad.map((m) => `✗ ${m}`).join('\n'));
console.log(bad.length ? `FALHOU (${bad.length}/${ok.length + bad.length})` : `PASSOU (${ok.length} checks)`);
process.exit(bad.length ? 1 : 0);

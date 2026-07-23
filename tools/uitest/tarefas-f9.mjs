// Fase 9 — Tarefas pendentes/executadas + Simulação. Prova o EFEITO de cada item:
// (1) botões de filtro por processo COM contador (como as categorias de serviços);
// (2) ordenação por prazo e por nº do processo, crescente e decrescente;
// (3) filtros por palavra-chave, nº do processo e intervalos de requisição/recebimento;
// (4) os filtros aplicados descritos acima da lista (e removíveis);
// (5) atualização da lista ao voltar o foco da aba E a cada 5 minutos;
// (6) perfil "Simulador de serviços" (de sistema) com a permissão de iniciar como teste;
// (7) iniciar como teste: checkbox acima do botão de enviar, TODAS as tarefas com o
//     requisitante e selo "processo de teste" na tarefa e nas listas.
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
const FORM = JSON.stringify({ components: [{ type: 'textfield', key: 'assunto', label: 'Assunto' }] });

// Ator "posição": em C as tarefas pertencem ao analista pelo desenho — é o que torna
// o roteamento da simulação observável na tela, e não só no papel.
const unidade = await api(token, '/api/v1/org-units', 'POST', { key: `dep_f9_${rid}`, name: `Depto F9 ${rid}` });
const posicao = await api(token, '/api/v1/positions', 'POST', { key: `pos_f9_${rid}`, name: `Analista F9 ${rid}`, orgUnitId: unidade.body.id });
const analista = await api(token, '/api/v1/users', 'POST', { name: `Analista F9 ${rid}`, email: `analista.f9.${rid}@prefeitura-x.local`, isInternal: true });
const perfis = await api(token, '/api/v1/access-profiles');
const perfilAdmin = perfis.body.find((p) => p.name === 'Administrador');
await api(token, `/api/v1/users/${analista.body.id}`, 'PUT', { positionIds: [posicao.body.id], accessProfileIds: [perfilAdmin.id] });

// ── Item 6 (api): o perfil de sistema existe com a permissão ────────────────
const simulador = perfis.body.find((p) => p.name === 'Simulador de serviços');
check(!!simulador && simulador.isSystem, '[item6] perfil "Simulador de serviços" existe e é de sistema');
check(simulador?.permissions?.includes('workflow:simulate'), '[item6] o perfil carrega a permissão workflow:simulate');
check(perfilAdmin.permissions.includes('workflow:simulate'), '[item6] o Administrador também tem a permissão');

const processo = (id, nome, tarefa, horas, ator) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d${id}" targetNamespace="x">
  <bpmn:process id="P${id}" name="${nome}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig inbox="Requisição de {{requisitante.nome}}: {{formulario.assunto}}" accessRules='[{"type":"all","action":"allow","capability":"view"}]' />
      <septem:formSchema>${FORM}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="S${id}"><bpmn:outgoing>F1${id}</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T${id}" name="${tarefa}">
      <bpmn:extensionElements><septem:deadlineConfig expiresIn="${horas}" />${ator}</bpmn:extensionElements>
      <bpmn:incoming>F1${id}</bpmn:incoming><bpmn:outgoing>F2${id}</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E${id}"><bpmn:incoming>F2${id}</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1${id}" sourceRef="S${id}" targetRef="T${id}" />
    <bpmn:sequenceFlow id="F2${id}" sourceRef="T${id}" targetRef="E${id}" />
  </bpmn:process>
</bpmn:definitions>`;

const atorPosicao = `<septem:actorConfig actorType="areaPosition" areaId="dep_f9_${rid}" positionId="pos_f9_${rid}" />`;
async function publicar(xml) {
  const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xml });
  await api(token, `/api/v1/workflow/process-definitions/${saved.body.key}/status`, 'PATCH', { status: 'published' });
  return saved.body.key;
}

// Prazos diferentes (24h / 120h / 72h) para a ordenação por prazo ter uma ordem certa.
const keyA = await publicar(processo('A', `Compras F9 ${rid}`, `Analisar compra ${rid}`, 24, ''));
const keyB = await publicar(processo('B', `Ferias F9 ${rid}`, `Analisar ferias ${rid}`, 120, ''));
const keyC = await publicar(processo('C', `Simulacao F9 ${rid}`, `Analisar simulacao ${rid}`, 72, atorPosicao));

const instA = await api(token, '/api/v1/workflow/instances', 'POST', { key: keyA, data: { assunto: `papelaria${rid}` } });
const instB = await api(token, '/api/v1/workflow/instances', 'POST', { key: keyB, data: { assunto: `recesso${rid}` } });
// C iniciado NORMALMENTE: a tarefa é do analista — o admin não pode vê-la em "minhas".
const instCnormal = await api(token, '/api/v1/workflow/instances', 'POST', { key: keyC, data: { assunto: `normal${rid}` } });

const listaApi = await api(token, `/api/v1/workflow/tasks?assignee=me&q=${rid}`);
const numeroDe = (execId) => listaApi.body.items.find((t) => t.executionId === execId)?.processNumber;
const numA = numeroDe(instA.body.executionId);
const numB = numeroDe(instB.body.executionId);
check(!listaApi.body.items.some((t) => t.executionId === instCnormal.body.executionId),
  '[item7] processo iniciado SEM teste não vai para o requisitante (a tarefa é do ator do desenho)');

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
/**
 * Critério objetivo do rules.md: nenhum controle pode sair da viewport (cortado =
 * inacessível) nem se sobrepor a outro. Só medir rolagem do documento não pega o
 * caso real: o campo espremido pela grade fica cortado sem gerar scroll.
 */
const controlesCortados = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const alvos = [...document.querySelectorAll('[data-testid=painel-filtros] input, [data-testid=painel-filtros] select, [data-testid=painel-filtros] button, button[aria-pressed]')];
  const nome = (el) => el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 24) || el.tagName;
  const fora = alvos.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + 1 || r.left < -1);
  }).map((el) => `fora da tela: ${nome(el)}`);
  const sobrepostos = [];
  for (let i = 0; i < alvos.length; i++) {
    for (let j = i + 1; j < alvos.length; j++) {
      const a = alvos[i].getBoundingClientRect();
      const b = alvos[j].getBoundingClientRect();
      if (a.width && b.width && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) {
        sobrepostos.push(`sobrepostos: ${nome(alvos[i])} × ${nome(alvos[j])}`);
      }
    }
  }
  return [...fora, ...sobrepostos];
});

const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};
/** Cards visíveis, traduzidos para a letra do processo (A/B/C). */
const ordemVisivel = async (page) => (await page.locator('article[role=link]').allInnerTexts())
  .map((t) => (/Compras F9/.test(t) ? 'A' : /Ferias F9/.test(t) ? 'B' : /Simulacao F9/.test(t) ? 'C' : '?'));

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  await login(page);

  // ── Item 7: iniciar como teste pela tela do serviço ───────────────────────
  await page.goto(`${BASE}/servico/${keyC}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=iniciar-como-teste]', { timeout: 15000 });
  const caixa = await page.locator('[data-testid=iniciar-como-teste]').boundingBox();
  const enviar = await page.getByRole('button', { name: /Iniciar/ }).first().boundingBox();
  check(caixa.y + caixa.height <= enviar.y + 2,
    `[item7] o checkbox fica ACIMA do botão de enviar (${Math.round(caixa.y)}px vs ${Math.round(enviar.y)}px)`);
  await page.locator('input#assunto, [role=tabpanel] input, main input[type=text]').first().fill(`simulado${rid}`);
  await page.locator('[data-testid=iniciar-como-teste]').check();
  await page.screenshot({ path: `${OUT}/f9-servico-teste-web.png`, fullPage: true });
  await page.getByRole('button', { name: /Iniciar/ }).first().click();
  await page.waitForSelector('text=Solicitação iniciada com sucesso', { timeout: 15000 });

  const instancias = await api(token, '/api/v1/workflow/instances?page=1&pageSize=50');
  const instTeste = instancias.body.items.find((i) => i.processKey === keyC && i.isTest);
  check(!!instTeste, '[item7] a instância iniciada pelo checkbox nasce marcada como teste');
  const tarefasMinhas = await api(token, `/api/v1/workflow/tasks?assignee=me&q=${rid}`);
  const tarefaTeste = tarefasMinhas.body.items.find((t) => t.executionId === instTeste?.id);
  check(!!tarefaTeste, '[item7] em simulação a tarefa vai para o REQUISITANTE, não para o ator do desenho');
  check(tarefaTeste?.isTest === true, '[item7] a tarefa se identifica como de processo de teste');

  // ── Itens 1 a 4: a lista de tarefas ───────────────────────────────────────
  await page.goto(`${BASE}/tarefas`, { waitUntil: 'networkidle' });
  await page.waitForSelector('article[role=link]', { timeout: 15000 });
  await page.click('[data-testid=abrir-filtros]');
  await page.fill('[data-testid=filtro-q]', String(rid));
  await page.waitForTimeout(1400);
  check((await ordemVisivel(page)).sort().join('') === 'ABC',
    `[item3] palavra-chave reduz a lista aos 3 processos do teste (${(await ordemVisivel(page)).join(',')})`);

  const aplicados = await page.locator('[data-testid=filtros-aplicados]').innerText();
  check(aplicados.includes('Filtros aplicados:') && aplicados.includes(`Palavra-chave: “${rid}”`),
    '[item4] o filtro de palavra-chave é descrito acima da lista');

  // Item 1: botões de processo com contador. O contador é lido do PRÓPRIO elemento —
  // o nome do processo termina em dígitos (o rid), e casar o fim do texto do botão
  // passaria em falso mesmo sem contador nenhum.
  const botaoA = page.locator('button[aria-pressed]').filter({ hasText: `Compras F9 ${rid}` }).first();
  const contadorA = await botaoA.locator('[data-testid=contador-processo]').innerText();
  check(contadorA === '1', `[item1] o botão do processo traz o contador (${contadorA})`);
  await page.getByRole('button', { name: new RegExp(`Compras F9 ${rid}`) }).click();
  await page.waitForTimeout(1200);
  check((await ordemVisivel(page)).join('') === 'A', '[item1] clicar no botão filtra a lista por aquele processo');
  // O contador tem de ser a quantidade real, não um número solto ao lado do nome.
  check(String(await page.locator('article[role=link]').count()) === contadorA,
    `[item1] o contador bate com o que a lista mostra ao clicar (${contadorA})`);
  const pillsFiltrado = await page.locator('button[aria-pressed]').allInnerTexts();
  check(pillsFiltrado.some((p) => p.includes(`Ferias F9 ${rid}`)),
    '[item1] os demais botões continuam com contador (a faceta ignora o filtro de processo)');
  const aplicados2 = await page.locator('[data-testid=filtros-aplicados]').innerText();
  check(aplicados2.includes(`Processo: Compras F9 ${rid}`), '[item4] o processo filtrado também é descrito acima da lista');

  // Item 4: remover a descrição do filtro devolve a lista.
  await page.getByRole('button', { name: `Remover filtro Processo: Compras F9 ${rid}` }).click();
  await page.waitForTimeout(1200);
  check((await ordemVisivel(page)).sort().join('') === 'ABC', '[item4] remover o filtro descrito restaura a lista');

  // ── Item 2: ordenação por prazo (24h < 72h < 120h) ────────────────────────
  await page.selectOption('[data-testid=filtro-ordenar]', 'prazo');
  await page.waitForTimeout(1200);
  check((await ordemVisivel(page)).join('') === 'ACB',
    `[item2] prazo crescente: o vencimento mais próximo vem primeiro (${(await ordemVisivel(page)).join('')})`);
  await page.click('[data-testid=filtro-direcao]');
  await page.waitForTimeout(1200);
  check((await ordemVisivel(page)).join('') === 'BCA',
    `[item2] invertida, a ordem por prazo é decrescente (${(await ordemVisivel(page)).join('')})`);
  const descOrdenacao = await page.locator('[data-testid=filtros-aplicados]').innerText();
  check(/Ordenado por prazo \(decrescente\)/.test(descOrdenacao), '[item4] a ordenação aplicada também é descrita');

  // Item 2: por nº do processo.
  await page.selectOption('[data-testid=filtro-ordenar]', 'numero');
  await page.waitForTimeout(1200);
  const numerosDesc = (await page.locator('article[role=link]').allInnerTexts())
    .map((t) => Number((t.match(/#(\d+)/) ?? [])[1])).filter(Boolean);
  check(numerosDesc.length === 3 && numerosDesc.every((n, i) => i === 0 || numerosDesc[i - 1] >= n),
    `[item2] nº do processo em ordem decrescente (${numerosDesc.join(',')})`);
  await page.click('[data-testid=filtro-direcao]');
  await page.waitForTimeout(1200);
  const numerosAsc = (await page.locator('article[role=link]').allInnerTexts())
    .map((t) => Number((t.match(/#(\d+)/) ?? [])[1])).filter(Boolean);
  check(numerosAsc.length === 3 && numerosAsc.every((n, i) => i === 0 || numerosAsc[i - 1] <= n),
    `[item2] e em ordem crescente (${numerosAsc.join(',')})`);

  // ── Item 3: nº do processo e intervalos de data ───────────────────────────
  await page.fill('[data-testid=filtro-numero]', String(numA));
  await page.waitForTimeout(1400);
  check((await ordemVisivel(page)).join('') === 'A', `[item3] filtro por nº do processo isola a requisição #${numA}`);
  check((await page.locator('[data-testid=filtros-aplicados]').innerText()).includes(`Nº do processo: ${numA}`),
    '[item4] o nº filtrado é descrito acima da lista');
  await page.fill('[data-testid=filtro-numero]', '');
  await page.waitForTimeout(1400);

  const hoje = new Date().toISOString().slice(0, 10);
  await page.fill('[data-testid=filtro-req-de]', hoje);
  await page.fill('[data-testid=filtro-req-ate]', hoje);
  await page.waitForTimeout(1200);
  check((await ordemVisivel(page)).sort().join('') === 'ABC',
    '[item3] intervalo de requisição de hoje até hoje é inclusivo (traz o que foi criado hoje)');
  await page.fill('[data-testid=filtro-req-de]', '2020-01-01');
  await page.fill('[data-testid=filtro-req-ate]', '2020-01-31');
  await page.waitForTimeout(1200);
  check((await page.locator('article[role=link]').count()) === 0,
    '[item3] janela no passado não traz requisição de hoje');
  await page.fill('[data-testid=filtro-rec-de]', hoje);
  await page.fill('[data-testid=filtro-req-de]', hoje);
  await page.fill('[data-testid=filtro-req-ate]', hoje);
  await page.waitForTimeout(1200);
  check((await page.locator('[data-testid=filtros-aplicados]').innerText()).includes('Recebimento a partir de'),
    '[item4] o intervalo de recebimento é descrito acima da lista');
  const cortadosWeb = await controlesCortados(page);
  check(cortadosWeb.length === 0, `[web] nenhum controle de filtro cortado ou sobreposto (${cortadosWeb.join(' | ') || 'clipped: 0'})`);
  await page.screenshot({ path: `${OUT}/f9-tarefas-filtros-web.png`, fullPage: true });

  await page.click('[data-testid=limpar-filtros]');
  await page.waitForTimeout(1200);
  check(await page.locator('[data-testid=filtros-aplicados]').count() === 0,
    '[item4] "Limpar tudo" remove a descrição e os filtros');
  // O campo tem de esvaziar junto: texto sobrando ali seria um filtro fantasma —
  // a tela diria que está filtrando por algo que já não filtra.
  check(await page.inputValue('[data-testid=filtro-q]') === '' && await page.inputValue('[data-testid=filtro-numero]') === '',
    '[item4] limpar também esvazia os campos do painel');

  // ── Item 7: selo nas listas e no topo da tarefa ───────────────────────────
  await page.fill('[data-testid=filtro-q]', String(rid));
  await page.waitForTimeout(1400);
  check((await ordemVisivel(page)).sort().join('') === 'ABC',
    '[item4] depois de limpar, redigitar a mesma palavra volta a filtrar');
  const cardTeste = page.locator('article[role=link]').filter({ hasText: `Simulacao F9 ${rid}` }).first();
  check(await cardTeste.locator('[data-testid=selo-teste]').count() > 0,
    '[item7] o card da tarefa de teste mostra o selo "processo de teste"');
  const cardNormal = page.locator('article[role=link]').filter({ hasText: `Compras F9 ${rid}` }).first();
  check(await cardNormal.locator('[data-testid=selo-teste]').count() === 0,
    '[item7] o card de um processo normal NÃO mostra o selo');

  // O requisito fala em cards E TABELA: a visão de tabela precisa do mesmo selo.
  await page.getByTitle('Tabela').click();
  await page.waitForTimeout(1000);
  const linhaTeste = page.locator('tbody tr').filter({ hasText: `Simulacao F9 ${rid}` }).first();
  check(await linhaTeste.count() > 0, '[item7] a visão de TABELA lista a tarefa de teste');
  check(await linhaTeste.locator('[data-testid=selo-teste]').count() > 0,
    '[item7] a TABELA de pendentes também mostra o selo de processo de teste');
  const linhaNormal = page.locator('tbody tr').filter({ hasText: `Compras F9 ${rid}` }).first();
  check(await linhaNormal.locator('[data-testid=selo-teste]').count() === 0,
    '[item7] a linha de um processo normal na tabela NÃO tem selo');
  await page.screenshot({ path: `${OUT}/f9-tabela-selo-web.png`, fullPage: true });
  // Volta para cards: a preferência fica no localStorage e as checagens seguintes
  // contam cards (em 1280 a tabela substitui os cards).
  await page.getByTitle('Cards').click();
  await page.waitForTimeout(800);
  check(await page.locator('article[role=link]').count() > 0, '[item7] alternar de volta para cards funciona');

  await page.goto(`${BASE}/tarefa/${tarefaTeste.id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('header', { timeout: 15000 });
  await page.waitForTimeout(800);
  check((await page.locator('header').first().innerText()).includes('Processo de teste'),
    '[item7] o topo da tarefa avisa que é um processo de teste');
  await page.screenshot({ path: `${OUT}/f9-tarefa-teste-web.png`, fullPage: true });

  // Concluída, o selo continua na lista de executadas.
  await api(token, `/api/v1/workflow/tasks/${tarefaTeste.id}/complete`, 'POST', { data: {} });
  await page.goto(`${BASE}/tarefas?status=concluidas`, { waitUntil: 'networkidle' });
  await page.waitForSelector('article[role=link]', { timeout: 15000 });
  await page.click('[data-testid=abrir-filtros]');
  await page.fill('[data-testid=filtro-q]', String(rid));
  await page.waitForTimeout(1400);
  const executada = page.locator('article[role=link]').filter({ hasText: `Simulacao F9 ${rid}` }).first();
  check(await executada.locator('[data-testid=selo-teste]').count() > 0,
    '[item7] o selo acompanha a tarefa na lista de executadas');
  await page.getByTitle('Tabela').click();
  await page.waitForTimeout(1000);
  const linhaExecutada = page.locator('tbody tr').filter({ hasText: `Simulacao F9 ${rid}` }).first();
  check(await linhaExecutada.count() > 0, '[item7] a tabela de executadas lista a tarefa de teste');
  check(await linhaExecutada.locator('[data-testid=selo-teste]').count() > 0,
    '[item7] a TABELA de executadas também mostra o selo');
  await page.getByTitle('Cards').click();
  await page.waitForTimeout(800);

  // ── Item 5: a lista se atualiza ao voltar o foco da aba ───────────────────
  await page.goto(`${BASE}/tarefas`, { waitUntil: 'networkidle' });
  await page.waitForSelector('article[role=link]', { timeout: 15000 });
  await page.click('[data-testid=abrir-filtros]');
  await page.fill('[data-testid=filtro-q]', String(rid));
  await page.waitForTimeout(1400);
  const antes = await page.locator('article[role=link]').count();
  await api(token, '/api/v1/workflow/instances', 'POST', { key: keyA, data: { assunto: `foco${rid}` } });
  await page.waitForTimeout(1500);
  check(await page.locator('article[role=link]').count() === antes,
    '[item5] sem foco novo, a lista não muda sozinha (a próxima checagem tem valor)');
  // O Chrome headless não coloca abas em segundo plano de verdade (bringToFront não
  // muda a visibilidade), então o evento que o navegador dispara ao trocar de aba é
  // emitido na mão — quem reage a ele é o produto.
  // bubbles: true porque o evento real sobe do document até a window — é lá que o
  // react-query escuta; sem isso a simulação não chegaria a ninguém.
  const trocarVisibilidade = (estado) => page.evaluate((valor) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => valor });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  }, estado);
  await trocarVisibilidade('hidden');
  await page.waitForTimeout(300);
  await trocarVisibilidade('visible');
  await page.waitForTimeout(2500);
  check(await page.locator('article[role=link]').count() === antes + 1,
    `[item5] ao voltar o foco da aba a lista é atualizada (${antes} → ${await page.locator('article[role=link]').count()})`);
  await ctx.close();

  // ── Item 5: e a cada 5 minutos (relógio controlado) ───────────────────────
  const relogio = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  await relogio.clock.install();
  const pr = await relogio.newPage();
  await login(pr);
  await pr.goto(`${BASE}/tarefas?q=${rid}`, { waitUntil: 'networkidle' });
  await pr.waitForSelector('article[role=link]', { timeout: 15000 });
  const antesTimer = await pr.locator('article[role=link]').count();
  await api(token, '/api/v1/workflow/instances', 'POST', { key: keyA, data: { assunto: `timer${rid}` } });
  await pr.clock.runFor(60_000); // 1 min: ainda não é hora
  await pr.waitForTimeout(1200);
  check(await pr.locator('article[role=link]').count() === antesTimer,
    '[item5] em 1 minuto a lista ainda não recarregou (o intervalo não é menor que o combinado)');
  await pr.clock.runFor(250_000); // total > 5 min
  await pr.waitForTimeout(2500);
  check(await pr.locator('article[role=link]').count() === antesTimer + 1,
    `[item5] passados 5 minutos a lista se atualiza sozinha (${antesTimer} → ${await pr.locator('article[role=link]').count()})`);
  await relogio.close();

  // ── Item 7 (negativo): sem a permissão, o checkbox não pode existir ───────
  // Sem este caso, um `can()` sempre verdadeiro passaria despercebido: a tela
  // ofereceria "iniciar como teste" a quem o backend vai recusar com 403.
  const perfilComum = await api(token, '/api/v1/access-profiles', 'POST',
    { name: `Comum F9 ${rid}`, permissions: ['workflow:read'] });
  const semPerm = await api(token, '/api/v1/users', 'POST',
    { name: `Comum F9 ${rid}`, email: `comum.f9.${rid}@prefeitura-x.local`, isInternal: true });
  await api(token, `/api/v1/users/${semPerm.body.id}`, 'PUT', { accessProfileIds: [perfilComum.body.id] });

  const semCtx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const sp = await semCtx.newPage();
  await sp.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await sp.fill('input[name=identifier]', `comum.f9.${rid}@prefeitura-x.local`);
  await sp.fill('input[type=password]', semPerm.body.initialPassword);
  await sp.click('button[type=submit]');
  await sp.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
  await sp.goto(`${BASE}/servico/${keyA}`, { waitUntil: 'networkidle' });
  await sp.waitForSelector('footer button', { timeout: 15000 });
  await sp.waitForTimeout(1500);
  // A ausência só vale se a tela REALMENTE carregou: sem o botão de enviar, o
  // checkbox estaria ausente por a página não ter renderizado.
  check(await sp.getByRole('button', { name: /Iniciar/ }).count() > 0,
    '[item7] a tela de início carregou para o usuário sem permissão');
  check(await sp.locator('[data-testid=iniciar-como-teste]').count() === 0,
    '[item7] quem NÃO tem a permissão não vê o checkbox de iniciar como teste');
  await sp.screenshot({ path: `${OUT}/f9-sem-permissao-web.png`, fullPage: true });
  await semCtx.close();

  // ── Item 6: o perfil aparece na tela de perfis de acesso ──────────────────
  const admCtx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const adm = await admCtx.newPage();
  await login(adm);
  await adm.goto(`${BASE}/admin/perfis`, { waitUntil: 'networkidle' });
  await adm.waitForTimeout(1500);
  const perfilTexto = await adm.locator('body').innerText();
  check(perfilTexto.includes('Simulador de serviços'), '[item6] o perfil aparece em Configurações › Perfis');
  await adm.screenshot({ path: `${OUT}/f9-perfis-web.png`, fullPage: true });
  await admCtx.close();

  // ── Mobile 375: filtros, selo e sem rolagem horizontal ────────────────────
  // A tarefa de teste da parte web já foi concluída; o mobile precisa de uma pendente.
  await api(token, '/api/v1/workflow/instances', 'POST', { key: keyC, data: { assunto: `mobile${rid}` }, isTest: true });
  const mobCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const m = await mobCtx.newPage();
  await login(m);
  await m.goto(`${BASE}/tarefas`, { waitUntil: 'networkidle' });
  await m.waitForSelector('article[role=link]', { timeout: 15000 });
  await m.click('[data-testid=abrir-filtros]');
  await m.fill('[data-testid=filtro-q]', String(rid));
  await m.waitForTimeout(1500);
  check(await m.locator('[data-testid=painel-filtros]').isVisible(), '[mobile] o painel de filtros abre em 375px');
  check((await m.locator('[data-testid=filtros-aplicados]').innerText()).includes('Filtros aplicados:'),
    '[mobile] os filtros aplicados são descritos acima da lista');
  const cardTesteMob = m.locator('article[role=link]').filter({ hasText: `Simulacao F9 ${rid}` }).first();
  check(await cardTesteMob.locator('[data-testid=selo-teste]').count() > 0, '[mobile] o selo de teste aparece no card');
  check(!(await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)),
    '[mobile] lista de tarefas sem rolagem horizontal');
  const hojeMob = new Date().toISOString().slice(0, 10);
  for (const campo of ['filtro-req-de', 'filtro-req-ate', 'filtro-rec-de', 'filtro-rec-ate']) await m.fill(`[data-testid=${campo}]`, hojeMob);
  await m.waitForTimeout(1200);
  const cortadosMob = await controlesCortados(m);
  check(cortadosMob.length === 0, `[mobile] nenhum controle de filtro cortado ou sobreposto (${cortadosMob.join(' | ') || 'clipped: 0'})`);
  const campos = await m.locator('[data-testid=painel-filtros] input, [data-testid=painel-filtros] select').all();
  const alturas = await Promise.all(campos.map(async (c) => (await c.boundingBox())?.height ?? 0));
  check(alturas.every((h) => h >= 32), `[mobile] campos de filtro com altura tocável (mín ${Math.round(Math.min(...alturas))}px)`);
  await m.screenshot({ path: `${OUT}/f9-tarefas-filtros-mobile.png`, fullPage: true });

  await m.goto(`${BASE}/servico/${keyC}`, { waitUntil: 'networkidle' });
  await m.waitForSelector('[data-testid=iniciar-como-teste]', { timeout: 15000 });
  const caixaMob = await m.locator('[data-testid=iniciar-como-teste]').boundingBox();
  const botaoMob = await m.getByRole('button', { name: /Iniciar|Botões de conclusão/ }).first().boundingBox();
  check(caixaMob.y + caixaMob.height <= botaoMob.y + 2,
    '[mobile] o checkbox de teste também fica acima do botão de enviar');
  check(!(await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)),
    '[mobile] tela de início do serviço sem rolagem horizontal');
  await m.screenshot({ path: `${OUT}/f9-servico-teste-mobile.png`, fullPage: true });
  await mobCtx.close();
} finally {
  await browser.close();
}

console.log(ok.map((m) => `✓ ${m}`).join('\n'));
if (bad.length) console.log(bad.map((m) => `✗ ${m}`).join('\n'));
console.log(bad.length ? `FALHOU (${bad.length}/${ok.length + bad.length})` : `PASSOU (${ok.length} checks)`);
process.exit(bad.length ? 1 : 0);

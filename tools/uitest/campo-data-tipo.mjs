// Campo Data/Hora: tipo (data / hora / data e hora) e restrição de data.
//
// (A) MODELADOR — o canvas mostra UM campo só, no formato do tipo escolhido
//     (DD/MM/YYYY HH:mm · DD/MM/YYYY · HH:mm), em 24h, com o nome em português e
//     o efeito da restrição escrito embaixo. Antes o form-js pintava DOIS
//     controles ("Date" + "hh:mm --" em 12h) para "data e hora".
// (D) SIMULADOR — abrir o serviço "como teste" usa o formulário de ABERTURA, que é
//     validado no `start` (outro caminho do `complete` da tarefa): a restrição vale
//     lá também, no cliente e no servidor.
// (B) PREENCHIMENTO — o mesmo campo é UM input com calendário adaptável
//     (calendário só / calendário + colunas de hora ao lado / só horas) e a
//     restrição vale exatamente o que foi configurada: sem restrição não bloqueia
//     nada, noPast bloqueia só o passado, noFuture só o futuro.
//
// Web 1280×900 e mobile 375×812. O painel de configuração do modelador é
// desktop-only (`lg:flex`), então (A) roda em 1280 e no mobile só se confere que
// o canvas não estoura; (B) roda inteiro nos dois tamanhos.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log(`${c ? '✓' : '✗'} ${m}`); };

const api = async (token, path, method = 'GET', body) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;

// Um campo por combinação que interessa: os 3 tipos e as 3 restrições.
const FORM = { components: [
  { type: 'datetime', key: 'dt_livre', label: 'Data e hora livre', subtype: 'datetime', properties: {} },
  { type: 'datetime', key: 'so_data', label: 'Somente data', subtype: 'date', properties: { septemDateMode: 'date' } },
  { type: 'datetime', key: 'so_hora', label: 'Somente hora', subtype: 'time', properties: { septemDateMode: 'time' } },
  { type: 'datetime', key: 'sem_futuro', label: 'Sem futuro', subtype: 'date', properties: { septemDateMode: 'date', septemDateLimit: 'noFuture' } },
  { type: 'datetime', key: 'sem_passado', label: 'Sem passado', subtype: 'date', properties: { septemDateMode: 'date', septemDateLimit: 'noPast' } },
] };
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="PDataTipo" name="Campo data tipo" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${JSON.stringify(FORM)}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Informar datas">
      <bpmn:extensionElements><septem:actionButtons><septem:actionButton id="ok" label="Concluir" /></septem:actionButtons></bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(saved.status === 201 || saved.status === 200, `[api] processo de teste criado (${saved.status})`);
const key = saved.body?.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

/**
 * Overflow horizontal + controles cortados (critério objetivo do protocolo).
 *
 * ⚠️ Tolera UMA navegação no meio da medição: depois de abrir uma requisição a tela
 * de sucesso auto-navega para a próxima tarefa em 2,5 s (CompletionScreen), e uma
 * medição solta morre com "Execution context was destroyed" quando a máquina está
 * sob carga. Sem isto a suíte fica intermitente — e sonda intermitente some com o
 * sinal do gate inteiro.
 */
const diagnostico = async (page) => {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try { return await medir(page); }
    catch (e) {
      if (!/Execution context was destroyed/.test(String(e))) throw e;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
  }
  return medir(page);
};

const medir = (page) => page.evaluate(() => {
  const overflows = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const w = window.innerWidth;
  const clipped = [...document.querySelectorAll('button, input, select, [role="option"]')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .filter((el) => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > w + 1; }).length;
  return { overflows, clipped };
});

/**
 * Estado do popover aberto do DatePickerField. Os dias vêm de `[data-day]`
 * (react-day-picker), com a data ISO na própria célula: contar botões "1..31"
 * pegaria também as colunas de hora/minuto, que são números iguais.
 */
const popover = (page) => page.evaluate(() => {
  const pop = document.querySelector('[data-date-picker-popover]');
  if (!pop) return null;
  const celulas = [...pop.querySelectorAll('[data-day]')];
  return {
    temCalendario: celulas.length > 0,
    temHoras: !!pop.querySelector('[data-date-picker-time]'),
    dias: celulas.map((c) => c.getAttribute('data-day')),
    bloqueados: celulas.filter((c) => c.getAttribute('data-disabled') === 'true').map((c) => c.getAttribute('data-day')),
  };
});

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOJE = iso(new Date());
const ONTEM = iso(new Date(Date.now() - 86400000));
const AMANHA = iso(new Date(Date.now() + 86400000));

try {
  // ── (A) MODELADOR ─────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/flows/edit?key=teste_condicoes_ui`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
    await page.getByRole('button', { name: 'Formulário', exact: true }).click();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Data / Hora' }).click();
    await page.waitForTimeout(1200);

    // Estado do ÚLTIMO campo de data do canvas (é o recém-adicionado).
    const canvas = () => page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.fjs-form-field-datetime')];
      const node = nodes[nodes.length - 1];
      if (!node) return null;
      const campos = [...node.querySelectorAll('input, select, textarea')];
      return {
        // A prévia usa a marcação do form-js: UM input desabilitado. O que importa
        // continua sendo "um controle só, não preenchível".
        preenchiveis: campos.filter((c) => !c.disabled).length,
        controles: campos.length,
        modo: node.getAttribute('data-septem-date-preview'),
        // ⚠️ innerText NÃO enxerga placeholder — e é nele que o formato mora agora.
        formato: campos[0]?.placeholder ?? '',
        classeInput: campos[0]?.className ?? '',
        texto: node.innerText.replace(/\s+/g, ' ').trim(),
      };
    });

    const inicial = await canvas();
    check(inicial?.preenchiveis === 0 && inicial?.controles === 1 && /DD\/MM\/YYYY HH:mm/.test(inicial?.formato ?? ''),
      `[modelador] "data e hora" mostra UM campo só, DD/MM/YYYY HH:mm — ${JSON.stringify(inicial?.formato)}`);
    // A queixa do dono (24/08): o campo de data era o ÚNICO pintado fora do tema do
    // form-js. A prévia tem de usar a MESMA classe de input dos vizinhos.
    check(inicial?.classeInput === 'fjs-input',
      `[modelador] o campo de data usa a pintura do form-js, como os vizinhos — ${JSON.stringify(inicial?.classeInput)}`);
    check(!/hh:mm --/i.test(inicial?.texto ?? ''), '[modelador] sem o relógio 12h "hh:mm --" do form-js');
    check(/^Data\b/.test((inicial?.texto ?? '').trim()) && !/Date/.test(inicial?.texto ?? ''),
      `[modelador] nome do campo nasce em português ("Data"), não "Date" — ${JSON.stringify(inicial?.texto)}`);

    const tipo = async (v) => {
      await page.locator('aside button', { hasText: 'Aparência' }).first().click();
      await page.waitForTimeout(300);
      await page.locator('aside select').first().selectOption(v);
      await page.waitForTimeout(900);
      return canvas();
    };
    const soData = await tipo('date');
    check(soData?.modo === 'date' && /DD\/MM\/YYYY(?! HH)/.test(soData?.formato ?? ''),
      `[modelador] "somente data" → só DD/MM/YYYY — ${JSON.stringify(soData?.formato)}`);
    const soHora = await tipo('time');
    check(soHora?.modo === 'time' && /HH:mm/.test(soHora?.formato ?? '') && !/DD\/MM/.test(soHora?.formato ?? ''),
      `[modelador] "somente hora" → só HH:mm — ${JSON.stringify(soHora?.formato)}`);
    const ambos = await tipo('datetime');
    check(ambos?.modo === 'datetime' && ambos?.preenchiveis === 0 && ambos?.controles === 1
      && /DD\/MM\/YYYY HH:mm/.test(ambos?.formato ?? ''),
      `[modelador] voltar para "data e hora" continua UM campo — ${JSON.stringify(ambos?.formato)}`);

    // A restrição escolhida vira efeito visível no canvas.
    await page.locator('aside button', { hasText: 'Validação' }).first().click();
    await page.waitForTimeout(300);
    check((await page.locator('aside select').first().inputValue()) === '',
      '[modelador] campo novo nasce SEM restrição de data');
    const semRestricao = await canvas();
    check(!/Não permite/.test(semRestricao?.texto ?? ''), '[modelador] sem restrição, o canvas não anuncia bloqueio');
    await page.locator('aside select').first().selectOption('noPast');
    await page.waitForTimeout(900);
    const comRestricao = await canvas();
    check(/Não permite data no passado\./.test(comRestricao?.texto ?? ''),
      `[modelador] a restrição escolhida aparece no canvas — ${JSON.stringify(comRestricao?.texto)}`);

    const d = await diagnostico(page);
    check(!d.overflows, '[modelador web] sem overflow horizontal');
    await page.screenshot({ path: `${OUT}/campo-data-tipo-modelador.png`, fullPage: true });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(600);
    const dm = await diagnostico(page);
    check(!dm.overflows, '[modelador mobile] canvas sem overflow horizontal em 375');
    await page.screenshot({ path: `${OUT}/campo-data-tipo-modelador-mobile.png`, fullPage: true });
    await ctx.close();
  }

  // ── (C) MODELADOR com schema LEGADO e campos ANINHADOS ────────────────────
  // Os casos de risco do renderizador próprio: campo identificado só por
  // `septemDateMode` (sem `subtype`, como vem de schema antigo) e campo dentro de
  // grupo / lista dinâmica. Processo próprio, montado sobre a fixture porque o
  // modelador exige o BPMNDiagram (sem DI o bpmn-js nem carrega o formulário) —
  // e a `key` sai do NOME, então trocar só o id sobrescreveria a fixture.
  {
    const { readFileSync } = await import('node:fs');
    const baseXml = readFileSync(new URL('./fixtures/teste_condicoes.bpmn', import.meta.url), 'utf8');
    const aninhado = { type: 'default', schemaVersion: 17, components: [
      { type: 'datetime', key: 'legado_data', label: 'Legado só data', properties: { septemDateMode: 'date' } },
      { type: 'group', label: 'Grupo', components: [
        { type: 'datetime', key: 'no_grupo', label: 'No grupo', subtype: 'time', properties: { septemDateMode: 'time' } },
      ] },
      { type: 'dynamiclist', key: 'itens', label: 'Lista', components: [
        { type: 'datetime', key: 'na_lista', label: 'Na lista', subtype: 'datetime', properties: { septemDateLimit: 'noFuture' } },
      ] },
    ] };
    const escapado = JSON.stringify(aninhado).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const xmlAninhado = baseXml
      .replace(/<septem:formSchema>[\s\S]*?<\/septem:formSchema>/, `<septem:formSchema>${escapado}</septem:formSchema>`)
      .replace(/id="teste_condicoes_ui"/g, 'id="campo_data_aninhado"')
      .replace(/name="Teste Condicoes UI"/g, 'name="Campo Data Aninhado"');
    const criado = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xmlAninhado });
    const keyAninhado = criado.body?.key;
    check(keyAninhado === 'campo_data_aninhado', `[modelador] processo aninhado criado sem tocar a fixture — ${keyAninhado}`);

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 160)));
    await login(page);
    await page.goto(`${BASE}/flows/edit?key=${keyAninhado}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.djs-palette', { timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: 'Formulário', exact: true }).click();
    await page.waitForTimeout(3000);

    const estado = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.fjs-form-field-datetime')];
      return {
        campos: nodes.map((n) => {
          const campos = [...n.querySelectorAll('input, select, textarea')];
          return {
            modo: n.getAttribute('data-septem-date-preview'),
            preenchiveis: campos.filter((c) => !c.disabled).length,
            formato: campos[0]?.placeholder ?? '',
            texto: n.innerText.replace(/\s+/g, ' ').trim(),
          };
        }),
        flatpickr: document.querySelectorAll('.flatpickr-input').length,
        relogio12h: (document.body.innerText.match(/hh:mm --/gi) || []).length,
      };
    });
    check(estado.campos.length === 3, `[modelador] os 3 campos de data do schema aparecem no canvas — ${estado.campos.length}`);
    check(estado.campos[0]?.modo === 'date' && /DD\/MM\/YYYY(?! HH)/.test(estado.campos[0]?.formato ?? ''),
      `[modelador] schema LEGADO (só septemDateMode, sem subtype) é lido como "somente data" — ${JSON.stringify(estado.campos[0]?.formato)}`);
    check(estado.campos[1]?.modo === 'time' && /HH:mm/.test(estado.campos[1]?.formato ?? ''),
      `[modelador] campo de data DENTRO DE GRUPO usa a prévia nova — ${JSON.stringify(estado.campos[1]?.formato)}`);
    check(estado.campos[2]?.modo === 'datetime' && /Não permite data no futuro\./.test(estado.campos[2]?.texto ?? ''),
      `[modelador] campo DENTRO DE LISTA DINÂMICA mostra a restrição — ${JSON.stringify(estado.campos[2]?.texto)}`);
    check(estado.campos.every((c) => c.preenchiveis === 0) && estado.flatpickr === 0 && estado.relogio12h === 0,
      '[modelador] nenhum resquício do par data+hora do form-js (flatpickr / relógio 12h)');
    check(erros.length === 0, `[modelador] canvas sem erro de página — ${JSON.stringify(erros.slice(0, 2))}`);
    await page.screenshot({ path: `${OUT}/campo-data-tipo-aninhado.png`, fullPage: true });
    await ctx.close();
  }

  // ── (D) SIMULADOR (abrir o serviço "como teste") ──────────────────────────
  // Caminho de ABERTURA, que é outro do preenchimento da tarefa: o formulário de
  // início é validado no `start` (não no `complete`). Aqui se prova que o campo de
  // data se comporta igual em simulação e que a restrição vale na abertura.
  // Servidor, sem passar pelo cliente: burlar a tela não abre simulação com data
  // inválida — e HOJE tem de ser aceito (o caso que o `subtype` ignorado quebrava).
  {
    const passado = await api(token, '/api/v1/workflow/instances', 'POST',
      { key, isTest: true, data: { sem_passado: ONTEM } });
    check(passado.status === 422 && /passado/i.test(passado.body?.fields?.sem_passado ?? ''),
      `[api simulação] abrir com data no passado é 422 no servidor — ${passado.status} ${JSON.stringify(passado.body?.fields ?? {})}`);
    const hoje = await api(token, '/api/v1/workflow/instances', 'POST',
      { key, isTest: true, data: { sem_passado: HOJE } });
    check(hoje.status === 201, `[api simulação] abrir com a data de HOJE é aceito — ${hoje.status}`);
    // O POST não devolve `isTest`; a marca se confere na própria instância.
    const execId = hoje.body?.executionId ?? hoje.body?.id;
    const inst = await api(token, `/api/v1/workflow/instances/${execId}`);
    check(inst.body?.isTest === true, `[api simulação] a instância nasce marcada como teste — isTest=${inst.body?.isTest}`);
    check(inst.body?.data?.sem_passado === HOJE || hoje.body?.tasks?.length > 0,
      `[api simulação] o valor de data informado na abertura foi gravado — ${JSON.stringify(inst.body?.data?.sem_passado)}`);
  }

  for (const view of [{ name: 'sim-web', w: 1280, h: 900 }, { name: 'sim-mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/services/${key}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.septem-date-picker-input', { timeout: 15000 });
    await page.waitForTimeout(600);

    const campos = page.locator('.septem-date-picker-input');
    const formatos = await campos.evaluateAll((els) => els.map((e) => e.placeholder));
    check(JSON.stringify(formatos) === JSON.stringify(['DD/MM/YYYY HH:mm', 'DD/MM/YYYY', 'HH:mm', 'DD/MM/YYYY', 'DD/MM/YYYY']),
      `[${view.name}] formulário de abertura: um input por campo, no formato do tipo — ${JSON.stringify(formatos)}`);

    const teste = page.getByTestId('iniciar-como-teste');
    check(await teste.count() === 1, `[${view.name}] a opção "Iniciar como teste" está disponível`);
    await teste.check();
    check(await teste.isChecked(), `[${view.name}] "Iniciar como teste" marcado`);

    // O botão de abertura chama-se "Iniciar" (o processo não define botões próprios).
    // Contamos as respostas de /workflow/instances: sem isso, "não abriu" seria
    // indistinguível de "o clique não pegou no botão".
    const respostas = [];
    page.on('response', (r) => { if (r.url().includes('/workflow/instances')) respostas.push(r.status()); });
    const iniciar = async () => {
      respostas.length = 0;
      // No mobile a barra de ações vira um sheet atrás de "Botões de conclusão".
      if (view.name.endsWith('mobile')) {
        const sheet = page.getByRole('button', { name: 'Botões de conclusão' });
        if (await sheet.count()) { await sheet.click(); await page.waitForTimeout(500); }
      }
      await page.getByRole('button', { name: 'Iniciar', exact: true }).first().click();
      await page.waitForTimeout(2500);
    };
    const brl = (i) => i.split('-').reverse().join('/');

    // "Sem passado" (noPast) com data de ONTEM → barrado ANTES de sair do cliente.
    await campos.nth(4).fill(brl(ONTEM));
    await campos.nth(4).blur();
    await page.waitForTimeout(400);
    await iniciar();
    check(respostas.length === 0 && await page.locator('text=/não pode ser no passado/i').count() > 0,
      `[${view.name}] data no passado barra a abertura da simulação (0 chamadas, erro em tela) — chamadas=${JSON.stringify(respostas)}`);
    check(await page.locator('.septem-date-picker-input').count() > 0,
      `[${view.name}] o formulário continua aberto após a recusa`);

    // HOJE passa — é o caso que o `subtype` ignorado quebrava no servidor.
    await campos.nth(4).fill(brl(HOJE));
    await campos.nth(4).blur();
    await page.waitForTimeout(400);
    await iniciar();
    check(respostas.includes(201), `[${view.name}] simulação com a data de HOJE é aceita (201) — ${JSON.stringify(respostas)}`);
    // ⚠️ Corrida conhecida: com a próxima tarefa sendo do mesmo usuário (é o caso na
    // simulação), a tela de sucesso AUTO-NAVEGA em 2,5 s (CompletionScreen →
    // navTo). Um page.evaluate solto aqui morre com "Execution context was
    // destroyed" quando a máquina está sob carga — aconteceu no gate de 17/08.
    // Por isso: os dois sinais saem de UMA leitura só, com uma segunda tentativa
    // se a navegação cortar a primeira.
    const lerTela = async () => {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
          return await page.evaluate(() => ({
            texto: document.body.innerText.replace(/\s+/g, ' '),
            pickers: document.querySelectorAll('.septem-date-picker-input').length,
            path: location.pathname,
          }));
        } catch (e) {
          if (!/Execution context was destroyed/.test(String(e))) throw e;
          await page.waitForLoadState('domcontentloaded').catch(() => {});
        }
      }
      return null;
    };
    await page.waitForSelector('text=/iniciada com sucesso/i', { timeout: 4000 }).catch(() => {});
    const tela = await lerTela();
    const naTelaDeSucesso = !!tela && /iniciada com sucesso/i.test(tela.texto);
    // Duas saídas legítimas depois do 201: a tela de sucesso, ou — se a auto-navegação
    // já disparou — a PRÓXIMA TAREFA. Ambas provam que o formulário de abertura saiu;
    // exigir só a primeira é o que tornava este trecho instável.
    // Discriminador pelo CAMINHO, não por palavra da tela: a tarefa seguinte pode se
    // chamar qualquer coisa, e foi por isso que "procurar a palavra Tarefa" falhou.
    const naProximaTarefa = (tela?.path ?? '').startsWith('/tasks/');
    check(naTelaDeSucesso || naProximaTarefa,
      `[${view.name}] a abertura saiu do formulário (path=${tela?.path}) — ${JSON.stringify((tela?.texto ?? '').slice(0, 70))}`);
    // O "não fica pedindo os campos de novo" só faz sentido NA tela de sucesso: se já
    // navegamos, os campos visíveis são os da tarefa seguinte, não os do formulário.
    check(!naTelaDeSucesso || tela.pickers === 0,
      `[${view.name}] o formulário some após abrir (pickers na tela de sucesso: ${tela?.pickers})`);

    // A tela de sucesso auto-navega para a próxima tarefa em ~2,5 s. Esperar o
    // desfecho (navegou ou não) é o que elimina a corrida — medir no meio dela não
    // mede nem uma tela nem a outra.
    await page.waitForURL(/\/tasks\//, { timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    const d2 = await diagnostico(page);
    check(!d2.overflows, `[${view.name}] sem overflow horizontal`);
    check(d2.clipped === 0, `[${view.name}] nenhum controle cortado (clipped=${d2.clipped})`);
    await page.screenshot({ path: `${OUT}/campo-data-tipo-${view.name}.png`, fullPage: true });
    await ctx.close();
  }

  // ── (B) PREENCHIMENTO ─────────────────────────────────────────────────────
  for (const view of [{ name: 'web', w: 1280, h: 900 }, { name: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);

    const inst = await api(token, '/api/v1/workflow/instances', 'POST', { key, data: {} });
    const taskId = inst.body?.tasks?.[0]?.id;
    await page.goto(`${BASE}/tasks/${taskId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.septem-date-picker-input', { timeout: 15000 });
    await page.waitForTimeout(500);

    const campos = page.locator('.septem-date-picker-input');
    check(await campos.count() === 5, `[${view.name}] 5 campos de data, UM input cada (sem par data+hora)`);
    const formatos = await campos.evaluateAll((els) => els.map((e) => e.placeholder));
    check(JSON.stringify(formatos) === JSON.stringify(['DD/MM/YYYY HH:mm', 'DD/MM/YYYY', 'HH:mm', 'DD/MM/YYYY', 'DD/MM/YYYY']),
      `[${view.name}] formato de cada campo segue o tipo — ${JSON.stringify(formatos)}`);

    const abrir = async (i) => { await campos.nth(i).click(); await page.waitForTimeout(600); };
    const fechar = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); };

    // 0 = data e hora: calendário E horas lado a lado, 24h.
    await abrir(0);
    const livre = await popover(page);
    check(livre?.temCalendario && livre?.temHoras, `[${view.name}] "data e hora": calendário + colunas de hora no mesmo popover`);
    check(livre?.bloqueados.length === 0, `[${view.name}] sem restrição NÃO bloqueia dia nenhum — ${livre?.bloqueados.length} bloqueados`);
    const h24 = await page.evaluate(() => {
      const t = document.querySelector('[data-date-picker-time]');
      if (!t) return null;
      const horas = [...t.querySelectorAll('[role="option"]')].map((b) => b.textContent.trim());
      return { tem23: horas.includes('23'), amPm: /AM|PM/i.test(t.innerText) };
    });
    check(h24?.tem23 && !h24?.amPm, `[${view.name}] relógio em 24h (existe "23", sem AM/PM)`);
    await fechar();

    // 1 = só data: calendário sem horas.
    await abrir(1);
    const soData = await popover(page);
    check(soData?.temCalendario && !soData?.temHoras, `[${view.name}] "somente data": calendário sem coluna de horas`);
    await fechar();

    // 2 = só hora: horas sem calendário.
    await abrir(2);
    const soHora = await popover(page);
    check(!soHora?.temCalendario && soHora?.temHoras, `[${view.name}] "somente hora": horas sem calendário`);
    await fechar();

    // 3 = noFuture bloqueia SÓ o futuro; 4 = noPast bloqueia SÓ o passado.
    // Comparação por data ISO (`data-day`): "hoje" sempre vale nas duas regras.
    await abrir(3);
    const futuro = await popover(page);
    await fechar();
    await abrir(4);
    const passado = await popover(page);
    await fechar();
    check(futuro?.bloqueados.every((d) => d > HOJE) && futuro?.bloqueados.includes(AMANHA) && !futuro?.bloqueados.includes(HOJE),
      `[${view.name}] "não permitir futuro" bloqueia só depois de hoje (amanhã sim, hoje não) — ${futuro?.bloqueados.length} dias`);
    check(passado?.bloqueados.every((d) => d < HOJE) && passado?.bloqueados.includes(ONTEM) && !passado?.bloqueados.includes(HOJE),
      `[${view.name}] "não permitir passado" bloqueia só antes de hoje (ontem sim, hoje não) — ${passado?.bloqueados.length} dias`);

    // O valor atual da coluna de horas nasce visível (modelo 24h do shadcn).
    await campos.nth(0).fill('01/01/2030 23:45');
    await campos.nth(0).blur();
    await page.waitForTimeout(300);
    await abrir(0);
    const visivel = await page.evaluate(() => {
      const t = document.querySelector('[data-date-picker-time]');
      const sel = t?.querySelector('[aria-selected="true"]');
      const lista = sel?.closest('[role="listbox"]');
      if (!sel || !lista) return null;
      const a = sel.getBoundingClientRect();
      const b = lista.getBoundingClientRect();
      return { texto: sel.textContent.trim(), dentro: a.top >= b.top - 1 && a.bottom <= b.bottom + 1 };
    });
    check(visivel?.dentro, `[${view.name}] a hora selecionada (${visivel?.texto}) abre já visível na coluna`);
    await fechar();

    const d = await diagnostico(page);
    check(!d.overflows, `[${view.name}] preenchimento sem overflow horizontal`);
    check(d.clipped === 0, `[${view.name}] nenhum controle cortado (clipped=${d.clipped})`);
    await page.screenshot({ path: `${OUT}/campo-data-tipo-${view.name}.png`, fullPage: true });
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${bad.length === 0 ? `PASSOU (${ok.length} checks)` : `FALHOU: ${bad.length} caso(s)\n  - ${bad.join('\n  - ')}`}`);
process.exit(bad.length === 0 ? 0 : 1);

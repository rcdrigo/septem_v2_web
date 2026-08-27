// Fase 9 — validação PÚBLICA de documentos.
// Roda em contexto SEM sessão: é o cidadão com um papel na mão. Cobre também a
// costura com o simulador — documento de ensaio não pode ser validado como autêntico.
// Web 1280 + mobile 375.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));
const erros = [];

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
const rid = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');

const cfg = await api(token, '/api/v1/settings/public', 'PUT', {
  turnstileSiteKey: '1x00000000000000000000AA',
  turnstileSecret: '1x0000000000000000000000000000000AA',
  portalUrl: 'http://localhost:5173',
});
check(cfg.status === 200, `[api] chaves de teste do Turnstile configuradas (${cfg.status})`);

// Processo com um campo QUE GERA DOCUMENTO — só esses recebem código.
const xml = (suf) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dV${suf}" targetNamespace="x">
  <bpmn:process id="PV${suf}" name="Licenca ${suf}" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${JSON.stringify({
      components: [{ type: 'filepicker', key: 'licenca', label: 'Licenca', properties: { septemDocGen: 'yes' } }],
    })}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Emitir"><bpmn:extensionElements><septem:actionButtons><septem:actionButton id="ok" label="Concluir" /></septem:actionButtons><septem:formFields><septem:formFieldEntry fieldRef="licenca" visibility="editable" /></septem:formFields></bpmn:extensionElements><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" /><bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Di${suf}"><bpmndi:BPMNPlane id="Pl${suf}" bpmnElement="PV${suf}" /></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const criado = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xml(rid) });
check(criado.status === 201, `[api] processo criado (${criado.status})`);
await api(token, `/api/v1/workflow/process-definitions/${criado.body.key}/status`, 'PATCH', { status: 'published' });

/** Inicia (real ou simulação), anexa o documento e devolve nº, taskId e código. */
const emitir = async (simulacao) => {
  const inst = await api(token, '/api/v1/workflow/instances', 'POST',
    { key: criado.body.key, data: {}, isTest: simulacao });
  const taskId = inst.body.tasks[0].id;
  const det = await api(token, `/api/v1/workflow/tasks/${taskId}`);
  const numero = det.body.processNumber;

  const form = new FormData();
  form.append('taskId', taskId);
  form.append('fieldKey', 'licenca');
  form.append('file', new Blob([`licenca ${simulacao ? 'de teste' : 'real'} ${rid}`], { type: 'application/pdf' }), 'licenca.pdf');
  const up = await fetch(`${API}/api/v1/workflow/uploads`, {
    method: 'POST', headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` }, body: form,
  });
  const { url } = await up.json();
  await api(token, `/api/v1/workflow/tasks/${taskId}/save`, 'POST',
    { data: { licenca: [{ name: 'licenca.pdf', url, size: 20 }] } });

  const codigos = await api(token, `/api/v1/workflow/tasks/${taskId}/document-codes`);
  return { numero, taskId, codigo: codigos.body?.[0]?.code };
};

const real = await emitir(false);
const teste = await emitir(true);
check(!!real.codigo && real.codigo.length === 8, `[api] documento real recebeu código de 8 caracteres (${real.codigo})`);
check(!!teste.codigo, `[api] documento de simulação também tem código (mas não deve validar)`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
try {
  for (const view of [{ name: 'web', w: 1280, h: 900 }, { name: 'mobile', w: 375, h: 812 }]) {
    // ⚠️ IP próprio por execução: as rotas públicas têm cota por IP e a suíte roda
    // várias consultas, várias vezes. Sem isto o teto estoura e a sonda "falha" com a
    // tela vazia — não é bug de produto, é o limite fazendo o trabalho dele.
    const ipDoVisitante = `203.0.113.${Math.floor(Math.random() * 240) + 5}`;
    const ctx = await browser.newContext({
      viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2,
      hasTouch: view.name === 'mobile', isMobile: view.name === 'mobile',
      extraHTTPHeaders: { 'X-Forwarded-For': ipDoVisitante },
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => erros.push(`${view.name}: ${e.message.slice(0, 160)}`));

    // ── 1) A página abre SEM login ────────────────────────────────────────
    // Nada de `networkidle`: o widget do Turnstile mantém conexão com a Cloudflare.
    await page.goto(`${BASE}/validate`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid=validacao]', { timeout: 15000 });
    check(await page.evaluate(() => !localStorage.getItem('septem.accessToken')),
      `[${view.name}] a validação abre sem sessão`);
    check(await page.locator('[data-testid=validacao-consultar]').isDisabled(),
      `[${view.name}] o botão nasce bloqueado (falta captcha e dados)`);

    // ── 2) Código ERRADO: mensagem genérica ──────────────────────────────
    await page.fill('[data-testid=validacao-numero]', String(real.numero));
    await page.fill('[data-testid=validacao-codigo]', 'ZZZZ9999');
    const liberou = await page.waitForFunction(
      () => !document.querySelector('[data-testid=validacao-consultar]')?.hasAttribute('disabled'),
      null, { timeout: 25000 }).then(() => true).catch(() => false);
    check(liberou, `[${view.name}] o captcha libera a consulta`);

    await page.locator('[data-testid=validacao-consultar]').click();
    const msgErro = await page.waitForSelector('[data-testid=validacao-erro]', { timeout: 20000 })
      .then((h) => h.innerText()).catch(() => '');
    check(/não encontrado/i.test(msgErro), `[${view.name}] código errado dá mensagem genérica ("${msgErro.slice(0, 40)}")`);
    check(!/existe|inválido para/i.test(msgErro),
      `[${view.name}] e a mensagem não revela se o processo existe`);

    // ── 3) Código CERTO: documento autêntico ─────────────────────────────
    await page.fill('[data-testid=validacao-codigo]', real.codigo);
    await page.locator('[data-testid=validacao-consultar]').click();
    await page.waitForSelector('[data-testid=validacao-resultado]', { timeout: 20000 });
    const resultado = await page.locator('[data-testid=validacao-resultado]').innerText();
    check(/autêntico/i.test(resultado), `[${view.name}] o resultado confirma a autenticidade`);
    check(resultado.includes(String(real.numero)), `[${view.name}] e mostra o número do processo`);
    check(/vers[aã]o mais recente/i.test(resultado),
      `[${view.name}] avisa que mostra sempre a versão vigente do documento`);

    // O resultado abre em NOVA ABA — requisito literal.
    const alvo = await page.locator('[data-testid=validacao-abrir]').getAttribute('target');
    check(alvo === '_blank', `[${view.name}] o documento abre em nova aba`);

    // ⭐ E ENTREGA O ARQUIVO. Conferir só o `target` deixou passar o bug em que a
    // consulta dizia "autêntico" e o link levava 401 — a URL devolvida era a do
    // storage, que exige login. Aqui o endereço é buscado SEM sessão, que é a
    // condição real do cidadão. (Buscar em vez de clicar porque a aba nova de um PDF
    // é servida pelo plugin do navegador, e a resposta não é observável nela.)
    const hrefDoc = await page.locator('[data-testid=validacao-abrir]').getAttribute('href');
    check(!/\/api\/v1\/files\//.test(hrefDoc ?? ''),
      `[${view.name}] o link não expõe o caminho interno do storage`);
    // `fetch` do Node: nenhum cabeçalho de sessão, nenhum cookie — o mais próximo
    // possível de um estranho com o papel na mão. (O contexto do navegador guarda o
    // token no localStorage, então buscar por ele não provaria nada.)
    const respostaDoc = await fetch(`${API}${hrefDoc}`, {
      headers: { 'X-Tenant': 'prefeitura-x', 'X-Forwarded-For': ipDoVisitante } })
      .then((r) => r.status).catch(() => 0);
    check(respostaDoc === 200, `[${view.name}] o documento é entregue ao visitante sem login (HTTP ${respostaDoc})`);

    // ── 4) ⭐ Documento de SIMULAÇÃO não valida ──────────────────────────
    await page.fill('[data-testid=validacao-numero]', String(teste.numero));
    await page.fill('[data-testid=validacao-codigo]', teste.codigo);
    await page.locator('[data-testid=validacao-consultar]').click();
    const erroSim = await page.waitForSelector('[data-testid=validacao-erro]', { timeout: 20000 })
      .then((h) => h.innerText()).catch(() => '');
    check(/não encontrado/i.test(erroSim),
      `[${view.name}] documento de SIMULAÇÃO não é validado como autêntico`);
    check(await page.locator('[data-testid=validacao-resultado]').count() === 0,
      `[${view.name}] e nenhum resultado é exibido para o documento de teste`);

    // ── 5) Layout ────────────────────────────────────────────────────────
    const layout = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      let clipped = 0;
      for (const el of document.querySelectorAll('[data-testid=validacao] *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) clipped++;
      }
      return { overflow, clipped };
    });
    check(!layout.overflow, `[${view.name}] validação sem overflow horizontal`);
    check(layout.clipped === 0, `[${view.name}] validação sem elemento recortado (${layout.clipped})`);
    await page.screenshot({ path: `${OUT}/validacao-${view.name}.png`, fullPage: true });

    // ── 6) O código aparece para quem ATENDE, na tarefa ──────────────────
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
    await page.goto(`${BASE}/tasks/${real.taskId}`, { waitUntil: 'networkidle' });
    const naTela = await page.waitForSelector('[data-testid=anexo-codigo]', { timeout: 20000 })
      .then((h) => h.innerText()).catch(() => '');
    check(naTela.includes(real.codigo),
      `[${view.name}] o operador vê o código ao lado do documento ("${naTela.slice(0, 45)}")`);
    await page.screenshot({ path: `${OUT}/validacao-codigo-tarefa-${view.name}.png`, fullPage: true });

    await ctx.close();
  }
} finally {
  await browser.close();
}

check(erros.length === 0, `sem erro de JavaScript${erros.length ? ' — ' + erros.join(' | ') : ''}`);
for (const m of ok) console.log('✓', m);
for (const m of bad) console.log('✗ FALHOU', m);
console.log(bad.length ? `\nFALHOU (${bad.length} de ${ok.length + bad.length})` : `\nPASSOU (${ok.length} checks)`);
process.exit(bad.length ? 1 : 0);

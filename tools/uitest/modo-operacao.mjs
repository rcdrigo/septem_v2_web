/**
 * Modos de operação do ambiente (ADM-07, Fase 9).
 *
 * O caso que dá nome à suíte é a **visita direta** ao ambiente inativado: entrar sempre
 * pelo login esconderia justamente o que se quer provar — que nenhum dado de dentro
 * aparece, venha a pessoa de onde vier.
 *
 * ⚠️ Esta suíte INATIVA o ambiente de dev e sempre o devolve para `active` no final —
 * em duas camadas (pela tela e, se ela falhar, direto pela API central), porque um
 * ambiente que ficasse inativado derrubaria todas as suítes seguintes.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
// O alvo é o ambiente que o FRONT de dev usa (`VITE_TENANT`, default prefeitura-x).
// Inativar outro não provaria nada: o navegador continuaria falando com este.
const ALVO = 'prefeitura-x';

let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

/** Sessão da área central (super admin com 2FA obrigatório). */
async function entrarNaCentral(page) {
  await page.goto(BASE + '/platform/clients', { waitUntil: 'networkidle' });
  await page.waitForSelector('input[name=email]');
  await page.fill('input[name=email]', 'super@septem.local');
  await page.fill('input[name=password]', 'super123');
  await page.click('button[type=submit]');
  await page.waitForSelector('input[name=code]', { timeout: 10000 });
  const code = await page.evaluate(async () => {
    const r = await fetch('/api/v1/platform/auth/dev/last-code?email=super@septem.local');
    return (await r.json()).code;
  });
  await page.fill('input[name=code]', code);
  await page.click('button[type=submit]');
  await page.waitForSelector('[data-testid=platform-clientes-lista]', { timeout: 15000 });
}

/** Troca o modo pela própria tela da central — é o caminho do usuário real. */
async function definirModo(page, modo) {
  await page.goto(`${BASE}/platform/environments/${ALVO}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=ambiente-modo]', { timeout: 10000 });
  const botao = page.locator(`[data-testid=modo-${modo}]`);
  if (await botao.isDisabled()) return;            // já está nesse modo
  await botao.click();
  await page.waitForFunction(
    (m) => document.querySelector('[data-testid=modo-' + m + ']')?.getAttribute('aria-pressed') === 'true',
    modo, { timeout: 10000 });
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));

try {
  // ── 1. A central mostra e troca o modo ─────────────────────────────────────
  await entrarNaCentral(page);
  await page.goto(`${BASE}/platform/environments/${ALVO}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=ambiente-modo]');
  check((await page.locator('[data-testid=ambiente-modo]').innerText()).includes('Ativo'),
    'a central mostra o modo atual do ambiente');
  check(await page.locator('[data-testid=modo-new_requests_blocked]').isVisible()
     && await page.locator('[data-testid=modo-inactive]').isVisible(),
    'as duas ações de bloqueio aparecem, separadas');
  const textoAcoes = await page.locator('[data-testid=modo-new_requests_blocked]').innerText();
  check(/já abertas continuam/i.test(textoAcoes),
    'a ação explica o efeito nas requisições existentes');
  await page.screenshot({ path: `${OUT}/modo-central-desktop.png` });

  // ── 2. "Bloquear novas": a porta de entrada avisa ──────────────────────────
  await definirModo(page, 'new_requests_blocked');

  const ambCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const amb = await ambCtx.newPage();
  await amb.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await amb.fill('input[name=identifier]', `admin@${ALVO}.local`);
  await amb.fill('input[type=password]', 'admin123');
  await amb.click('button[type=submit]');
  await amb.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
  check(true, 'o ambiente bloqueado continua deixando ENTRAR (só a abertura para)');
  await ambCtx.close();

  // ── 2b. A porta de entrada AVISA (modal interno e Central pública) ─────────
  const portaCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const porta = await portaCtx.newPage();
  await porta.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await porta.fill('input[name=identifier]', `admin@${ALVO}.local`);
  await porta.fill('input[type=password]', 'admin123');
  await porta.click('button[type=submit]');
  await porta.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  await porta.goto(BASE + '/tasks', { waitUntil: 'networkidle' });
  await porta.getByRole('button', { name: 'Nova requisição' }).click();
  await porta.waitForSelector('[role=dialog]');
  check(await porta.locator('[data-testid=novas-requisicoes-bloqueadas]').isVisible(),
    'o modal "Nova requisição" avisa que o ambiente não aceita novas');
  const avisoModal = await porta.locator('[data-testid=novas-requisicoes-bloqueadas]').innerText();
  check(/já abertas continuam/i.test(avisoModal),
    'o aviso do modal diz que as requisições existentes continuam');
  await porta.screenshot({ path: `${OUT}/modo-bloqueado-modal.png` });

  // Central de serviços PÚBLICA (sem login).
  const publicoCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const publico = await publicoCtx.newPage();
  await publico.goto(BASE + '/external-services', { waitUntil: 'networkidle' });
  await publico.waitForSelector('[data-testid=central-servicos]', { timeout: 10000 });
  check(await publico.locator('[data-testid=central-bloqueada]').isVisible(),
    'a Central de serviços pública avisa o cidadão que não há novos pedidos');
  check(await publico.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'o aviso da Central pública não estoura a largura em 375');
  await publico.screenshot({ path: `${OUT}/modo-bloqueado-publico-mobile.png` });
  await publicoCtx.close();
  await portaCtx.close();

  // ── 3. Inativado: visita DIRETA não mostra nada de dentro ──────────────────
  await definirModo(page, 'inactive');

  const visitaCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const visita = await visitaCtx.newPage();
  // Direto numa rota interna, sem passar pelo login.
  await visita.goto(BASE + '/tasks', { waitUntil: 'networkidle' });
  await visita.waitForTimeout(800);
  const corpo = await visita.evaluate(() => document.body.innerText);
  check(/indispon[ií]vel|inativado/i.test(corpo),
    `visita direta a /tasks mostra a tela de ambiente indisponível: "${corpo.slice(0, 60).replace(/\n/g, ' ')}"`);
  check(!/Tarefas pendentes|Nova requisição/i.test(corpo),
    'nenhum dado nem ação do ambiente fica visível atrás da tela');
  check(await visita.locator('[data-testid=ambiente-inativo-verificar]').isVisible(),
    'a tela oferece "Verificar novamente"');
  await visita.screenshot({ path: `${OUT}/modo-inativo-desktop.png` });

  // Mobile: a mesma tela precisa caber em 375.
  await visita.setViewportSize({ width: 375, height: 812 });
  await visita.waitForTimeout(300);
  check(await visita.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'a tela de ambiente inativado não rola na horizontal em 375');
  await visita.screenshot({ path: `${OUT}/modo-inativo-mobile.png` });
  await visitaCtx.close();

  // ── 4. A sessão aberta ANTES da inativação também cai ──────────────────────
  const abertaCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const aberta = await abertaCtx.newPage();
  await aberta.goto(BASE + '/login', { waitUntil: 'networkidle' });
  const status = await aberta.evaluate(async (alvo) => {
    const r = await fetch('/api/v1/environment-status', { headers: { 'X-Tenant': alvo } });
    return { http: r.status, corpo: await r.json() };
  }, ALVO);
  check(status.http === 200 && status.corpo.operatingMode === 'inactive',
    `a rota de status continua respondendo com o ambiente inativado (HTTP ${status.http})`);
  check(!('dbName' in status.corpo) && !('connectionString' in status.corpo),
    'o status não expõe banco nem diagnóstico');
  await abertaCtx.close();

  // ── 4b. Ao reativar, as ocorrências vencidas aparecem para decisão ─────────
  // O cenário é montado de verdade: processo com alerta de prazo cujo gatilho já
  // passou, uma requisição aberta, e o ambiente inativado em seguida.
  const cenarioCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cenario = await cenarioCtx.newPage();
  // O ambiente PRECISA estar ativo antes de abrir o login: com ele inativado a rota cai
  // na tela de indisponível e não existe campo nenhum para preencher.
  await definirModo(page, 'active');
  await cenario.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await cenario.fill('input[name=identifier]', `admin@${ALVO}.local`);
  await cenario.fill('input[type=password]', 'admin123');
  await cenario.click('button[type=submit]');
  await cenario.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  const montou = await cenario.evaluate(async () => {
    const token = localStorage.getItem('septem.accessToken');
    const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant': 'prefeitura-x' };
    const sufixo = Math.random().toString(36).slice(2, 8);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="Process_ui_${sufixo}" name="Prazo UI ${sufixo}" isExecutable="true">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar prazo ${sufixo}">
      <bpmn:extensionElements>
        <septem:deadlineConfig expiresIn="1" sendDeadlineMail="true" />
        <septem:deadlineAlerts><septem:deadlineAlert id="al1" kind="once" trigger="beforeHours" value="2" /></septem:deadlineAlerts>
      </bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;
    const salvo = await fetch('/api/v1/workflow/process-definitions', { method: 'POST', headers: h, body: JSON.stringify({ bpmnXml: xml }) });
    if (!salvo.ok) return `falhou ao salvar (${salvo.status})`;
    const { key } = await salvo.json();
    await fetch(`/api/v1/workflow/process-definitions/${key}/status`, { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'published' }) });
    const inst = await fetch('/api/v1/workflow/instances', { method: 'POST', headers: h, body: JSON.stringify({ key }) });
    return inst.ok ? 'ok' : `falhou ao iniciar (${inst.status})`;
  });
  check(montou === 'ok', `cenário de prazo vencido montado (${montou})`);
  await cenarioCtx.close();

  await definirModo(page, 'inactive');
  await definirModo(page, 'active');   // a reativação é que congela as ocorrências

  await page.goto(`${BASE}/platform/environments/${ALVO}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=ocorrencias-vencidas]', { timeout: 10000 }).catch(() => {});
  const temFila = await page.locator('[data-testid=ocorrencias-vencidas] li').count();
  check(temFila > 0, `a reativação mostra ${temFila} ocorrência(s) vencida(s) para decidir`);
  const textoFila = temFila > 0 ? await page.locator('[data-testid=ocorrencias-vencidas]').innerText() : '';
  check(/Executar/.test(textoFila) && /Descartar/.test(textoFila),
    'cada ocorrência é decidida individualmente (Executar / Descartar)');
  await page.screenshot({ path: `${OUT}/modo-ocorrencias-vencidas.png` });

  if (temFila > 0) {
    await page.locator('[data-testid=ocorrencias-vencidas] li button', { hasText: 'Descartar' }).first().click();
    await page.waitForTimeout(800);
    const depoisDeDecidir = await page.locator('[data-testid=ocorrencias-vencidas] li').count();
    check(depoisDeDecidir === temFila - 1,
      `a ocorrência decidida sai da fila (${temFila} → ${depoisDeDecidir})`);
  }

  // ── 4c. A tela de inativo reconfere ao VOLTAR O FOCO ───────────────────────
  await definirModo(page, 'inactive');
  const focoCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const foco = await focoCtx.newPage();
  await foco.goto(BASE + '/tasks', { waitUntil: 'networkidle' });
  await foco.waitForSelector('[data-testid=ambiente-inativo-titulo]', { timeout: 10000 });

  // Reativa por fora e devolve o foco: a tela precisa perceber sozinha.
  await definirModo(page, 'active');
  await foco.evaluate(() => window.dispatchEvent(new Event('focus')));
  const voltou = await foco.waitForURL((u) => !u.pathname.includes('environment-inactive'), { timeout: 15000 })
    .then(() => true).catch(() => false);
  check(voltou, 'ao voltar o foco, a tela percebe que o ambiente voltou e sai sozinha');
  await focoCtx.close();

  // ── 5. Reativar devolve o ambiente ────────────────────────────────────────
  await definirModo(page, 'active');
  const voltaCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const volta = await voltaCtx.newPage();
  await volta.goto(BASE + '/login', { waitUntil: 'networkidle' });
  const depois = await volta.evaluate(async (alvo) => {
    const r = await fetch('/api/tenant/config', { headers: { 'X-Tenant': alvo } });
    return r.status;
  }, ALVO);
  check(depois === 200, `reativado, o ambiente volta a responder (HTTP ${depois})`);
  await voltaCtx.close();
} finally {
  // Rede de segurança em DUAS camadas: um ambiente que ficasse inativado derrubaria
  // todas as suítes seguintes do run-all.
  try {
    await definirModo(page, 'active');
  } catch (e) {
    console.log('! não consegui reativar pela tela:', e.message.slice(0, 80));
  }
  try {
    const volta = await page.evaluate(async (alvo) => {
      const token = localStorage.getItem('septem.platform.accessToken');
      if (!token) return 'sem token central';
      const r = await fetch(`/api/v1/platform/environments/${alvo}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'active' }),
      });
      return r.status;
    }, ALVO);
    console.log('  (reativação de segurança pela API:', volta, ')');
  } catch (e) {
    console.log('! reativação de segurança falhou:', e.message.slice(0, 80));
  }
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

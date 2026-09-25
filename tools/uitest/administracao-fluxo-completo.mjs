/**
 * M-A28 — jornada integrada da administração (Fase 14).
 *
 * A sequência da spec, ponta a ponta:
 *   cadastrar produção + homologação → convite → personalizar → promover → sincronizar
 *   → bloquear novas solicitações → inativar → reativar,
 * conferindo no fim que **histórico e versões ficaram íntegros**.
 *
 * ⚠️ A jornada é feita em DUAS PARTES, e o motivo é do ambiente de dev, não do produto:
 * o assistente não deixa escolher o host (o subdomínio é derivado de `septemcompliance.com`,
 * decisão Q7), então um cliente novo criado aqui **não é alcançável pelo navegador local**.
 * Por isso:
 *   - cadastrar + convite rodam num cliente NOVO (é o que a spec pede: criação conjunta);
 *   - personalizar → promover → sincronizar → bloquear → inativar → reativar rodam no par
 *     `prefeitura-x` / `prefeitura-x-hml`, que o dev resolve por host.
 * Nenhum passo é simulado: cada um acontece pela tela ou pela API real.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const sufixo = Math.random().toString(36).slice(2, 7);
const PROD = 'prefeitura-x';
const HML = 'prefeitura-x-hml';

let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}

const api = async (tenant, token, p, method = 'GET', body) => {
  const r = await fetch(API + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tenant ? { 'X-Tenant': tenant } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const login = async (tenant, identifier, password) =>
  (await api(tenant, null, '/api/v1/auth/login', 'POST', { identifier, password })).body?.accessToken;

const xml = (key, nome) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${key}" targetNamespace="x">
  <bpmn:process id="P_${key}" name="${nome}" isExecutable="true">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function entrarNaCentral(page) {
  await page.goto(BASE + '/platform/clients', { waitUntil: 'networkidle' });
  await page.waitForSelector('input[name=email]', { timeout: 60000 });
  await page.fill('input[name=email]', 'super@septem.local');
  await page.fill('input[name=password]', 'super123');
  await page.click('button[type=submit]');
  await page.waitForSelector('input[name=code]', { timeout: 15000 });
  const code = await page.evaluate(async () => {
    const r = await fetch('/api/v1/platform/auth/dev/last-code?email=super@septem.local');
    return (await r.json()).code;
  });
  await page.fill('input[name=code]', code);
  await page.click('button[type=submit]');
  await page.waitForSelector('[data-testid=platform-clientes-lista]', { timeout: 20000 });
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
await entrarNaCentral(page);

// ── 1. CADASTRAR: cliente com produção E homologação ─────────────────────────
const nomeCliente = `Jornada ${sufixo}`;
const emailAdmin = `admin.jornada.${sufixo}@cliente.test`;
await page.goto(BASE + '/platform/clients/new', { waitUntil: 'networkidle' });
await page.waitForSelector('#nome', { timeout: 20000 });
await page.fill('#nome', nomeCliente);
await page.locator('[data-testid=assistente-avancar]').click();
await page.waitForSelector('[data-testid=ambiente-producao]', { timeout: 15000 });
await page.fill('#producao-id', `jor${sufixo}`);
await page.fill('#producao-db', `db_jor_${sufixo}_prod`);
await page.fill('#homologacao-id', `jor${sufixo}hml`);
await page.fill('#homologacao-db', `db_jor_${sufixo}_hml`);
await page.locator('[data-testid=assistente-avancar]').click();
await page.waitForSelector('[data-testid=assistente-funcionalidades]', { timeout: 15000 });
await page.locator('[data-testid=assistente-avancar]').click();
await page.waitForSelector('[data-testid=assistente-revisao]', { timeout: 15000 });
await page.fill('#adminNome', 'Administradora da Jornada');
await page.fill('#adminEmail', emailAdmin);
await page.locator('[data-testid=assistente-cadastrar]').click();

await page.waitForURL((u) => /\/platform\/clients\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 30000 });
const nomeNaTela = await page.waitForSelector('[data-testid=platform-cliente-nome]', { timeout: 20000 })
  .then((el) => el.innerText()).catch(() => '');
check(nomeNaTela.includes(nomeCliente), `1) cadastrado: o cliente aparece no detalhe ("${nomeNaTela.slice(0, 40)}")`);

// Os DOIS ambientes ficam prontos — é o "criação conjunta" da spec.
const doisProntos = await page.waitForFunction(() => {
  const itens = [...document.querySelectorAll('[data-testid=platform-ambientes] > li')];
  const prontos = itens.filter((li) => /Pronto/i.test(li.innerText)).length;
  return prontos >= 2;
}, null, { timeout: 180000 }).then(() => true).catch(() => false);
check(doisProntos, '1) produção e homologação ficam PRONTAS (criação conjunta)');
await page.screenshot({ path: `${OUT}/jornada-1-cadastro.png`, fullPage: true });

// ── 2. CONVITE: chega depois da prontidão, e é aceito pela tela ──────────────
const token = await page.evaluate(async (email) => {
  const r = await fetch(`/api/v1/platform/auth/dev/last-invite?email=${encodeURIComponent(email)}`);
  return r.ok ? (await r.json()).token : null;
}, emailAdmin);
check(!!token, '2) o convite do primeiro admin foi emitido depois da prontidão');

if (token) {
  const conviteCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const convidado = await conviteCtx.newPage();
  await convidado.goto(`${BASE}/platform/invite?token=${token}`, { waitUntil: 'networkidle' });
  await convidado.waitForSelector('input[name=password]', { timeout: 20000 });
  await convidado.fill('input[name=password]', 'SenhaDaJornada#2026');
  await convidado.fill('input[name=passwordConfirm]', 'SenhaDaJornada#2026');
  await convidado.locator('[data-testid=convite-definir]').click();
  const aceito = await convidado.waitForSelector('[data-testid=convite-aceito]', { timeout: 20000 })
    .then((el) => el.innerText()).catch(() => '');
  check(/senha definida/i.test(aceito), `2) o admin define a senha e o convite é aceito ("${aceito.slice(0, 40)}")`);
  await convidado.screenshot({ path: `${OUT}/jornada-2-convite.png` });
  await conviteCtx.close();
}

// ── 3. PERSONALIZAR (par alcançável em dev) ──────────────────────────────────
// Um serviço nasce na homologação, é promovido, e DEPOIS personalizado em produção:
// é a sequência que a spec descreve (replicar → personalizar).
const tokenHml = await login(HML, `admin@${HML}.local`, 'admin123');
const tokenProd = await login(PROD, `admin@${PROD}.local`, 'admin123');
check(!!tokenHml && !!tokenProd, '3) os dois ambientes do par aceitam login do admin local');

const criado = await api(HML, tokenHml, '/api/v1/workflow/process-definitions', 'POST',
  { key: `jornada-${sufixo}`, bpmnXml: xml(`jornada-${sufixo}`, `Serviço da jornada ${sufixo}`) });
const key = criado.body?.key;
await api(HML, tokenHml, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });
check(!!key, `3) serviço publicado na homologação (${key})`);

// ── 4. PROMOVER pela tela do cliente ─────────────────────────────────────────
const cliente = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pc = await cliente.newPage();
pc.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
await pc.goto(BASE + '/login', { waitUntil: 'networkidle' });
await pc.waitForSelector('input[name=identifier]', { timeout: 60000 });
await pc.fill('input[name=identifier]', 'admin.cliente@prefeitura_x.local');
await pc.fill('input[type=password]', 'admin123');
await pc.click('button[type=submit]');
await pc.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });

async function transferir(tipo, origem, destino, chave) {
  await pc.goto(BASE + '/admin/transfers', { waitUntil: 'networkidle' });
  await pc.waitForSelector('[data-testid=transf-tipos]', { timeout: 25000 });
  await pc.locator(`[data-testid=transf-tipo-${tipo}]`).check();
  await pc.locator('[data-testid=transf-avancar]').click();
  await pc.waitForSelector('[data-testid=transf-ambientes]', { timeout: 15000 });
  await pc.selectOption('[data-testid=transf-origem]', origem);
  await pc.selectOption('[data-testid=transf-destino]', destino);
  await pc.locator('[data-testid=transf-avancar]').click();
  await pc.waitForSelector(`[data-testid="transf-servico-${chave}"]`, { timeout: 25000 });
  await pc.locator(`[data-testid="transf-servico-${chave}"]`).check();
  await pc.locator('[data-testid=transf-comparar]').click();
  await pc.waitForSelector('[data-testid=transf-itens]', { timeout: 30000 });
  const confirmar = pc.locator('[data-testid=transf-confirmar]');
  if (await confirmar.count()) await confirmar.check();
  await pc.locator('[data-testid=transf-aplicar]').click();
  return await pc.waitForSelector('[data-testid=transf-resultado]', { timeout: 40000 })
    .then((el) => el.innerText()).catch(() => '');
}

const promovido = await transferir('promote', HML, PROD, key);
check(/Aplicado/i.test(promovido), '4) promover homologação → produção pela tela');
const emProducao = await api(PROD, tokenProd, `/api/v1/workflow/process-definitions/${key}`);
check(emProducao.status === 200 && emProducao.body?.status === 'published',
  `4) EFEITO: o serviço está publicado em produção (${emProducao.status}/${emProducao.body?.status})`);
await pc.screenshot({ path: `${OUT}/jornada-4-promover.png`, fullPage: true });

// Personalizar EM PRODUÇÃO, pela rota de personalização do produto.
//
// ⚠️ Com o token do ADMIN DO CLIENTE, não o do admin local do tenant: as rotas de
// `/environments/{id}/...` exigem identidade central, e o admin local — corretamente —
// recebe 404. A primeira versão desta sonda usava o token errado e o 404 estava certo.
const tokenCliente = await login(PROD, 'admin.cliente@prefeitura_x.local', 'admin123');
check(!!tokenCliente, '3) o admin do cliente autentica no ambiente de produção');

const artefatos = await api(PROD, tokenCliente, `/api/v1/environments/${PROD}/artifacts`);
const daProducao = (artefatos.body?.processes ?? []).find((p) => p.key === key);
const personalizou = await api(PROD, tokenCliente,
  `/api/v1/environments/${PROD}/artifacts/${daProducao?.id}/versions`, 'POST',
  { content: xml(key, `Serviço da jornada ${sufixo} — ajustado pelo cliente`), expectedVersion: daProducao?.currentVersion });
check(personalizou.status === 200,
  `3) personalizar em produção cria versão nova (${personalizou.status}${personalizou.status === 200 ? '' : ' ' + JSON.stringify(personalizou.body).slice(0, 90)})`);

const depoisDeCustomizar = await api(PROD, tokenCliente, `/api/v1/environments/${PROD}/artifacts`);
const marcado = (depoisDeCustomizar.body?.processes ?? []).find((p) => p.key === key);
check(marcado?.customized === true, '3) a cópia fica marcada como PERSONALIZADA');

// Personalizar cria RASCUNHO (é o comportamento do modelador: publicar é decisão à parte).
// A jornada segue como o cliente seguiria: publica a personalização antes de sincronizar —
// senão não haveria o que levar de volta para a homologação.
check(marcado?.publishedVersion != null && marcado.publishedVersion < marcado.currentVersion,
  `3) a personalização nasce como rascunho (publicada v${marcado?.publishedVersion}, corrente v${marcado?.currentVersion})`);
const publicou = await api(PROD, tokenProd,
  `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });
check(publicou.status === 200, `3) o cliente publica a personalização (${publicou.status})`);

// ── 5. SINCRONIZAR produção → homologação ────────────────────────────────────
const sincronizado = await transferir('sync_to_staging', PROD, HML, key);
check(/Aplicado/i.test(sincronizado), '5) sincronizar produção → homologação pela tela');
const naHomologacao = await api(HML, tokenHml, `/api/v1/workflow/process-definitions/${key}`);
check((naHomologacao.body?.versions ?? []).length >= 2,
  `5) EFEITO: a homologação ganhou versão nova e preservou a anterior (${(naHomologacao.body?.versions ?? []).length} versões)`);

// ── 6. BLOQUEAR novas solicitações ───────────────────────────────────────────
async function definirModo(modo) {
  await page.goto(`${BASE}/platform/environments/${PROD}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=ambiente-modo]', { timeout: 20000 });
  const botao = page.locator(`[data-testid=modo-${modo}]`);
  if (!(await botao.isDisabled())) {
    await botao.click();
    await page.waitForFunction(
      (m) => document.querySelector('[data-testid=modo-' + m + ']')?.getAttribute('aria-pressed') === 'true',
      modo, { timeout: 20000 }).catch(() => {});
  }
}

await definirModo('new_requests_blocked');
const bloqueada = await api(PROD, tokenProd, '/api/v1/workflow/instances', 'POST', { key, data: {} });
check(bloqueada.status === 403 || bloqueada.status === 422,
  `6) bloqueado: abrir solicitação é recusado (${bloqueada.status})`);
const consultaSegue = await api(PROD, tokenProd, '/api/v1/workflow/tasks');
check(consultaSegue.status === 200, `6) bloqueado: consultar continua funcionando (${consultaSegue.status})`);
await page.screenshot({ path: `${OUT}/jornada-6-bloqueado.png`, fullPage: true });

// ── 7. INATIVAR ──────────────────────────────────────────────────────────────
await definirModo('inactive');
const inativa = await api(PROD, tokenProd, '/api/v1/workflow/tasks');
check(inativa.status === 403, `7) inativado: chamada direta é negada (${inativa.status})`);

const visita = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pv = await visita.newPage();
await pv.goto(BASE + '/login', { waitUntil: 'networkidle' });
await pv.waitForTimeout(1200);
const textoInativo = await pv.locator('body').innerText();
check(/indispon|inativ|contato/i.test(textoInativo),
  `7) inativado: a tela informa em vez de pedir senha ("${textoInativo.replace(/\s+/g, ' ').slice(0, 70)}")`);
check(!/Exception|Npgsql|stack/i.test(textoInativo), '7) a tela de inativo não expõe detalhe técnico');
await pv.screenshot({ path: `${OUT}/jornada-7-inativo.png`, fullPage: true });
await visita.close();

// ── 8. REATIVAR e conferir histórico + versões ───────────────────────────────
await definirModo('active');
const tokenDepois = await login(PROD, `admin@${PROD}.local`, 'admin123');
const voltou = await api(PROD, tokenDepois, '/api/v1/workflow/tasks');
check(voltou.status === 200, `8) reativado: o ambiente volta a responder (${voltou.status})`);

const abriuDepois = await api(PROD, tokenDepois, '/api/v1/workflow/instances', 'POST', { key, data: {} });
check(abriuDepois.status === 201 || abriuDepois.status === 200,
  `8) reativado: abrir solicitação funciona de novo (${abriuDepois.status})`);

// VERSÕES ÍNTEGRAS: produção tem o histórico completo e UMA publicada.
const finalProd = await api(PROD, tokenDepois, `/api/v1/workflow/process-definitions/${key}`);
const versoes = finalProd.body?.versions ?? [];
check(versoes.length >= 2, `8) versões íntegras: produção guarda ${versoes.length} versões do serviço`);
check(finalProd.body?.status === 'published', '8) e a versão corrente está publicada');

// ── HISTÓRICO ÍNTEGRO ────────────────────────────────────────────────────────
// Lido pela API da central com token de plataforma (a rota é do super admin). Antes esta
// checagem estava escrita como `check(true, …)`: um check que não pode falhar é pior que
// check nenhum, porque dá a impressão de cobertura.
const tokenCentral = await (async () => {
  const entrou = await api(null, null, '/api/v1/platform/auth/login', 'POST',
    { email: 'super@septem.local', password: 'super123' });
  if (entrou.status >= 300) return null;
  const codigo = (await api(null, null,
    '/api/v1/platform/auth/dev/last-code?email=super@septem.local')).body?.code;
  const dois = await api(null, null, '/api/v1/platform/auth/2fa', 'POST',
    { email: 'super@septem.local', code: codigo });
  return dois.body?.accessToken ?? null;
})();
check(!!tokenCentral, '8) a área central autentica para ler o histórico');

const eventos = await api(null, tokenCentral, `/api/v1/platform/environments/${PROD}/events`);
const comoTexto = JSON.stringify(eventos.body ?? {});
check(eventos.status === 200, `8) histórico do ambiente responde (${eventos.status})`);
check(/mode/i.test(comoTexto),
  '8) histórico: as trocas de modo deste fluxo ficaram registradas');
check(!/Password=|secretKey|Ciphertext|Host=/i.test(comoTexto),
  '8) histórico: nenhum segredo nos eventos');
await page.goto(`${BASE}/platform/environments/${PROD}`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid=ambiente-modo]', { timeout: 20000 });
check((await page.locator('[data-testid=ambiente-modo]').innerText()).includes('Ativo'),
  '8) a central mostra o ambiente de volta em Ativo');
await page.screenshot({ path: `${OUT}/jornada-8-reativado.png`, fullPage: true });

await cliente.close();
await ctx.close();
console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

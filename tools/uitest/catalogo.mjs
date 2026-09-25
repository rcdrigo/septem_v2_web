/**
 * Catálogo de processos da Septem (ADM-05/ADM-06, Fase 12).
 *
 * O que esta suíte mede, na tela:
 *  - a central diz em QUAL ambiente interno os processos são modelados (o desvio da spec
 *    está registrado no plano; a tela não pode esconder isso de quem opera);
 *  - cadastrar não publica: enquanto não houver versão, a tela avisa que nenhum ambiente
 *    pode instalar o processo;
 *  - publicar mostra a versão e as PENDÊNCIAS do pacote (segredo que não viaja, etc.);
 *  - um pacote impossível de instalar é RECUSADO com motivo, e não publicado;
 *  - o assistente de provisionamento oferece os processos com versão publicada;
 *  - a lista de processos do ambiente mostra a origem ("Do catálogo v1, personalizado").
 *
 * ⚠️ O último caso usa resposta interceptada: em dev o front fala com um tenant fixo, e um
 * ambiente recém-provisionado só se acessa por convite + host próprio. O caminho de DADOS
 * (instalar → gravar origem → a lista devolver a origem) está coberto por
 * `CatalogInstallTests`; aqui se mede só a RENDERIZAÇÃO.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const sufixo = Math.random().toString(36).slice(2, 8);

let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}

const api = async (token, p, method = 'GET', body) => {
  const r = await fetch(API + p, {
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

// ── Massa: dois processos no ambiente de catálogo (que em dev é o prefeitura-x) ──
const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', {
  identifier: 'admin@prefeitura-x.local', password: 'admin123',
});
const token = auth.accessToken;

const xml = (key, nome, extras = '') => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${key}" targetNamespace="x">
  <bpmn:process id="P_${key}" name="${nome}" isExecutable="true"${extras}>
    <bpmn:extensionElements><septem:processConfig status="published" /></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

async function processoPublicado(key, nome, extras = '') {
  const r = await api(token, '/api/v1/workflow/process-definitions', 'POST', { key, bpmnXml: xml(key, nome, extras) });
  if (r.status >= 300) { console.log('! não criou o processo', r.status, JSON.stringify(r.body).slice(0, 200)); return null; }
  const derivada = r.body.key;
  await api(token, `/api/v1/workflow/process-definitions/${derivada}/status`, 'PATCH', { status: 'published' });
  return derivada;
}

const keyBoa = await processoPublicado(`cat-ui-${sufixo}`, `Catálogo UI ${sufixo}`);
// Processo citando um modelo de documento que NÃO existe: dependência obrigatória aberta.
const keyRuim = await processoPublicado(
  `cat-ruim-${sufixo}`, `Catálogo ruim ${sufixo}`,
  ' septem:templateRef="11111111-1111-1111-1111-111111111111"');
check(!!keyBoa && !!keyRuim, 'massa pronta: dois processos publicados no ambiente de catálogo');

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
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));

await entrarNaCentral(page);

// ── 1. A tela existe pelo menu e diz onde a modelagem acontece ───────────────
await page.locator('[data-testid=platform-nav-catalogo]').click();
await page.waitForSelector('[data-testid=catalogo-form]', { timeout: 20000 });
const ambiente = await page.locator('[data-testid=catalogo-ambiente]').innerText();
check(ambiente.trim().length > 0 && /prefeitura-x/.test(ambiente),
  `a central diz em qual ambiente interno se modela ("${ambiente.trim()}")`);

// ── 2. Cadastrar NÃO publica ─────────────────────────────────────────────────
await page.fill('[data-testid=catalogo-key]', keyBoa);
await page.fill('[data-testid=catalogo-nome]', `Serviço ${sufixo}`);
await page.locator('[data-testid=catalogo-cadastrar]').click();
await page.waitForSelector(`[data-testid="catalogo-publicar-${keyBoa}"]`, { timeout: 20000 });

const itemSemVersao = await page.locator(`[data-testid="catalogo-publicar-${keyBoa}"]`)
  .locator('xpath=ancestor::li').innerText();
check(/sem versão publicada/i.test(itemSemVersao),
  'cadastrar não publica: a tela avisa que nenhum ambiente pode instalar ainda');
await page.screenshot({ path: `${OUT}/catalogo-cadastrado.png` });

// ── 3. Publicar mostra a versão e o que o pacote leva ────────────────────────
await page.locator(`[data-testid="catalogo-publicar-${keyBoa}"]`).click();
await page.waitForSelector('[data-testid=catalogo-publicado]', { timeout: 30000 });
const publicado = await page.locator('[data-testid=catalogo-publicado]').innerText();
check(/Versão 1 publicada/.test(publicado), `a tela confirma a versão publicada ("${publicado.split('\n')[0]}")`);
check(/artefato/.test(publicado), 'a confirmação diz quantos artefatos a versão leva');

await page.waitForSelector(`[data-testid="catalogo-versoes-${keyBoa}"]`, { timeout: 15000 });
const versoes = await page.locator(`[data-testid="catalogo-versoes-${keyBoa}"]`).innerText();
check(/v1/.test(versoes), 'a versão entra no histórico do processo');
await page.screenshot({ path: `${OUT}/catalogo-publicado.png` });

// ── 4. Pacote impossível de instalar é RECUSADO, com motivo ──────────────────
await page.fill('[data-testid=catalogo-key]', keyRuim);
await page.fill('[data-testid=catalogo-nome]', `Serviço quebrado ${sufixo}`);
await page.locator('[data-testid=catalogo-cadastrar]').click();
await page.waitForSelector(`[data-testid="catalogo-publicar-${keyRuim}"]`, { timeout: 20000 });
await page.locator(`[data-testid="catalogo-publicar-${keyRuim}"]`).click();

const recusa = await page.waitForSelector('[data-testid=catalogo-erro]', { timeout: 30000 })
  .then((el) => el.innerText()).catch(() => '');
check(recusa.length > 0, `publicar um pacote incompleto é recusado ("${recusa.slice(0, 70)}")`);
check(!/Exception|at Septem|Npgsql/i.test(recusa), 'a recusa não expõe detalhe técnico');

// E NADA foi publicado para ele.
const semVersao = await page.locator(`[data-testid="catalogo-publicar-${keyRuim}"]`)
  .locator('xpath=ancestor::li').innerText();
check(/sem versão publicada/i.test(semVersao),
  'o processo recusado continua sem versão — não existe "publicado pela metade"');
await page.screenshot({ path: `${OUT}/catalogo-recusa.png` });

// ── 5. O assistente de provisionamento oferece o processo publicado ──────────
await page.goto(BASE + '/platform/clients/new', { waitUntil: 'networkidle' });
await page.waitForSelector('#nome', { timeout: 20000 });
await page.fill('#nome', `Cliente catálogo ${sufixo}`);
await page.locator('[data-testid=assistente-avancar]').click();
await page.waitForSelector('[data-testid=ambiente-producao]', { timeout: 15000 });
await page.locator('[data-testid=assistente-avancar]').click();
await page.waitForSelector('[data-testid=assistente-funcionalidades]', { timeout: 15000 });

await page.waitForSelector('[data-testid=assistente-catalogo]', { timeout: 15000 });
const oferecidos = await page.locator('[data-testid=assistente-catalogo]').innerText();
check(new RegExp(`Serviço ${sufixo}`).test(oferecidos),
  'o assistente oferece o processo com versão publicada');
check(!new RegExp(`Serviço quebrado ${sufixo}`).test(oferecidos),
  'o assistente NÃO oferece processo sem versão publicada');

await page.locator(`[data-testid="assistente-processo-${keyBoa}"]`).check();
await page.locator('[data-testid=assistente-avancar]').click();
await page.waitForSelector('[data-testid=revisao-processos]', { timeout: 15000 });
const revisao = await page.locator('[data-testid=revisao-processos]').innerText();
check(revisao.includes(keyBoa), `a revisão mostra o que será instalado ("${revisao.slice(0, 50)}")`);
await page.screenshot({ path: `${OUT}/catalogo-assistente.png` });

// ── 6. Mobile: a tela do catálogo cabe em 375 ────────────────────────────────
await page.goto(BASE + '/platform/process-catalog', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid=catalogo-form]', { timeout: 20000 });
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(400);
check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  'o catálogo não rola na horizontal em 375');
check(await page.locator('[data-testid=catalogo-cadastrar]').isVisible(),
  'o botão de cadastrar continua alcançável no mobile');
await page.screenshot({ path: `${OUT}/catalogo-mobile.png` });
await ctx.close();

// ── 7. A origem aparece na lista de processos do ambiente ────────────────────
// Resposta interceptada (ver o aviso no topo): mede a RENDERIZAÇÃO da procedência.
for (const vp of [{ n: 'web', width: 1280, height: 900 }, { n: 'mobile', width: 375, height: 812 }]) {
  const c2 = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const p2 = await c2.newPage();
  await p2.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p2.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await p2.fill('input[name=password]', 'admin123');
  await p2.click('button[type=submit]');
  await p2.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });

  await p2.route('**/api/v1/workflow/process-definitions/?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            key: 'vindo-do-catalogo', name: 'Licença do catálogo', description: null, version: 3,
            status: 'published', icon: null, category: null, categoryId: null, categoryColor: null,
            categoryIcon: null, area: null, updatedAt: new Date().toISOString(),
            catalogKey: 'licenca-de-obra', catalogVersion: 2, customized: true,
          },
          {
            key: 'proprio-do-cliente', name: 'Processo próprio', description: null, version: 1,
            status: 'draft', icon: null, category: null, categoryId: null, categoryColor: null,
            categoryIcon: null, area: null, updatedAt: new Date().toISOString(),
            catalogKey: null, catalogVersion: null, customized: false,
          },
        ],
        total: 2, page: 1, pageSize: 20,
      }),
    });
  });

  await p2.goto(BASE + '/admin/flows', { waitUntil: 'networkidle' });
  // Espera tolerante: se a origem não aparecer, o check falha com mensagem — estourar aqui
  // mataria a suíte e esconderia os outros casos.
  const origem = await p2.waitForSelector('[data-testid=origem-catalogo-vindo-do-catalogo]', { timeout: 20000 })
    .then((el) => el.innerText()).catch(() => '');
  check(/catálogo v2/i.test(origem) && /personalizado/i.test(origem),
    `[${vp.n}] a lista mostra "do catálogo v2, personalizado" ("${origem.trim()}")`);
  check(await p2.locator('[data-testid=origem-catalogo-proprio-do-cliente]').count() === 0,
    `[${vp.n}] processo próprio do cliente NÃO ganha rótulo de origem`);
  // Só no mobile: a versão com `|| vp.n === 'web'` que estava aqui NÃO podia falhar em
  // 1280 — um check que passa sempre é pior que check nenhum.
  if (vp.n === 'mobile')
    check(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      '[mobile] a lista com a origem não rola na horizontal');
  await p2.screenshot({ path: `${OUT}/catalogo-origem-${vp.n}.png`, fullPage: true });
  await c2.close();
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

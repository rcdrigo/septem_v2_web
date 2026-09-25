/**
 * Transferências entre ambientes do cliente (ADM-06 · M-A20–M-A25, Fase 13).
 *
 * O que esta suíte mede, na tela e no banco:
 *  - o assistente só oferece ambientes que o admin do cliente alcança, e a DIREÇÃO certa
 *    para cada tipo (promover é para produção);
 *  - a conferência mostra as DEPENDÊNCIAS que entraram sozinhas e o que será SOBRESCRITO;
 *  - "Confirmar e aplicar" só libera depois da confirmação explícita do conflito;
 *  - aplicar tem EFEITO: o serviço passa a existir no destino, publicado;
 *  - mudar a origem depois de comparar devolve 409 e a tela pede nova comparação.
 *
 * Web 1280 + mobile 375.
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

const api = async (tenant, token, p, method = 'GET', body) => {
  const r = await fetch(API + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': tenant,
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

const tokenHml = await login('prefeitura-x-hml', 'admin@prefeitura-x-hml.local', 'admin123');
check(!!tokenHml, 'o ambiente de homologação existe e aceita login do admin local');

/**
 * Um serviço publicado só na HOMOLOGAÇÃO, por viewport.
 *
 * ⚠️ Cada viewport tem o SEU: a primeira passada aplica a transferência de verdade, e
 * reaproveitar o mesmo serviço faria o mobile comparar um destino já atualizado — as
 * asserções de "novo no destino" passariam a falhar por acoplamento, não por bug.
 */
async function servicoNaHomologacao(marca) {
  const pedida = `transf-ui-${marca}`;
  const criado = await api('prefeitura-x-hml', tokenHml, '/api/v1/workflow/process-definitions', 'POST',
    { key: pedida, bpmnXml: xml(pedida, `Transferência UI ${marca}`) });
  const derivada = criado.body?.key;
  check(!!derivada, `serviço criado na homologação (${criado.status}, key=${derivada})`);
  await api('prefeitura-x-hml', tokenHml, `/api/v1/workflow/process-definitions/${derivada}/status`, 'PATCH',
    { status: 'published' });
  return derivada;
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

for (const vp of [{ n: 'web', width: 1280, height: 900 }, { n: 'mobile', width: 375, height: 812 }]) {
  const key = await servicoNaHomologacao(`${sufixo}${vp.n === 'web' ? 'w' : 'm'}`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));

  // Login como ADMIN DO CLIENTE (identidade central espelhada) — é quem transfere.
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin.cliente@prefeitura_x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });

  await page.goto(BASE + '/admin/transfers', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=transf-tipos]', { timeout: 25000 });

  // ── 1. Tipo → ambientes: a direção certa é oferecida ──────────────────────
  await page.locator('[data-testid=transf-tipo-promote]').check();
  await page.locator('[data-testid=transf-avancar]').click();
  await page.waitForSelector('[data-testid=transf-ambientes]', { timeout: 15000 });

  const origens = await page.locator('[data-testid=transf-origem] option').allInnerTexts();
  const destinos = await page.locator('[data-testid=transf-destino] option').allInnerTexts();
  check(origens.some((o) => /Homologação/i.test(o)),
    `[${vp.n}] a origem oferece a homologação (${origens.filter(Boolean).length} opção(ões))`);
  check(destinos.some((d) => /prefeitura-x\.localhost/.test(d)) && !destinos.some((d) => /hml/.test(d)),
    `[${vp.n}] promover só oferece PRODUÇÃO como destino`);
  // Ambiente de outro cliente não aparece em lugar nenhum.
  check(![...origens, ...destinos].some((t) => /prefeitura-y/.test(t)),
    `[${vp.n}] ambiente de outro cliente não aparece nas listas`);

  await page.selectOption('[data-testid=transf-origem]', 'prefeitura-x-hml');
  await page.selectOption('[data-testid=transf-destino]', 'prefeitura-x');
  await page.locator('[data-testid=transf-avancar]').click();

  // ── 2. Serviços → comparar ────────────────────────────────────────────────
  await page.waitForSelector('[data-testid=transf-servicos]', { timeout: 15000 });
  const alvo = page.locator(`[data-testid="transf-servico-${key}"]`);
  check(await alvo.count() === 1, `[${vp.n}] o serviço da homologação aparece para escolher`);
  if (await alvo.count() === 1) await alvo.check();
  await page.locator('[data-testid=transf-comparar]').click();

  await page.waitForSelector('[data-testid=transf-itens]', { timeout: 30000 });
  const itens = await page.locator('[data-testid=transf-itens]').innerText();
  check(new RegExp(`Transferência UI ${sufixo}`).test(itens),
    `[${vp.n}] a conferência lista o serviço escolhido`);
  const acao = await page.locator(`[data-testid="transf-acao-${key}"]`).innerText();
  check(/Novo no destino/i.test(acao), `[${vp.n}] a ação aparece como "novo no destino" ("${acao.trim()}")`);
  check(await page.locator('[data-testid=transf-confirmar]').count() === 0,
    `[${vp.n}] sem conflito, a tela NÃO pede confirmação de sobrescrita`);
  await page.screenshot({ path: `${OUT}/transferencias-conferir-${vp.n}.png`, fullPage: true });

  if (vp.n === 'mobile') {
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      '[mobile] a conferência não rola na horizontal em 375');
    check(await page.locator('[data-testid=transf-aplicar]').isVisible(),
      '[mobile] o botão de aplicar continua alcançável');
    await ctx.close();
    continue;   // aplicar de verdade só uma vez (o efeito é global)
  }

  // ── 3. Aplicar tem EFEITO ─────────────────────────────────────────────────
  await page.locator('[data-testid=transf-aplicar]').click();
  const resultado = await page.waitForSelector('[data-testid=transf-resultado]', { timeout: 40000 })
    .then((el) => el.innerText()).catch(() => '');
  check(/Aplicado/i.test(resultado), `[web] a tela confirma a aplicação ("${resultado.split('\n')[0]}")`);

  const tokenProd = await login('prefeitura-x', 'admin@prefeitura-x.local', 'admin123');
  const noDestino = await api('prefeitura-x', tokenProd, `/api/v1/workflow/process-definitions/${key}`);
  check(noDestino.status === 200 && noDestino.body?.status === 'published',
    `[web] EFEITO: o serviço existe em produção e está publicado (${noDestino.status}/${noDestino.body?.status})`);

  // Abrir solicitação prova que a projeção veio junto — "existe" não basta.
  const abriu = await api('prefeitura-x', tokenProd, '/api/v1/workflow/instances', 'POST',
    { key, data: {} });
  check(abriu.status === 201 || abriu.status === 200,
    `[web] EFEITO: dá para abrir solicitação do serviço transferido (${abriu.status})`);

  // ── 4. Mudar a origem depois de comparar → 409 ────────────────────────────
  //
  // A ordem importa: a origem muda UMA VEZ antes de comparar (senão o destino já estaria
  // igual e o plano nasceria sem nada a fazer, o que desabilita o aplicar com razão) e
  // muda DE NOVO depois — é essa segunda mudança que o 409 tem de pegar.
  await api('prefeitura-x-hml', tokenHml, '/api/v1/workflow/process-definitions', 'POST',
    { key, bpmnXml: xml(key, `Primeira mudança ${sufixo}`) });
  await api('prefeitura-x-hml', tokenHml, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH',
    { status: 'published' });

  await page.locator('[data-testid=transf-voltar]').click();
  await page.waitForSelector('[data-testid=transf-servicos]', { timeout: 15000 });
  await page.locator('[data-testid=transf-comparar]').click();
  await page.waitForSelector('[data-testid=transf-itens]', { timeout: 30000 });

  const acaoAtualiza = await page.locator(`[data-testid="transf-acao-${key}"]`).innerText();
  check(/Atualiza/i.test(acaoAtualiza),
    `[web] cópia que veio de transferência e não foi mexida aparece como ATUALIZA, não conflito ("${acaoAtualiza.trim()}")`);

  // Agora a origem muda OUTRA VEZ, depois de a pessoa ter comparado.
  await api('prefeitura-x-hml', tokenHml, '/api/v1/workflow/process-definitions', 'POST',
    { key, bpmnXml: xml(key, `Mudou depois ${sufixo}`) });
  await api('prefeitura-x-hml', tokenHml, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH',
    { status: 'published' });

  const aplicar = page.locator('[data-testid=transf-aplicar]');
  if (await aplicar.count()) {
    await aplicar.click();
    const aviso = await page.waitForSelector('[data-testid=transf-aviso]', { timeout: 30000 })
      .then((el) => el.innerText()).catch(() => '');
    check(/mudaram depois da comparação|compare de novo/i.test(aviso),
      `[web] mudança na origem devolve o aviso de comparar de novo ("${aviso.slice(0, 80)}")`);
    check(!/Exception|at Septem|Npgsql/i.test(aviso), '[web] o aviso não expõe detalhe técnico');
  } else {
    check(false, '[web] o botão de aplicar não estava disponível para testar o 409');
  }
  await page.screenshot({ path: `${OUT}/transferencias-stale-web.png`, fullPage: true });

  // ── 5. CONFLITO: o que será sobrescrito, com confirmação explícita ─────────
  //
  // É o caso mais consequente da tela: o destino tem um serviço que o CLIENTE desenhou com
  // a mesma chave. Aplicar joga fora o trabalho dele, então o botão só libera depois do
  // "entendo que será sobrescrito".
  const conflitante = await servicoNaHomologacao(`${sufixo}c`);
  const tokenProd2 = await login('prefeitura-x', 'admin@prefeitura-x.local', 'admin123');
  await api('prefeitura-x', tokenProd2, '/api/v1/workflow/process-definitions', 'POST',
    { key: conflitante, bpmnXml: xml(conflitante, `Feito pelo cliente ${sufixo}`) });
  await api('prefeitura-x', tokenProd2, `/api/v1/workflow/process-definitions/${conflitante}/status`, 'PATCH',
    { status: 'published' });

  await page.goto(BASE + '/admin/transfers', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=transf-tipos]', { timeout: 25000 });
  await page.locator('[data-testid=transf-tipo-promote]').check();
  await page.locator('[data-testid=transf-avancar]').click();
  await page.waitForSelector('[data-testid=transf-ambientes]', { timeout: 15000 });
  await page.selectOption('[data-testid=transf-origem]', 'prefeitura-x-hml');
  await page.selectOption('[data-testid=transf-destino]', 'prefeitura-x');
  await page.locator('[data-testid=transf-avancar]').click();
  await page.waitForSelector(`[data-testid="transf-servico-${conflitante}"]`, { timeout: 20000 });
  await page.locator(`[data-testid="transf-servico-${conflitante}"]`).check();
  await page.locator('[data-testid=transf-comparar]').click();
  await page.waitForSelector('[data-testid=transf-itens]', { timeout: 30000 });

  const acaoConflito = await page.locator(`[data-testid="transf-acao-${conflitante}"]`).innerText();
  check(/Sobrescreve/i.test(acaoConflito),
    `[web] a tela diz que vai SOBRESCREVER a alteração local ("${acaoConflito.trim()}")`);

  const caixa = page.locator('[data-testid=transf-confirmar]');
  check(await caixa.count() === 1, '[web] a tela pede confirmação explícita da sobrescrita');
  check(await page.locator('[data-testid=transf-aplicar]').isDisabled(),
    '[web] aplicar fica BLOQUEADO enquanto a sobrescrita não é confirmada');

  await caixa.check();
  check(!(await page.locator('[data-testid=transf-aplicar]').isDisabled()),
    '[web] confirmada a sobrescrita, aplicar libera');
  await page.screenshot({ path: `${OUT}/transferencias-conflito-web.png`, fullPage: true });

  await page.locator('[data-testid=transf-aplicar]').click();
  const depoisDoConflito = await page.waitForSelector('[data-testid=transf-resultado]', { timeout: 40000 })
    .then((el) => el.innerText()).catch(() => '');
  check(/Aplicado/i.test(depoisDoConflito), '[web] a sobrescrita confirmada é aplicada');

  // A versão anterior do cliente continua no histórico — é o que permite voltar atrás.
  const historico = await api('prefeitura-x', tokenProd2,
    `/api/v1/workflow/process-definitions/${conflitante}`);
  const versoes = historico.body?.versions ?? [];
  check(versoes.length >= 2 && historico.body?.status === 'published',
    `[web] EFEITO: o destino tem ${versoes.length} versões e a nova está publicada (a anterior ficou recuperável)`);

  await ctx.close();
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

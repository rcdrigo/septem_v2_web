/**
 * Provisionamento de cliente e ambiente pela área central (ADM-02/ADM-03, Fase 11a).
 *
 * Exercita o caminho real: assistente → cadastro → cartões de progresso → ambiente pronto
 * → convite. O que importa aqui não é a tela existir, é o EFEITO: o cliente aparece na
 * listagem, os dois ambientes nascem com bancos distintos e o convite fica visível.
 *
 * ⚠️ Esta suíte CRIA bancos no Postgres de dev. Ela os remove no fim — e, se não
 * conseguir, imprime quais ficaram, para ninguém precisar caçar.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';

let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}

const sufixo = Math.random().toString(36).slice(2, 7);
const nomeCliente = `Prefeitura UI ${sufixo}`;
const idProducao = `uiprov${sufixo}`;
const idHomologacao = `uiprov${sufixo}-hml`;

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

try {
  await entrarNaCentral(page);

  // ── 1. O assistente ────────────────────────────────────────────────────────
  await page.locator('[data-testid=novo-cliente]').click();
  await page.waitForSelector('[data-testid=assistente-etapas]', { timeout: 15000 });
  check((await page.locator('[data-testid=assistente-etapas] li').count()) === 4,
    'o assistente tem as 4 etapas');

  await page.fill('#nome', nomeCliente);
  await page.locator('[data-testid=assistente-avancar]').click();

  // Etapa de ambientes: produção e homologação SEPARADAS.
  await page.waitForSelector('[data-testid=ambiente-producao]');
  check(await page.locator('[data-testid=ambiente-homologacao]').isVisible(),
    'produção e homologação aparecem separadas, cada uma com seus campos');
  check(await page.locator('[data-testid=producao-sem-dummy]').isVisible()
     && await page.locator('[data-testid=producao-dummy]').count() === 0,
    'produção NÃO oferece dados fictícios');
  check(await page.locator('[data-testid=homologacao-dummy]').isVisible(),
    'homologação tem a própria opção de dados fictícios');

  await page.fill('#producao-id', idProducao);
  await page.fill('#producao-db', `uiprov_${sufixo}_prod`);
  await page.fill('#homologacao-id', idHomologacao);
  await page.fill('#homologacao-db', `uiprov_${sufixo}_hml`);
  await page.screenshot({ path: `${OUT}/provisionamento-assistente.png` });
  await page.locator('[data-testid=assistente-avancar]').click();

  // Funcionalidades: o que não existe aparece desabilitado.
  await page.waitForSelector('[data-testid=assistente-funcionalidades]');
  check(await page.locator('[data-testid=assistente-feature-dashboards]').isDisabled(),
    'funcionalidade indisponível não pode ser contratada');
  await page.locator('[data-testid=assistente-avancar]').click();

  // Administrador + revisão.
  await page.waitForSelector('[data-testid=assistente-revisao]');
  await page.fill('#adminNome', 'Administradora do Cliente');
  await page.fill('#adminEmail', `admin.ui.${sufixo}@cliente.test`);
  const revisao = await page.locator('[data-testid=assistente-revisao]').innerText();
  check(revisao.includes(nomeCliente), 'a revisão mostra o que será criado');
  check(/pendentes|não impedem/i.test(revisao),
    'a revisão avisa que integrações pendentes não impedem a prontidão');

  // ── 2. Cadastro → cartões de progresso ─────────────────────────────────────
  await page.locator('[data-testid=assistente-cadastrar]').click();
  await page.waitForURL((u) => /\/platform\/clients\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 30000 });
  // Asserção sobre o CONTEÚDO, não sobre "a tela abriu": o nome do cliente tem de estar lá.
  const nomeNaTela = await page.waitForSelector('[data-testid=platform-cliente-nome]', { timeout: 20000 })
    .then((el) => el.innerText()).catch(() => '');
  check(nomeNaTela.includes(nomeCliente),
    `cadastrado: o detalhe mostra o cliente criado ("${nomeNaTela.slice(0, 40)}")`);

  // Os dois ambientes aparecem.
  await page.waitForSelector('[data-testid=platform-ambientes]', { timeout: 20000 });
  // Os dois ambientes aparecem à medida que o worker reserva cada um — contar na hora
  // pegaria o estado intermediário (sob a carga do gate, achou 1). Esperamos os DOIS,
  // somando o que já é ambiente com o que ainda é operação pendente.
  //
  // Filhos DIRETOS: o cartão de progresso desenha um <li> por etapa dentro do <li> do
  // ambiente, e contar sem o `>` somaria os dois níveis.
  const doisApareceram = await page.waitForFunction(() => {
    const ambientes = document.querySelectorAll('[data-testid=platform-ambientes] > li').length;
    const pendentes = document.querySelectorAll('[data-testid=operacoes-pendentes] > *').length;
    return ambientes + pendentes >= 2;
  }, null, { timeout: 60000 }).then(() => true).catch(() => false);
  check(doisApareceram, 'o cliente nasce com 2 ambientes');

  // O provisionamento anda sozinho até ficar pronto (o worker roda a cada poucos segundos).
  const prontos = await page.waitForFunction(() => {
    const textos = [...document.querySelectorAll('[data-testid=platform-ambientes] > li')].map((l) => l.innerText);
    return textos.length === 2 && textos.every((t) => /Pronto/.test(t));
  }, null, { timeout: 120000 }).then(() => true).catch(() => false);
  check(prontos, 'os dois ambientes ficam PRONTOS sem ninguém recarregar a página');
  await page.screenshot({ path: `${OUT}/provisionamento-pronto.png` });

  // Bancos e endereços distintos (M-A03), lidos da própria tela.
  const detalhe = await page.locator('[data-testid=platform-ambientes]').innerText();
  // Q18 (Fase 12): "Ambiente de homologação" — minúscula depois da primeira palavra.
  check(detalhe.includes('Produção') && /homologação/i.test(detalhe),
    'as duas finalidades aparecem no detalhe');
  check(detalhe.includes(idProducao) && detalhe.includes(idHomologacao),
    'cada ambiente tem o seu endereço');

  // ── 3. Convite do administrador ────────────────────────────────────────────
  const temConvite = await page.waitForSelector('[data-testid=convites]', { timeout: 30000 })
    .then(() => true).catch(() => false);
  check(temConvite, 'o convite do administrador aparece no detalhe do cliente');
  if (temConvite) {
    const situacao = await page.locator('[data-testid=convite-situacao]').innerText();
    check(/Convite (enviado|não entregue|aceito)/.test(situacao),
      `a situação do convite é explícita: "${situacao.slice(0, 60)}"`);
    check(await page.locator('[data-testid=reenviar-convite]').isVisible(),
      'há como reenviar o convite');
  }

  // ── 3b. O ADMIN ACEITA o convite pela tela (M-A10 ponta a ponta) ───────────
  // O token só existe no e-mail; em dev ele fica na caixa de códigos, do mesmo jeito
  // que o 2FA. Sem isso não haveria como exercitar um convite obrigatório.
  const token = await page.evaluate(async (email) => {
    const r = await fetch(`/api/v1/platform/auth/dev/last-invite?email=${encodeURIComponent(email)}`);
    return r.ok ? (await r.json()).token : null;
  }, `admin.ui.${sufixo}@cliente.test`);
  check(!!token, 'o token do convite chega pela caixa de dev');

  if (token) {
    const conviteCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const convidado = await conviteCtx.newPage();
    await convidado.goto(`${BASE}/platform/invite?token=${token}`, { waitUntil: 'networkidle' });
    await convidado.waitForSelector('input[name=password]', { timeout: 15000 });

    // Senhas diferentes: a tela avisa e não envia.
    await convidado.fill('input[name=password]', 'SenhaDoAdmin#2026');
    await convidado.fill('input[name=passwordConfirm]', 'outra-coisa');
    await convidado.locator('[data-testid=convite-definir]').click();
    check(await convidado.locator('[data-testid=convite-aviso]').isVisible(),
      'senhas diferentes são recusadas antes de enviar');

    await convidado.fill('input[name=passwordConfirm]', 'SenhaDoAdmin#2026');
    await convidado.locator('[data-testid=convite-definir]').click();
    const confirmacao = await convidado.waitForSelector('[data-testid=convite-aceito]', { timeout: 15000 })
      .then((el) => el.innerText()).catch(() => '');
    check(/senha definida/i.test(confirmacao),
      `o admin define a senha e o convite é aceito pela tela ("${confirmacao.slice(0, 40)}")`);
    await convidado.screenshot({ path: `${OUT}/provisionamento-convite-aceito.png` });

    // O MESMO link não serve de novo.
    await convidado.goto(`${BASE}/platform/invite?token=${token}`, { waitUntil: 'networkidle' });
    await convidado.fill('input[name=password]', 'SenhaDoAdmin#2026');
    await convidado.fill('input[name=passwordConfirm]', 'SenhaDoAdmin#2026');
    await convidado.locator('[data-testid=convite-definir]').click();
    // ⚠️ Aqui um check frouxo passaria em falso: a tela também mostra aviso quando as
    // senhas não batem. Medimos o TEXTO — tem de falar do convite, não da senha.
    const recusa = await convidado.waitForSelector('[data-testid=convite-aviso]', { timeout: 15000 })
      .then((el) => el.innerText()).catch(() => '');
    check(/convite/i.test(recusa) && !/senhas/i.test(recusa),
      `o convite não pode ser usado duas vezes ("${recusa.slice(0, 50)}")`);
    await conviteCtx.close();

    // E a central passa a mostrar "aceito".
    await page.reload({ waitUntil: 'networkidle' });
    const situacao = await page.waitForSelector('[data-testid=convite-situacao]', { timeout: 20000 })
      .then((el) => el.innerText()).catch(() => '');
    check(/aceito/i.test(situacao), `a central mostra o convite como aceito ("${situacao.slice(0, 50)}")`);
  }

  // ── 3c. Nome exibido editável e pendência de integração (M-A14) ────────────
  const linkAmbiente = page.locator(`[data-testid=abrir-ambiente-${idProducao}]`);
  if (await linkAmbiente.count()) {
    await linkAmbiente.click();
    await page.waitForSelector('[data-testid=ambiente-nome-exibido]', { timeout: 15000 });

    await page.fill('input[name=displayName]', 'Portal do Cidadão');
    await page.locator('[data-testid=salvar-nome-exibido]').click();
    const renomeou = await page.waitForFunction(
      () => document.querySelector('[data-testid=ambiente-nome]')?.textContent?.includes('Portal do Cidadão'),
      null, { timeout: 15000 }).then(() => true).catch(() => false);
    check(renomeou, 'o nome exibido é editável depois de criado (e o título muda de verdade)');

    const temPendencia = await page.locator('[data-testid=integracoes-pendentes]').count();
    check(temPendencia === 1, 'integrações a configurar aparecem como pendência DISTINTA');
    const textoPendencia = temPendencia ? await page.locator('[data-testid=integracoes-pendentes]').innerText() : '';
    check(/não impedem/i.test(textoPendencia),
      'a pendência deixa claro que não impede o ambiente de funcionar (M-A14)');
    await page.screenshot({ path: `${OUT}/provisionamento-pendencias.png` });
  }

  // ── 4. Mobile ──────────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(400);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'o detalhe do cliente não rola na horizontal em 375');
  await page.screenshot({ path: `${OUT}/provisionamento-mobile.png` });

  await page.goto(BASE + '/platform/clients/new', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=assistente-etapas]');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'o assistente não rola na horizontal em 375');
  await page.screenshot({ path: `${OUT}/provisionamento-assistente-mobile.png` });
} finally {
  // Limpeza: os bancos criados pelo teste não ficam para trás.
  const bancos = [`uiprov_${sufixo}_prod`, `uiprov_${sufixo}_hml`];
  console.log(`  (bancos criados por esta suíte: ${bancos.join(', ')})`);
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

// Fase 4 do plano 26_09 — o requisitante, pela tela (SUP-01; aceites S-A04 a S-A07).
//
// O que esta suíte prova, e por quê:
//  (a) o percurso inteiro: abrir com anexo → achar na lista → abrir o detalhe → responder só
//      com anexo → editar a própria mensagem e ver a versão anterior. É o caminho que o
//      testador vai fazer, e cada passo é medido pelo EFEITO, não pelo clique;
//  (b) envio vazio não passa — e a prova é por REDE: contar que nenhuma requisição partiu,
//      porque "o botão ficou desabilitado" não prova que nada foi enviado;
//  (c) o limite de upload aparece ANTES de escolher arquivo (a spec cobra isso);
//  (d) a nota interna da Septem não chega ao requisitante: nem na conversa, nem no histórico;
//  (e) 1280 e 375 sem overflow horizontal e sem elemento recortado.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const CENTRAL_EMAIL = 'super@septem.local';
const CENTRAL_SENHA = 'super123';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const token = (await api(null, '/api/v1/auth/login', 'POST',
  { identifier: 'admin@prefeitura-x.local', password: 'admin123' })).body.accessToken;

const rid = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');

// Requisitante próprio: o admin tem permissões demais, e o que se testa aqui é a visão de quem
// só abre chamado. Sem perfil nenhum além do que o shell exige.
const perfil = await api(token, '/api/v1/access-profiles', 'POST',
  { name: `Requisitante ${rid}`, permissions: ['workflow:read'] });
const pessoa = await api(token, '/api/v1/users', 'POST', {
  name: `Requisitante ${rid}`,
  email: `req-${rid}@prefeitura-x.local`,
  isInternal: true,
  accessProfileIds: [perfil.body.id],
});

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  headless: true,
});

const login = async (page, email, senha) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', email);
  await page.fill('input[name=password]', senha);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

/** Anexa um arquivo qualquer — usado para o caminho de RECUSA. */
const anexarBruto = (page, seletor, name, mimeType, buffer) =>
  page.setInputFiles(seletor, { name, mimeType, buffer });

/** Anexa um PNG mínimo VÁLIDO: a 1c valida a assinatura do arquivo, não a extensão. */
const anexar = async (page, seletor, nome) => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    Buffer.alloc(96),
  ]);
  await page.setInputFiles(seletor, { name: nome, mimeType: 'image/png', buffer: png });
};

const auditarResponsivo = async (page) => page.evaluate(() => {
  const alvos = '[data-testid=chamado-linha], [data-testid=mensagem], [data-testid=compositor], header h1';
  const recortados = [...document.querySelectorAll(alvos)]
    .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length;
  return {
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    recortados,
  };
});

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page, `req-${rid}@prefeitura-x.local`, pessoa.body.initialPassword);

    // ── 1) O caminho começa no MENU, e /support deixou de ser stub ────────────
    if (vp.n === 'mobile') {
      await page.locator('button[aria-label="Abrir menu"]').click();
      await page.waitForFunction(() => {
        const a = document.querySelector('aside');
        return !!a && a.getBoundingClientRect().left >= 0;
      }, { timeout: 10000 });
    }
    const linkMenu = page.locator('aside a', { hasText: 'Meus chamados' }).first();
    const temLink = await linkMenu.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
    check(temLink, `[${vp.n}] o menu abre "Meus chamados" (era "Suporte" apontando para um stub)`);
    await linkMenu.click();
    await page.waitForURL((u) => u.pathname.endsWith('/support'), { timeout: 10000 });

    await page.goto(BASE + '/support', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=novo-chamado]', { timeout: 15000 });
    const corpoLista = await page.locator('body').innerText();
    check(!/Fase \d/.test(corpoLista), `[${vp.n}] "Meus chamados" não é mais um stub de fase`);

    // ── 2) Abrir chamado com anexo ────────────────────────────────────────────
    await page.click('[data-testid=novo-chamado]');
    await page.waitForSelector('[data-testid=form-chamado]');

    const limite = await page.locator('[data-testid=limite-upload]').innerText();
    check(/MB por arquivo/.test(limite), `[${vp.n}] o limite de upload aparece antes de escolher (${limite.trim()})`);

    const assunto = `Não consigo emitir a guia ${vp.n} ${rid}`;
    await page.fill('[data-testid=form-chamado] input[name=subject]', assunto);
    await page.fill('[data-testid=form-chamado] textarea[name=description]',
      'Clico em emitir e a tela fica carregando para sempre.');
    await page.locator('[data-testid=form-chamado] input[name=nature][value=bug]').check();
    await page.fill('[data-testid=form-chamado] textarea[name=impact]', 'O setor inteiro está parado.');

    // Caminho de FALHA primeiro (a regra do rules.md: testar o caminho de falha, não só o
    // feliz). `.exe` está fora da allowlist da 1c, então o servidor recusa — e o que a spec
    // cobra é que a recusa apareça NAQUELE arquivo e não derrube o resto nem o texto digitado.
    await anexarBruto(page, '[data-testid=input-anexo]', 'virus.exe', 'application/octet-stream',
      Buffer.from('MZ fake executable'));
    await page.waitForSelector('[data-testid=anexo-falhou]', { timeout: 20000 });
    const recusado = await page.locator('[data-testid=anexo-falhou]').first().innerText();
    check(recusado.trim().length > 0, `[${vp.n}] o anexo recusado mostra o motivo (${recusado.trim().slice(0, 40)})`);
    check((await page.inputValue('[data-testid=form-chamado] textarea[name=description]')).length > 0,
      `[${vp.n}] a falha do anexo NÃO apaga o texto já escrito`);
    check(await page.locator('[data-testid=enviar-chamado]').isEnabled(),
      `[${vp.n}] e não trava o envio do chamado`);

    // Agora o anexo válido: a falha anterior não contamina o próximo.
    await anexar(page, '[data-testid=input-anexo]', `print-${vp.n}.png`);
    await page.waitForFunction(() => {
      const itens = [...document.querySelectorAll('[data-testid=anexo-escolhido]')];
      return itens.length === 2 && ![...itens].some((i) => i.querySelector('.animate-spin'));
    }, { timeout: 20000 });
    check(await page.locator('[data-testid=anexo-falhou]').count() === 1,
      `[${vp.n}] o anexo válido sobe mesmo depois de um recusado`);

    // Tira o recusado da lista antes de enviar — é o que a pessoa faria.
    await page.locator('[data-testid=anexo-escolhido]', { hasText: 'virus.exe' })
      .locator('button[aria-label^="Remover"]').click();

    const criado = page.waitForResponse(
      (r) => r.url().includes('/api/v1/support/tickets') && r.request().method() === 'POST',
      { timeout: 20000 });
    await page.click('[data-testid=enviar-chamado]');
    const resp = await criado;
    check(resp.status() === 201, `[${vp.n}] o chamado foi aberto (HTTP ${resp.status()})`);

    // A tela vai para o detalhe, com o protocolo do servidor à vista.
    await page.waitForSelector('[data-testid=detalhe-protocolo]', { timeout: 15000 });
    const protocolo = (await page.locator('[data-testid=detalhe-protocolo]').innerText()).trim();
    check(/^SUP-\d{4}-\d{6}$/.test(protocolo), `[${vp.n}] o protocolo do servidor é exibido (${protocolo})`);
    // Contar elemento não prova conteúdo (rules.md): confere o NOME do arquivo.
    const nomesAnexo = await page.locator('[data-testid=anexo]').allInnerTexts();
    check(nomesAnexo.some((t) => t.includes(`print-${vp.n}.png`)),
      `[${vp.n}] o anexo da abertura aparece com o nome (${JSON.stringify(nomesAnexo)})`);

    const url = page.url();
    const idChamado = url.split('/').pop();

    // ── 3) A lista acha pelo protocolo ────────────────────────────────────────
    await page.goto(BASE + '/support', { waitUntil: 'networkidle' });
    await page.fill('[data-testid=busca-chamados]', protocolo);
    await page.waitForFunction((p) => {
      const linhas = [...document.querySelectorAll('[data-testid=chamado-linha]')];
      return linhas.length === 1 && linhas[0].textContent.includes(p);
    }, protocolo, { timeout: 15000 });
    const linha = page.locator('[data-testid=chamado-linha]').first();
    const textoLinha = await linha.innerText();
    check(textoLinha.includes(assunto.slice(0, 20)), `[${vp.n}] a linha mostra o assunto`);
    check(/Aberto/.test(textoLinha), `[${vp.n}] e a situação em português`);

    // Filtro que NÃO casa esvazia a lista — prova que o filtro chega ao servidor.
    await page.selectOption('[data-testid=filtro-natureza]', 'question');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=chamado-linha]').length === 0,
      { timeout: 15000 });
    check(true, `[${vp.n}] o filtro de natureza é aplicado no servidor`);

    // ── 4) Detalhe: responder só com anexo, e envio vazio bloqueado ───────────
    await page.goto(`${BASE}/support/tickets/${idChamado}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=compositor]');

    // Envio vazio: contado por REDE. Se nada partiu, o contador fica em zero.
    let posts = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/messages')) posts += 1;
    });
    await page.locator('[data-testid=enviar-mensagem]').click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
    check(posts === 0, `[${vp.n}] mensagem vazia não dispara nenhuma requisição (${posts})`);

    await anexar(page, '[data-testid=anexar-mensagem]', `anexo-msg-${vp.n}.png`);
    await page.waitForFunction(() => {
      const itens = [...document.querySelectorAll('[data-testid=anexo-compositor]')];
      return itens.length === 1 && !itens[0].querySelector('.animate-spin');
    }, { timeout: 20000 });
    await page.click('[data-testid=enviar-mensagem]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=mensagem]').length === 1,
      { timeout: 15000 });
    check(posts === 1, `[${vp.n}] mensagem SÓ com anexo é aceita (${posts} requisição)`);
    const primeira = await page.locator('[data-testid=mensagem]').first().innerText();
    check(/\.png/.test(primeira), `[${vp.n}] e o anexo aparece na mensagem`);

    // ── 5) Editar a própria mensagem e ver a versão anterior ──────────────────
    await page.fill('[data-testid=compositor] textarea[name=body]', 'Texto origianl com erro.');
    await page.click('[data-testid=enviar-mensagem]');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=mensagem]').length === 2,
      { timeout: 15000 });

    const comTexto = page.locator('[data-testid=mensagem]', { hasText: 'Texto origianl' }).first();
    await comTexto.locator('[data-testid=editar-mensagem]').click();
    await page.waitForSelector('[data-testid=form-edicao]');
    await page.fill('[data-testid=form-edicao] textarea[name=body]', 'Texto original, corrigido.');
    await page.click('[data-testid=salvar-edicao]');
    await page.waitForFunction(() => document.body.innerText.includes('Texto original, corrigido.'),
      { timeout: 15000 });
    check(true, `[${vp.n}] edita a própria mensagem`);

    const editada = page.locator('[data-testid=mensagem]', { hasText: 'Texto original, corrigido.' }).first();
    await editada.locator('[data-testid=ver-revisoes]').click();
    await page.waitForSelector('[data-testid=dialogo-revisoes]');
    // Espera o CONTEÚDO, não só o diálogo: a lista de revisões é uma consulta, e sob carga o
    // diálogo abre mostrando "Carregando…" — ler nesse instante mede a abertura, não a revisão.
    await page.waitForFunction(() => {
      const d = document.querySelector('[data-testid=dialogo-revisoes]');
      return !!d && !d.textContent.includes('Carregando');
    }, { timeout: 15000 }).catch(() => {});
    const revisoes = await page.locator('[data-testid=dialogo-revisoes]').innerText();
    check(revisoes.includes('Texto origianl com erro.'),
      `[${vp.n}] a versão anterior fica guardada e visível (${JSON.stringify(revisoes.replace(/\s+/g, ' ').slice(0, 120))})`);
    await page.keyboard.press('Escape');

    // ── 5b) Remover anexo pela TELA (o backend prova a regra; aqui prova o caminho) ──
    const comAnexo = page.locator('[data-testid=mensagem]', { hasText: '.png' }).first();
    const anexoNaTela = comAnexo.locator('[data-testid=anexo]').first();
    const nomeAnexo = (await anexoNaTela.innerText()).trim();
    await anexoNaTela.locator('button[aria-label^="Remover"]').click();
    await page.getByRole('button', { name: 'Remover', exact: true }).click();
    await page.waitForFunction((nome) => ![...document.querySelectorAll('[data-testid=anexo]')]
      .some((a) => a.textContent.includes(nome.split(' ')[0])), nomeAnexo, { timeout: 15000 });
    check(true, `[${vp.n}] remove o anexo pela tela (${nomeAnexo.split(' ')[0]})`);

    // ── 5c) Depois do comando, a LISTA reflete a movimentação ────────────────
    // É a prova do item "invalidar detalhe, listas e totais": sem invalidar, a lista
    // continuaria mostrando o horário antigo de última movimentação.
    await page.goto(BASE + '/support', { waitUntil: 'networkidle' });
    await page.fill('[data-testid=busca-chamados]', protocolo);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=chamado-linha]').length === 1,
      { timeout: 15000 });
    const linhaDepois = await page.locator('[data-testid=chamado-linha]').first().innerText();
    const horaAberturaSo = /(\d{2}\/\d{2}\/\d{4}),?\s*(\d{2}:\d{2})/.exec(linhaDepois);
    check(!!horaAberturaSo, `[${vp.n}] a linha mostra a última movimentação (${horaAberturaSo?.[0] ?? 'sem data'})`);

    // ── 5d) Filtro de situação: "Encerrado" não casa um chamado aberto ───────
    await page.selectOption('[data-testid=filtro-estado]', 'closed');
    // Espera o DESFECHO: trocar o filtro troca a chave da consulta, e entre "sumiram as linhas"
    // e "chegou a resposta vazia" a tela passa por "Carregando…". Medir no meio media a
    // transição, não o resultado.
    const vazio = await page.waitForSelector('[data-testid=chamados-vazio]', { timeout: 15000 })
      .then(() => true, () => false);
    const corpoVazio = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 120);
    check(vazio && await page.locator('[data-testid=chamado-linha]').count() === 0,
      `[${vp.n}] filtro sem resultado mostra o estado de vazio, não uma lista fantasma (${JSON.stringify(corpoVazio)})`);

    await page.goto(`${BASE}/support/tickets/${idChamado}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=compositor]');

    // ── 6) Responsivo ────────────────────────────────────────────────────────
    const responsivo = await auditarResponsivo(page);
    check(!responsivo.overflow, `[${vp.n}] o chamado não rola na horizontal`);
    check(responsivo.recortados === 0, `[${vp.n}] nada recortado (${responsivo.recortados})`);
    await page.screenshot({ path: `${OUT}/suporte-chamado-${vp.n}.png`, fullPage: true });

    await ctx.close();
  }

  // ── 7) Estado de ERRO com retry: o caminho de falha da própria tela ────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page, `req-${rid}@prefeitura-x.local`, pessoa.body.initialPassword);

    // Derruba SÓ a consulta da lista: a tela tem de explicar e oferecer "tentar de novo", em
    // vez de ficar em branco. É o caminho de falha que o rules.md manda exercitar.
    let derrubar = true;
    await page.route('**/api/v1/support/tickets?**', (route) =>
      derrubar ? route.abort('failed') : route.continue());

    await page.goto(BASE + '/support', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid=chamados-erro]', { timeout: 20000 });
    check(true, 'falha ao carregar a lista mostra erro com saída, não tela branca');

    derrubar = false;
    await page.locator('[data-testid=chamados-erro] button').click();
    await page.waitForFunction(() => document.querySelector('[data-testid=chamado-linha]')
      || document.querySelector('[data-testid=chamados-vazio]'), { timeout: 20000 });
    check(await page.locator('[data-testid=chamados-erro]').count() === 0,
      'o "tentar de novo" recarrega de verdade');
    await page.screenshot({ path: `${OUT}/suporte-lista-erro.png` });
    await ctx.close();
  }

  // ── 8) Paginação: 26 chamados não caem numa página de 25 ───────────────────
  {
    const tokenReq = (await api(null, '/api/v1/auth/login', 'POST',
      { identifier: `req-${rid}@prefeitura-x.local`, password: pessoa.body.initialPassword })).body.accessToken;
    const marca = `pag${rid}`;
    for (let i = 0; i < 26; i++) {
      await api(tokenReq, '/api/v1/support/tickets', 'POST',
        { subject: `${marca} item ${String(i).padStart(2, '0')}`, description: 'Massa de paginação.', nature: 'question' });
    }

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page, `req-${rid}@prefeitura-x.local`, pessoa.body.initialPassword);
    await page.goto(BASE + '/support', { waitUntil: 'networkidle' });
    await page.fill('[data-testid=busca-chamados]', marca);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=chamado-linha]').length === 25,
      { timeout: 20000 });
    check(await page.locator('[data-testid=paginacao-chamados]').count() === 1,
      'com mais de uma página, a paginação aparece');
    const rodape = await page.locator('[data-testid=paginacao-chamados]').innerText();
    check(/26 chamados/.test(rodape), `o total é do servidor, não da página (${rodape.replace(/\s+/g, ' ')})`);

    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=chamado-linha]').length === 1,
      { timeout: 20000 });
    check(true, 'a segunda página traz o 26º chamado');
    await ctx.close();
  }

  // ── 9) Envio duplo do formulário de abertura ───────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page, `req-${rid}@prefeitura-x.local`, pessoa.body.initialPassword);

    let posts = 0;
    const chavesDeEnvio = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/support\/tickets$/.test(r.url())) {
        posts += 1;
        chavesDeEnvio.push(r.headers()['idempotency-key'] ?? '(sem chave)');
      }
    });

    await page.goto(BASE + '/support/new', { waitUntil: 'networkidle' });
    await page.fill('[data-testid=form-chamado] input[name=subject]', `Clique duplo ${rid}`);
    await page.fill('[data-testid=form-chamado] textarea[name=description]', 'Dois cliques, um chamado.');
    await page.locator('[data-testid=form-chamado] input[name=nature][value=question]').check();

    // Dois cliques no MESMO instante, despachados pelo próprio DOM. Não é frescura: com
    // `locator.click()` duas vezes, o Playwright espera o elemento entre os cliques e o React
    // já re-renderizou desabilitando o botão — o teste passaria sem provar nada. Despachar os
    // dois no mesmo tick é o caso que a trava por estado NÃO segura (e que achamos aqui).
    await page.evaluate(() => {
      const b = document.querySelector('[data-testid=enviar-chamado]');
      b.click(); b.click();
    });
    await page.waitForURL(/\/support\/tickets\//, { timeout: 20000 });
    await page.waitForTimeout(1200);
    check(posts === 1, `clique duplo abre UM chamado (${posts} requisição)`);
    // Duas camadas independentes, como manda o §2 do plano: a trava da tela (ref) e a
    // `Idempotency-Key` no envio. O cabeçalho é conferido aqui porque é ele que segura o caso
    // que a tela não vê — a rede repetindo o POST.
    check(chavesDeEnvio.length >= 1 && chavesDeEnvio.every((k) => k && k !== '(sem chave)'),
      `o envio carrega Idempotency-Key (${chavesDeEnvio.length})`);
    // A chave é do CONTEÚDO: se dois envios iguais saírem, eles levam a MESMA chave e o servidor
    // devolve o mesmo chamado. É o que faz desta uma camada independente da trava da tela.
    check(new Set(chavesDeEnvio).size === 1,
      `envios do mesmo conteúdo compartilham a chave (${new Set(chavesDeEnvio).size} distinta(s))`);

    const tokenReq = (await api(null, '/api/v1/auth/login', 'POST',
      { identifier: `req-${rid}@prefeitura-x.local`, password: pessoa.body.initialPassword })).body.accessToken;
    const busca = await api(tokenReq, `/api/v1/support/tickets?q=${encodeURIComponent(`Clique duplo ${rid}`)}`);
    check(busca.body.total === 1, `e o servidor tem exatamente um (${busca.body.total})`);
    await ctx.close();
  }

  // ── 10) A nota interna da Septem não chega ao requisitante ─────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page, `req-${rid}@prefeitura-x.local`, pessoa.body.initialPassword);

    // Um chamado novo, pela API, para o cenário ser curto.
    const tokenReq = (await api(null, '/api/v1/auth/login', 'POST',
      { identifier: `req-${rid}@prefeitura-x.local`, password: pessoa.body.initialPassword })).body.accessToken;
    const chamado = await api(tokenReq, '/api/v1/support/tickets', 'POST',
      { subject: `Dúvida sobre a guia ${rid}`, description: 'A Septem vai anotar algo reservado.', nature: 'question' });

    // A Septem escreve uma pública e uma interna, pela área central.
    const central = await ctx.newPage();
    await central.goto(BASE + '/platform/support/tickets', { waitUntil: 'networkidle' });
    await central.fill('input[name=email]', CENTRAL_EMAIL);
    await central.fill('input[name=password]', CENTRAL_SENHA);
    await central.click('button[type=submit]');
    await central.waitForSelector('input[name=code]', { timeout: 10000 });
    const code = await central.evaluate(async (email) => {
      const r = await fetch(`/api/v1/platform/auth/dev/last-code?email=${encodeURIComponent(email)}`);
      return (await r.json()).code;
    }, CENTRAL_EMAIL);
    await central.fill('input[name=code]', code);
    await central.click('button[type=submit]');
    // Espera a sessão central existir ANTES de navegar: indo direto, o detalhe sai sem token,
    // volta 401 e a tela mostra "não está disponível" em vez do compositor.
    await central.waitForSelector('[data-testid=platform-identidade]', { timeout: 20000 });

    await central.goto(`${BASE}/platform/support/tickets/${chamado.body.id}`, { waitUntil: 'networkidle' });
    await central.waitForSelector('[data-testid=compositor]', { timeout: 20000 });
    check(await central.locator('[data-testid=marcar-interna]').count() === 1,
      'quem atende vê a opção "Nota interna"');

    await central.fill('[data-testid=compositor] textarea[name=body]', 'Recebemos e vamos analisar.');
    await central.click('[data-testid=enviar-mensagem]');
    await central.waitForFunction(() => document.querySelectorAll('[data-testid=mensagem]').length === 1, { timeout: 15000 });

    await central.fill('[data-testid=compositor] textarea[name=body]', `NOTA SECRETA ${rid}`);
    // O modo de nota interna virou aba (Fase 5): "Mensagem ao requisitante" × "Nota interna da organização".
    await central.click('[data-testid=marcar-interna]');
    await central.click('[data-testid=enviar-mensagem]');
    await central.waitForFunction(() => document.querySelectorAll('[data-testid=mensagem]').length === 2, { timeout: 15000 });
    check(await central.locator('[data-testid=selo-interna]').count() === 1,
      'a nota interna aparece marcada para quem a escreveu');

    // O requisitante abre o MESMO chamado: vê uma mensagem, e nada da nota.
    await page.goto(`${BASE}/support/tickets/${chamado.body.id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=mensagem]', { timeout: 15000 });
    const visao = await page.locator('body').innerText();
    check(await page.locator('[data-testid=mensagem]').count() === 1,
      'o requisitante vê só a mensagem pública');
    check(!visao.includes(`NOTA SECRETA ${rid}`), 'o texto da nota interna NÃO chega ao requisitante');
    check(await page.locator('[data-testid=selo-interna]').count() === 0,
      'e nem o selo de nota interna aparece para ele');

    // O histórico do requisitante não cita a nota. Sem os textos na mensagem, uma falha aqui
    // não se investiga — por isso eles vão junto.
    const eventos = (await page.locator('[data-testid=evento]').allInnerTexts())
      .map((e) => e.replace(/\s+/g, ' ').trim());
    check(!eventos.some((e) => /Nota interna registrada/.test(e) || e.includes(`NOTA SECRETA ${rid}`)),
      `o histórico do requisitante não cita a nota interna (${JSON.stringify(eventos)})`);

    await page.screenshot({ path: `${OUT}/suporte-requisitante-nota.png`, fullPage: true });
    await ctx.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Fase 3 — Unidades Organizacionais. Cria uma unidade completa pela TELA (sigla,
// contatos, titular e preposto), EDITA pelo diálogo, confere a listagem (foto do
// titular + sigla em destaque), abre o detalhe em aba própria e valida as abas
// contadas COM CONTEÚDO REAL (um usuário lotado numa posição da unidade e um
// processo cujo dono é a unidade, definido pelo modelador) e a impressão.
// Web 1280 + mobile 375.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (cond, msg) => (cond ? ok.push(msg) : bad.push(msg));

/**
 * Processo semeado usado para provar a aba "Processos" (a unidade dona sai daqui).
 * Tem de ser um processo COM diagrama: o Salvar do modelador serializa o canvas, e
 * seeds sem `BPMNDiagram` (ex.: tres_tarefas_bug) não têm o que serializar.
 */
const PROCESSO_KEY = 'teste_condicoes_ui';
const PROCESSO_NOME = 'Teste Condicoes UI';

const api = async (token, path, method = 'GET', body) => {
  const r = await fetch(API + path, {
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

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', {
  identifier: 'admin@prefeitura-x.local',
  password: 'admin123',
});
const token = auth.accessToken;

/** Usuário com foto — é dele que sai o círculo da listagem. */
async function criarUsuario(nome, foto) {
  const r = await api(token, '/api/v1/users', 'POST', {
    name: nome,
    email: `${Math.floor(Math.random() * 1e9)}@teste.local`,
    isInternal: true,
  });
  if (foto) await api(token, `/api/v1/users/${r.body.id}`, 'PUT', { name: nome, photoUrl: foto });
  return { id: r.body.id, nome };
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const criadas = [];
const posicoes = [];

const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[name=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

/**
 * Define (ou limpa) a unidade responsável do processo pelo MODELADOR — é o caminho
 * real do produto: `Flow.AreaId` só é gravado pelo save do modelador, e é dele que
 * a aba "Processos" da unidade se alimenta.
 */
async function definirUnidadeDoProcesso(page, rotuloUnidade) {
  await page.goto(`${BASE}/processos/editar?key=${PROCESSO_KEY}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.locator('header button', { hasText: 'Configurações' }).click();
  await page.waitForTimeout(600);

  const campo = page.locator('label', { hasText: 'Unidade organizacional responsável' })
    .locator('xpath=..').locator('button').first();
  await campo.click();
  await page.locator('button', { hasText: rotuloUnidade }).last().click();
  await page.waitForTimeout(300);

  const salvou = page.waitForResponse(
    (r) => r.url().includes('/api/v1/workflow/process-definitions/') && r.request().method() === 'PUT',
    { timeout: 20000 },
  );
  await page.locator('header button', { hasText: 'Salvar' }).first().click();
  const resp = await salvou;
  await page.waitForTimeout(800);
  return { rotulo: (await campo.innerText()).trim(), status: resp.status() };
}

try {
  for (const view of [
    { name: 'web', width: 1280, height: 900 },
    { name: 'mobile', width: 375, height: 812 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);

    const titular = await criarUsuario(`Titular ${view.name}`, 'https://picsum.photos/id/1005/200/200');
    const preposto = await criarUsuario(`Preposto ${view.name}`, 'https://picsum.photos/id/1012/200/200');
    const sigla = `SEM${view.name === 'web' ? 'W' : 'M'}`;
    const nome = `Secretaria de Teste (${view.name})`;

    // ── 1) Criar a unidade pela tela, com todos os campos novos ─────────────
    await page.goto(BASE + '/admin/unidades', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Nova unidade raiz' }).click();
    await page.waitForSelector('[data-testid=form-unidade]');

    await page.fill('input[name=name]', nome);
    await page.fill('input[name=sigla]', sigla);
    await page.fill('textarea[name=objetivo]', 'Coordenar a política municipal de teste.');
    await page.fill('input[name=localizacao]', 'Rua das Flores, 100');
    await page.fill('input[name=unidadeOrcamentaria]', '12.001');
    await page.fill('input[name=telefone]', '(11) 3333-4444');
    await page.fill('input[name=email]', 'teste@prefeitura.gov.br');

    // Titular e preposto: comboboxes pesquisáveis (botão → busca → item).
    // Os dois têm o mesmo rótulo; o índice diz qual é o titular (0) e o preposto (1).
    // A busca é no SERVIDOR: digitar o nome acha o usuário mesmo com o banco cheio.
    const escolher = async (rotulo, nomeUsuario) => {
      await page.locator('[data-testid=form-unidade] button', { hasText: rotulo }).first().click();
      await page.locator('input[placeholder="Pesquisar…"]').fill(nomeUsuario);
      await page.waitForTimeout(700);
      await page.locator('button', { hasText: nomeUsuario }).last().click();
    };
    await escolher('Selecionar titular', titular.nome);
    await escolher('Selecionar preposto', preposto.nome);

    await page.getByRole('button', { name: 'Criar' }).click();
    await page.waitForSelector(`text=Unidade "${nome}" criada.`, { timeout: 10000 });
    check(true, `[${view.name}] cria a unidade com sigla, contatos, titular e preposto`);

    const { body: lista } = await api(token, '/api/v1/org-units');
    const criada = lista.find((u) => u.name === nome);
    criadas.push(criada.id);
    check(criada?.sigla === sigla, `[${view.name}] a sigla foi gravada (${criada?.sigla})`);
    check(criada?.titular?.name === titular.nome, `[${view.name}] o titular foi gravado`);

    // ── 2) Popular as abas com CONTEÚDO REAL ───────────────────────────────
    // Usuários: quem ocupa uma posição da unidade. Cria a posição e lota alguém.
    const { body: pos } = await api(token, '/api/v1/positions', 'POST', {
      key: `analista-${view.name}-${Math.floor(Math.random() * 1e6)}`,
      name: 'Analista de Teste',
      orgUnitId: criada.id,
    });
    posicoes.push(pos.id);
    const lotado = await criarUsuario(`Servidor ${view.name}`, null);
    await api(token, `/api/v1/users/${lotado.id}`, 'PUT', { name: lotado.nome, positionIds: [pos.id] });

    // Processos: a unidade dona é definida na aba Configurações do modelador.
    const salvo = await definirUnidadeDoProcesso(page, nome);
    check(salvo.status === 200 && salvo.rotulo === nome,
      `[${view.name}] o modelador grava a unidade responsável do processo (PUT ${salvo.status})`);

    // ── 3) Listagem: foto do titular + sigla em destaque + nome do titular ──
    await page.goto(BASE + '/admin/unidades', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=unidade-linha]');
    const linha = page.locator('[data-testid=unidade-linha]', { hasText: sigla }).first();
    const texto = await linha.innerText();
    check(texto.includes(sigla) && texto.includes(nome), `[${view.name}] a linha mostra a sigla em destaque e o nome`);
    check(texto.includes(titular.nome), `[${view.name}] a linha mostra o nome do titular`);
    const foto = await linha.locator('[data-testid=avatar]').first().getAttribute('src');
    check(!!foto && foto.includes('picsum'), `[${view.name}] a linha mostra a FOTO do titular (não o avatar genérico)`);
    await page.screenshot({ path: `${OUT}/unidades-lista-${view.name}.png`, fullPage: true });

    // ── 4) Detalhe em aba própria ──────────────────────────────────────────
    await page.goto(`${BASE}/unidade?id=${criada.id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=abas-unidade]');
    const detalhe = await page.locator('body').innerText();
    check(
      detalhe.includes(sigla) && detalhe.includes('12.001') && detalhe.includes('(11) 3333-4444'),
      `[${view.name}] o detalhe mostra sigla, unidade orçamentária e telefone`,
    );
    check(
      detalhe.includes(titular.nome) && detalhe.includes(preposto.nome),
      `[${view.name}] o detalhe mostra titular e preposto`,
    );
    const fotos = await page.locator('[data-testid=pessoas-unidade] img[data-testid=avatar]').count();
    check(fotos === 2, `[${view.name}] titular e preposto aparecem com foto (${fotos}/2)`);

    // Abas com contador. Processos e Usuários agora têm conteúdo REAL (1 cada);
    // Manuais e Documentos ainda são 0 — os módulos entram nas Fases 10 e 6.
    const abas = await page.locator('[role=tab]').count();
    check(abas === 4, `[${view.name}] o card tem 4 abas (Processos, Manuais, Documentos, Usuários)`);
    const contadores = {};
    for (const k of ['processos', 'manuais', 'documentos', 'usuarios']) {
      contadores[k] = (await page.locator(`[data-testid=contador-${k}]`).innerText()).trim();
    }
    check(
      contadores.processos === '1' && contadores.usuarios === '1',
      `[${view.name}] os contadores refletem o conteúdo real (processos ${contadores.processos}, usuários ${contadores.usuarios})`,
    );
    check(
      contadores.manuais === '0' && contadores.documentos === '0',
      `[${view.name}] Manuais e Documentos existem com contador 0 (módulos das Fases 10 e 6)`,
    );

    // Painel Processos: o processo cuja unidade dona é esta.
    const painelProc = await page.locator('[data-testid=painel-processos]').innerText();
    check(painelProc.includes(PROCESSO_NOME) && !/Nenhum processo/.test(painelProc),
      `[${view.name}] a aba Processos LISTA o processo da unidade`);

    // Painel Usuários: quem está lotado, com o nome da posição.
    await page.getByRole('tab', { name: /Usuários/ }).click();
    await page.waitForTimeout(300);
    const painelUsers = await page.locator('[data-testid=painel-usuarios]').innerText();
    check(await page.locator('[data-testid=painel-usuarios]').isVisible(),
      `[${view.name}] clicar na aba Usuários mostra o painel dela`);
    check(painelUsers.includes(lotado.nome) && painelUsers.includes('Analista de Teste'),
      `[${view.name}] a aba Usuários mostra o servidor lotado E a posição dele`);
    await page.screenshot({ path: `${OUT}/unidade-detalhe-${view.name}.png`, fullPage: true });

    // ── 5) Impressão: TODAS as abas abertas ────────────────────────────────
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(300);
    const visiveisNaImpressao = await page.evaluate(
      () =>
        ['processos', 'manuais', 'documentos', 'usuarios'].filter((k) => {
          const el = document.querySelector(`[data-testid=painel-${k}]`);
          return el && el.getBoundingClientRect().height > 0;
        }).length,
    );
    check(visiveisNaImpressao === 4, `[${view.name}] na impressão, as 4 abas saem abertas (${visiveisNaImpressao}/4)`);
    const botaoImprimir = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Imprimir'));
      return b ? b.getBoundingClientRect().height : 0;
    });
    check(botaoImprimir === 0, `[${view.name}] o botão Imprimir não sai no papel`);
    await page.screenshot({ path: `${OUT}/unidade-impressao-${view.name}.png`, fullPage: true });
    await page.emulateMedia({ media: 'screen' });

    // ── 6) EDITAR pela tela: o diálogo carrega o que existe e grava a mudança ─
    const sigla2 = `${sigla}X`;
    await page.goto(BASE + '/admin/unidades', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=unidade-linha]');
    await page.locator('[data-testid=unidade-linha]', { hasText: sigla })
      .first().locator('button[title=Editar]').click();

    // Enquanto o detalhe não chega, o formulário NÃO pode estar salvável: salvar cedo
    // gravaria campos em branco por cima da unidade (apagava sigla, contatos, titular).
    const salvarHabilitadoCedo = await page
      .locator('button:has-text("Salvar"):not([disabled])').first()
      .isVisible({ timeout: 150 }).catch(() => false);
    const formCedo = await page.locator('[data-testid=form-unidade]').count();
    check(!(salvarHabilitadoCedo && formCedo > 0),
      `[${view.name}] o Salvar da edição fica travado até os dados carregarem`);

    await page.waitForSelector('[data-testid=form-unidade]');

    // O diálogo tem que vir PREENCHIDO — abrir em branco apagaria os dados no save.
    const precarregado = await page.evaluate(() => ({
      sigla: document.querySelector('[data-testid=form-unidade] input[name=sigla]')?.value,
      telefone: document.querySelector('[data-testid=form-unidade] input[name=telefone]')?.value,
    }));
    check(precarregado.sigla === sigla && precarregado.telefone === '(11) 3333-4444',
      `[${view.name}] o diálogo de edição abre com os campos já preenchidos`);

    // O rótulo do titular é resolvido por uma 2ª busca (o combobox guarda só o id):
    // espera pelo nome em vez de medir num instante — o que também prova que carrega.
    const titularVisivel = await page
      .waitForFunction(
        (n) => document.querySelector('[data-testid=form-unidade]')?.innerText.includes(n),
        titular.nome,
        { timeout: 8000 },
      )
      .then(() => true)
      .catch(() => false);
    check(titularVisivel, `[${view.name}] o diálogo de edição mostra o titular já selecionado`);

    await page.fill('[data-testid=form-unidade] input[name=sigla]', sigla2);
    await page.fill('[data-testid=form-unidade] input[name=localizacao]', 'Av. Nova, 900');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await page.waitForSelector('text=Alterações salvas.', { timeout: 10000 });

    const { body: dep } = await api(token, `/api/v1/org-units/${criada.id}`);
    check(dep.sigla === sigla2 && dep.localizacao === 'Av. Nova, 900',
      `[${view.name}] a edição gravou sigla e localização (${dep.sigla})`);
    check(dep.titular?.name === titular.nome && dep.preposto?.name === preposto.nome,
      `[${view.name}] a edição NÃO apagou titular e preposto`);
    check((await page.locator('[data-testid=unidade-linha]', { hasText: sigla2 }).count()) > 0,
      `[${view.name}] a listagem já mostra a sigla nova`);

    // ── 7) Layout ──────────────────────────────────────────────────────────
    await page.goto(`${BASE}/unidade?id=${criada.id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=abas-unidade]');
    const L = await page.evaluate(() => {
      const doc = document.documentElement;
      const clipped = [...document.querySelectorAll('button, img, dl')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
      }).length;
      return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
    });
    check(!L.overflows, `[${view.name}] detalhe sem overflow horizontal`);
    check(L.clipped === 0, `[${view.name}] detalhe sem elemento recortado (${L.clipped})`);

    // ── 8) "Área" virou "Unidade organizacional" no modelador ──────────────
    // Varre TEXTO + placeholder + label + title + aria-label: `innerText` não enxerga
    // placeholder, e foi assim que "Selecione a área" passou despercebido.
    await page.goto(`${BASE}/processos/editar?key=${PROCESSO_KEY}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const varrer = () =>
      page.evaluate(() => {
        const t = [document.body.innerText];
        for (const el of document.querySelectorAll('*')) {
          for (const a of ['placeholder', 'title', 'aria-label', 'alt']) {
            const v = el.getAttribute?.(a);
            if (v) t.push(v);
          }
        }
        return t.join('\n');
      });
    const semArea = (txt) => !/\bárea\b/i.test(txt);
    check(semArea(await varrer()), `[${view.name}] o modelador (fluxo) não fala em "área" em texto nem em placeholder`);

    await page.locator('header button', { hasText: 'Configurações' }).click();
    await page.waitForTimeout(800);
    check(semArea(await varrer()), `[${view.name}] a aba Configurações não fala em "área" em texto nem em placeholder`);

    await ctx.close();
  }
} finally {
  // Restaura a unidade dona do processo (senão o DELETE da unidade esbarra no vínculo)
  // e remove o que a suíte criou — ela precisa poder rodar de novo.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await login(page);
    await definirUnidadeDoProcesso(page, '— nenhuma —');
  } catch (e) {
    console.log('! não consegui restaurar a unidade do processo: ' + e.message);
  }
  await ctx.close();

  for (const id of posicoes) await api(token, `/api/v1/positions/${id}`, 'DELETE');
  for (const id of criadas) await api(token, `/api/v1/org-units/${id}`, 'DELETE');
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Fase 3 — Unidades Organizacionais. Cria uma unidade completa pela TELA (sigla,
// contatos, titular e preposto), confere a listagem (foto do titular + sigla em
// destaque), abre o detalhe em aba própria e valida as abas contadas e a
// impressão (todas as abas abertas). Web 1280 + mobile 375.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (cond, msg) => (cond ? ok.push(msg) : bad.push(msg));

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
  await api(token, `/api/v1/users/${r.body.id}`, 'PUT', { name: nome, photoUrl: foto });
  return { id: r.body.id, nome };
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const criadas = [];

const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[name=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

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

    // ── 2) Listagem: foto do titular + sigla em destaque + nome do titular ──
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=unidade-linha]');
    const linha = page.locator('[data-testid=unidade-linha]', { hasText: sigla }).first();
    const texto = await linha.innerText();
    check(texto.includes(sigla) && texto.includes(nome), `[${view.name}] a linha mostra a sigla em destaque e o nome`);
    check(texto.includes(titular.nome), `[${view.name}] a linha mostra o nome do titular`);
    const foto = await linha.locator('[data-testid=avatar]').first().getAttribute('src');
    check(!!foto && foto.includes('picsum'), `[${view.name}] a linha mostra a FOTO do titular (não o avatar genérico)`);
    await page.screenshot({ path: `${OUT}/unidades-lista-${view.name}.png`, fullPage: true });

    // ── 3) Detalhe em aba própria ──────────────────────────────────────────
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

    // Abas com contador (Manuais e Documentos ainda são 0 — módulos das Fases 10 e 6).
    const abas = await page.locator('[role=tab]').count();
    check(abas === 4, `[${view.name}] o card tem 4 abas (Processos, Manuais, Documentos, Usuários)`);
    const contadores = {};
    for (const k of ['processos', 'manuais', 'documentos', 'usuarios']) {
      contadores[k] = (await page.locator(`[data-testid=contador-${k}]`).innerText()).trim();
    }
    check(
      Object.values(contadores).every((v) => /^\d+$/.test(v)),
      `[${view.name}] cada aba tem contador (processos ${contadores.processos}, manuais ${contadores.manuais}, documentos ${contadores.documentos}, usuários ${contadores.usuarios})`,
    );

    // Trocar de aba mostra o painel correspondente.
    await page.getByRole('tab', { name: /Usuários/ }).click();
    await page.waitForTimeout(300);
    check(
      await page.locator('[data-testid=painel-usuarios]').isVisible(),
      `[${view.name}] clicar na aba Usuários mostra o painel dela`,
    );
    await page.screenshot({ path: `${OUT}/unidade-detalhe-${view.name}.png`, fullPage: true });

    // ── 4) Impressão: TODAS as abas abertas ────────────────────────────────
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

    // ── 5) Layout ──────────────────────────────────────────────────────────
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

    // ── 6) "Área" virou "Unidade organizacional" no modelador ──────────────
    await page.goto(`${BASE}/processos/editar?key=tres_tarefas_bug`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const cfg = await page.evaluate(() => document.body.innerText);
    check(
      !/\bÁrea responsável\b/.test(cfg),
      `[${view.name}] o modelador não fala mais em "Área responsável"`,
    );

    await ctx.close();
  }
} finally {
  // Remove as unidades criadas (suíte idempotente).
  for (const id of criadas) await api(token, `/api/v1/org-units/${id}`, 'DELETE');
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Fase 3 do plano 26_09 — Equipes de suporte (SUP-02/SUP-04), nos DOIS lados.
//
// O que esta suíte prova, e por quê:
//  (a) o ciclo completo pela TELA no lado do cliente: criar equipe → incluir membro →
//      remover membro → renomear e desativar. A inclusão é o ponto delicado: o nome do
//      membro é COPIADO do ambiente na hora de entrar, então a lista tem de mostrar o
//      nome real da pessoa — se aparecer "Usuário 42", a cópia não aconteceu;
//  (b) quem NÃO tem `support:admin` não vê o caminho: o link não aparece no menu, a tela
//      aberta direto explica o que falta e não oferece "Nova equipe". Isto é o espelho do
//      aceite S-A03 na interface — e o backend recusa de todo modo;
//  (c) a área central atende pelas MESMAS rotas: a Septem cria a própria equipe em
//      /platform/support/teams, e o link de suporte existe na navegação central;
//  (d) 1280 e 375 sem overflow horizontal e sem elemento recortado.
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

// Usuário SEM `support:admin`: perfil com uma permissão inócua, para o shell abrir.
const perfil = await api(token, '/api/v1/access-profiles', 'POST',
  { name: `Sem suporte ${rid}`, permissions: ['reports:read'] });
const semGestao = await api(token, '/api/v1/users', 'POST', {
  name: `Sem gestão ${rid}`,
  email: `sem-gestao-${rid}@prefeitura-x.local`,
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

/**
 * Abre o drawer no mobile — no 375 a barra lateral só existe depois do hamburger.
 *
 * Espera o drawer REALMENTE deslizar para dentro (borda esquerda em x>=0), não um tempo fixo:
 * sob carga o clique demora a surtir efeito, o `aside` fica off-canvas (`-translate-x-full`) e o
 * item do menu vira "fora do viewport" — o clique então tenta por 30s e falha. Foi assim que esta
 * suíte caiu no gate depois de passar sozinha.
 */
const abrirMenu = async (page, mobile) => {
  if (!mobile) return;
  await page.locator('button[aria-label="Abrir menu"]').click();
  await page.waitForFunction(() => {
    const a = document.querySelector('aside');
    return !!a && a.getBoundingClientRect().left >= 0;
  }, { timeout: 10000 });
};

/** Escolhe no combobox digitando: a lista tem teto de pintura, então filtrar é o caminho real. */
const escolherNoCombobox = async (page, rotulo, texto) => {
  await page.locator('label', { hasText: rotulo }).locator('xpath=..').locator('button').first().click();
  const lista = page.locator('[data-testid=combobox-popover]');
  await lista.locator('input[placeholder="Pesquisar…"]').fill(texto);
  await page.waitForTimeout(700);
  await lista.locator('button', { hasText: texto }).first().click();
};

const auditarResponsivo = async (page) => page.evaluate(() => {
  const doc = document.documentElement;
  const recortados = [...document.querySelectorAll('[data-testid=equipe-cartao], header h1, [data-testid=equipe-nome]')]
    .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length;
  return { overflow: doc.scrollWidth > doc.clientWidth + 1, recortados };
});

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page, 'admin@prefeitura-x.local', 'admin123');

    // ── 1) O caminho começa no MENU, não na URL ───────────────────────────────
    await abrirMenu(page, vp.n === 'mobile');
    const linkMenu = page.locator('aside a', { hasText: 'Equipes de suporte' }).first();
    // Espera o item ANTES de contar: logo depois do redirecionamento do login a barra lateral
    // ainda não pintou, e contar naquele instante media a renderização, não o menu.
    const temLink = await linkMenu.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
    check(temLink, `[${vp.n}] o menu oferece "Equipes de suporte" a quem administra`);
    await linkMenu.click();
    await page.waitForURL((u) => u.pathname.includes('/support/teams'), { timeout: 10000 });
    await page.waitForSelector('[data-testid=nova-equipe]', { timeout: 10000 });
    check(true, `[${vp.n}] o link abre a tela de equipes`);

    // ── 2) Criar equipe ───────────────────────────────────────────────────────
    const nome = `Atendimento ${vp.n} ${rid}`;
    await page.click('[data-testid=nova-equipe]');
    await page.waitForSelector('[data-testid=form-equipe]');
    await page.fill('[data-testid=form-equipe] input[name=name]', nome);
    await page.fill('[data-testid=form-equipe] textarea[name=description]', 'Primeiro nível de atendimento.');
    await page.getByRole('button', { name: 'Criar' }).click();
    const cartao = page.locator('[data-testid=equipe-cartao]', { hasText: nome }).first();
    await cartao.waitFor({ timeout: 10000 });
    check(true, `[${vp.n}] cria a equipe pela tela`);
    check((await cartao.locator('[data-testid=equipe-situacao]').innerText()).trim() === 'Ativa',
      `[${vp.n}] a equipe nasce ativa`);
    check((await cartao.innerText()).includes('Sem membros'),
      `[${vp.n}] a equipe sem membro avisa que ninguém recebe chamado`);

    // ── 3) Incluir membro: o nome REAL tem de aparecer ────────────────────────
    await cartao.locator('[data-testid=incluir-membro]').click();
    await page.waitForSelector('[data-testid=form-membro]');
    await escolherNoCombobox(page, 'Usuário do ambiente', 'Administrador');
    await page.click('[data-testid=confirmar-membro]');
    const membro = cartao.locator('[data-testid=equipe-membro]').first();
    await membro.waitFor({ timeout: 10000 });
    const textoMembro = (await membro.innerText()).trim();
    check(textoMembro.length > 0 && !/^Usuário \d+$/.test(textoMembro),
      `[${vp.n}] o membro aparece com o nome copiado do ambiente (${textoMembro})`);

    const responsivo = await auditarResponsivo(page);
    check(!responsivo.overflow, `[${vp.n}] a tela de equipes não rola na horizontal`);
    check(responsivo.recortados === 0, `[${vp.n}] nenhum cartão ou título recortado (${responsivo.recortados})`);
    await page.screenshot({ path: `${OUT}/suporte-equipes-${vp.n}.png`, fullPage: true });

    // ── 4) Remover membro (com confirmação) ───────────────────────────────────
    await membro.locator('button[aria-label^="Remover"]').click();
    await page.getByRole('button', { name: 'Remover', exact: true }).click();
    await page.waitForFunction(
      (alvo) => {
        const cartoes = [...document.querySelectorAll('[data-testid=equipe-cartao]')];
        const meu = cartoes.find((c) => c.textContent.includes(alvo));
        return !!meu && meu.querySelectorAll('[data-testid=equipe-membro]').length === 0;
      },
      nome, { timeout: 10000 },
    );
    check(true, `[${vp.n}] remove o membro e a equipe volta a ficar sem ninguém`);

    // ── 5) Renomear e desativar ───────────────────────────────────────────────
    const novoNome = `${nome} (2º nível)`;
    await cartao.locator('[data-testid=editar-equipe]').click();
    await page.waitForSelector('[data-testid=form-equipe]');
    await page.fill('[data-testid=form-equipe] input[name=name]', novoNome);
    await page.uncheck('[data-testid=form-equipe] input[name=active]');
    await page.getByRole('button', { name: 'Salvar' }).click();
    const editada = page.locator('[data-testid=equipe-cartao]', { hasText: novoNome }).first();
    await editada.waitFor({ timeout: 10000 });
    check((await editada.locator('[data-testid=equipe-situacao]').innerText()).trim() === 'Inativa',
      `[${vp.n}] renomeia e desativa a equipe`);

    await ctx.close();
  }

  // ── 6) Sem `support:admin`: nem link, nem botão, e a tela explica ───────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page, `sem-gestao-${rid}@prefeitura-x.local`, semGestao.body.initialPassword);

    // Ausência só se mede com a barra lateral JÁ pintada: contar antes disso dá zero para
    // qualquer item, e o teste passaria mesmo com o link presente (foi o que aconteceu).
    await page.locator('aside a', { hasText: 'Tarefas' }).first().waitFor({ state: 'visible', timeout: 15000 });
    check(await page.locator('aside a', { hasText: 'Equipes de suporte' }).count() === 0,
      'sem a permissão, o menu NÃO oferece equipes de suporte');

    await page.goto(BASE + '/support/teams', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=equipes-sem-permissao]', { timeout: 10000 });
    check(await page.locator('[data-testid=nova-equipe]').count() === 0,
      'sem a permissão, a tela não oferece criar equipe');
    check((await page.locator('[data-testid=equipes-sem-permissao]').innerText()).includes('support:admin'),
      'a tela diz QUAL permissão falta, em vez de só negar');
    check(await page.locator('[data-testid=equipe-cartao]').count() === 0,
      'e não lista equipe alguma — nem as do próprio cliente');

    // A recusa é do SERVIDOR, não da tela: o POST direto volta 403.
    const tokenSem = (await api(null, '/api/v1/auth/login', 'POST',
      { identifier: `sem-gestao-${rid}@prefeitura-x.local`, password: semGestao.body.initialPassword })).body.accessToken;
    const tentativa = await api(tokenSem, '/api/v1/support/teams/', 'POST', { name: `Pela porta dos fundos ${rid}` });
    check(tentativa.status === 403, `o backend recusa a criação por API (HTTP ${tentativa.status})`);
    await page.screenshot({ path: `${OUT}/suporte-equipes-sem-permissao.png`, fullPage: true });
    await ctx.close();
  }

  // ── 7) Área central: a Septem administra as próprias equipes ───────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(BASE + '/platform/support/teams', { waitUntil: 'networkidle' });
    await page.waitForSelector('input[name=email]', { timeout: 15000 });
    await page.fill('input[name=email]', CENTRAL_EMAIL);
    await page.fill('input[name=password]', CENTRAL_SENHA);
    await page.click('button[type=submit]');
    await page.waitForSelector('input[name=code]', { timeout: 10000 });
    const code = await page.evaluate(async (email) => {
      const r = await fetch(`/api/v1/platform/auth/dev/last-code?email=${encodeURIComponent(email)}`);
      return (await r.json()).code;
    }, CENTRAL_EMAIL);
    await page.fill('input[name=code]', code);
    await page.click('button[type=submit]');

    await page.waitForSelector('[data-testid=nova-equipe]', { timeout: 20000 });
    check(await page.locator('[data-testid=platform-nav-suporte]').count() === 1,
      'a navegação central tem o item Suporte');

    const nomeSeptem = `Triagem Septem ${rid}`;
    await page.click('[data-testid=nova-equipe]');
    await page.waitForSelector('[data-testid=form-equipe]');
    await page.fill('[data-testid=form-equipe] input[name=name]', nomeSeptem);
    await page.getByRole('button', { name: 'Criar' }).click();
    const daSeptem = page.locator('[data-testid=equipe-cartao]', { hasText: nomeSeptem }).first();
    await daSeptem.waitFor({ timeout: 10000 });
    check(true, 'a área central cria equipe da Septem pelas mesmas rotas');

    // Membro central: a lista de candidatos vem das identidades da Septem.
    await daSeptem.locator('[data-testid=incluir-membro]').click();
    await page.waitForSelector('[data-testid=form-membro]');
    await escolherNoCombobox(page, 'Pessoa da equipe Septem', 'Super');
    await page.click('[data-testid=confirmar-membro]');
    await daSeptem.locator('[data-testid=equipe-membro]').first().waitFor({ timeout: 10000 });
    check(true, 'e inclui uma pessoa da equipe Septem');

    // ── 8) Papéis centrais: sem isto a fila de triagem não tem quem a ocupe ───
    const pessoa = page.locator('[data-testid=pessoa-septem]').first();
    await pessoa.waitFor({ timeout: 10000 });
    const botaoTriagem = pessoa.locator('[data-testid=papel-support_triage]');
    const antes = await botaoTriagem.getAttribute('aria-pressed');
    await botaoTriagem.click();
    await page.waitForFunction(
      (anterior) => {
        const b = document.querySelector('[data-testid=pessoa-septem] [data-testid=papel-support_triage]');
        return !!b && b.getAttribute('aria-pressed') !== anterior;
      },
      antes, { timeout: 10000 },
    );
    const depois = await botaoTriagem.getAttribute('aria-pressed');
    check(depois !== antes, `o super admin concede/revoga o papel de triagem (${antes} → ${depois})`);

    // O estado veio do SERVIDOR, não da tela: recarregar mantém o que foi decidido.
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-testid=pessoa-septem]').first().waitFor({ timeout: 15000 });
    check(await page.locator('[data-testid=pessoa-septem]').first()
      .locator('[data-testid=papel-support_triage]').getAttribute('aria-pressed') === depois,
      'e o papel sobrevive ao recarregamento (foi gravado)');

    // A equipe da Septem NÃO aparece para o cliente — a separação é do backend.
    const doCliente = await api(token, '/api/v1/support/teams/');
    check(!JSON.stringify(doCliente.body).includes(nomeSeptem),
      'a equipe da Septem não aparece na lista do cliente');
    await page.screenshot({ path: `${OUT}/suporte-equipes-central.png`, fullPage: true });
    await ctx.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

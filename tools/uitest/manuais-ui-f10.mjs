// Fase 10 (10b/10c/10d) — telas de Manuais e Guide exercitadas no navegador real,
// web 1280 e mobile 375. Admin: criar manual com categoria inline (trava pela pai),
// público/unidades condicionais, editor rich-text com HTML source, aba Técnico.
// Guide: navbar Interno/Externo/Técnico, menu, conteúdo, anterior/próximo, TOC, busca
// com destaque, botão no login, e o interno NÃO vazando para o anônimo.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, {
    method: m, headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const token = (await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' })).body.accessToken;
const rid = Math.floor(Math.random() * 1e9);

// Dados do Guide via API (determinístico): categoria + externo publicado, interno,
// e um par pai/filho para exercitar o agrupamento do menu e o anterior/próximo.
const cat = (await api(token, '/api/v1/manual-categories', 'POST', { name: `Categoria Guide ${rid}` })).body.id;
const criar = (b) => api(token, '/api/v1/manuals', 'POST', { categoryId: cat, published: true, ...b }).then((r) => r.body.id);
const tPai = `Guia do painel ${rid}`;
const tFilho = `Detalhe do painel ${rid}`;
const tExterno2 = `Segundo externo ${rid}`;
const tInterno = `Área interna ${rid}`;
const idPai = await criar({ title: tPai, audience: 'externo', icon: 'fa-solid fa-book', contentHtml: `<h2>Introdução ${rid}</h2><p>corpo do painel ${rid}</p><h2>Detalhes ${rid}</h2><p>mais</p>` });
await criar({ title: tFilho, parentId: idPai, audience: 'externo', contentHtml: '<p>filho</p>' });
await criar({ title: tExterno2, audience: 'externo', contentHtml: '<p>outro externo</p>' });
await criar({ title: tInterno, audience: 'interno', contentHtml: '<p>somente interno</p>' });
// Categoria SÓ interna (item 24: o "Comece aqui" de cada aba lista só a categoria da aba).
const catInterna = (await api(token, '/api/v1/manual-categories', 'POST', { name: `Interna ${rid}` })).body.id;
const nomeCatInterna = `Interna ${rid}`;
await api(token, '/api/v1/manuals', 'POST', { categoryId: catInterna, published: true, title: `Manual interno cat ${rid}`, audience: 'interno', contentHtml: '<p>x</p>' });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};
const semOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const clipped = (page, sel) => page.evaluate((s) => {
  const vw = document.documentElement.clientWidth;
  return [...document.querySelectorAll(s)].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1); }).length;
}, sel);

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  await login(page);

  // ══════════ 10b — ADMIN: criar manual (aba própria) + categoria (modal) + HTML source ══════════
  await page.goto(`${BASE}/admin/manuais`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=novo-manual]', { timeout: 15000 });
  check(await page.locator('button[aria-pressed]', { hasText: 'Técnico' }).count() > 0, '[10b] aba Técnico aparece para o admin');

  // Item 19: o editor abre em ABA PRÓPRIA (rota /manual/nova), não em modal.
  await page.goto(`${BASE}/manual/nova`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=manual-titulo]', { timeout: 10000 });
  check(await page.locator('[data-testid=rich-text-editor]').count() === 1 && await page.locator('h1', { hasText: 'Novo manual' }).count() > 0,
    '[item19] editor de manual abre em página própria (aba), não em modal');
  const tituloNovo = `Criado pela tela ${rid}`;
  await page.fill('[data-testid=manual-titulo]', tituloNovo);

  // Item 20: o rich-text tem botões de Título e Subtítulo (headings).
  check(await page.locator('[data-testid=rich-text-editor] button[title="Título"]').count() === 1
     && await page.locator('[data-testid=rich-text-editor] button[title="Subtítulo"]').count() === 1,
    '[item20] rich-text dos manuais tem Título e Subtítulo');

  // Item 21: nova categoria abre em MODAL (não window.prompt/alert).
  const catInline = `Inline ${rid}`;
  await page.click('[data-testid=nova-categoria]');
  await page.waitForSelector('[data-testid=nova-categoria-nome]', { timeout: 5000 });
  check(await page.locator('[role=dialog]', { hasText: 'Nova categoria' }).count() > 0, '[item21] nova categoria abre em MODAL');
  await page.fill('[data-testid=nova-categoria-nome]', catInline);
  await page.click('[data-testid=nova-categoria-salvar]');
  await page.waitForTimeout(1000);
  const catSelecionada = await page.locator('[data-testid=manual-categoria] option:checked').innerText().catch(() => '');
  check(catSelecionada.includes(catInline), `[10b] categoria criada no modal já fica selecionada ("${catSelecionada}")`);

  // Conteúdo via HTML source (manuais:10).
  await page.click('[data-testid=toggle-html-source]');
  await page.waitForTimeout(300);
  await page.fill('[data-testid=html-source]', `<h2>Seção ${rid}</h2><p>texto salvo pela tela ${rid}</p>`);
  await page.click('[data-testid=toggle-html-source]');
  await page.waitForTimeout(300);
  await page.locator('[data-testid=manual-publico]').selectOption('externo');
  await page.click('[data-testid=salvar-manual]');
  await page.waitForTimeout(1500);
  const criadoNaApi = (await api(token, '/api/v1/manuals/')).body.find((m) => m.title === tituloNovo);
  check(!!criadoNaApi, '[10b] manual criado pela tela (aba própria) é persistido');

  // manuais:10 — imagem e vídeo por URL no editor (nova aba).
  await page.goto(`${BASE}/manual/nova`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=rich-text-editor]', { timeout: 10000 });
  await page.locator('[data-testid=rich-text-editor] [contenteditable]').click();
  page.once('dialog', (d) => d.accept(`https://ex.com/img-${rid}.png`));
  await page.locator('[data-testid=rich-text-editor] button[title="Imagem por URL"]').click();
  await page.waitForTimeout(400);
  page.once('dialog', (d) => d.accept(`https://www.youtube.com/watch?v=vid${rid}`));
  await page.locator('[data-testid=rich-text-editor] button[title="Vídeo por URL"]').click();
  await page.waitForTimeout(400);
  const editorHtml = await page.locator('[data-testid=rich-text-editor] [contenteditable]').innerHTML();
  check(editorHtml.includes(`img-${rid}.png`), '[10b] botão de imagem insere a <img> pela URL');
  check(/youtube\.com\/embed\/vid/.test(editorHtml), '[10b] botão de vídeo converte o link do YouTube em iframe de embed');

  // Público interno mostra as unidades; externo esconde (manuais:12) — nova aba.
  await page.goto(`${BASE}/manual/nova`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=manual-publico]', { timeout: 10000 });
  await page.locator('[data-testid=manual-publico]').selectOption('externo');
  await page.waitForTimeout(300);
  check(await page.locator('[data-testid=manual-unidades]').count() === 0, '[10b] público externo NÃO mostra o campo de unidades');
  await page.locator('[data-testid=manual-publico]').selectOption('interno');
  await page.waitForTimeout(300);
  check(await page.locator('[data-testid=manual-unidades]').count() > 0, '[10b] público interno MOSTRA o campo de unidades');

  // Artigo-pai trava a categoria (manuais:7).
  await page.locator('[data-testid=manual-pai]').selectOption({ label: tPai });
  await page.waitForTimeout(400);
  check(await page.locator('[data-testid=manual-categoria]').isDisabled(), '[10b] com artigo-pai a categoria fica bloqueada (herdada)');

  // Lista mostra o manual criado + aba Técnico lista os auto-gerados (10d).
  await page.goto(`${BASE}/admin/manuais`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=lista-manuais]', { timeout: 15000 });
  check(await page.locator('[data-testid=lista-manuais]').innerText().then((t) => t.includes(tituloNovo)), '[10b] o novo manual aparece na lista');
  await page.locator('button[aria-pressed]', { hasText: 'Técnico' }).click();
  await page.waitForTimeout(800);
  const tecnicoTxt = await page.locator('[data-testid=lista-manuais]').innerText().catch(() => '');
  check(/Modelador de processos|Visão geral da plataforma/.test(tecnicoTxt), '[10d] a aba Técnico lista os manuais técnicos auto-gerados');
  check(await semOverflow(page), '[10b] tela admin sem overflow horizontal (web)');
  await page.screenshot({ path: `${OUT}/f10-admin-web.png`, fullPage: true });

  // ══════════ 10c — GUIDE (admin = interno) ══════════
  await page.goto(`${BASE}/guide`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=guide-navbar]', { timeout: 15000 });
  await page.waitForTimeout(800);
  for (const t of ['interno', 'externo', 'tecnico']) {
    check(await page.locator(`[data-testid=guide-tab-${t}]`).count() > 0, `[10c] navbar tem a aba ${t}`);
  }
  check(await page.locator('[data-testid=guide-welcome]').count() > 0, '[10c] abre no "Comece aqui"');
  check(await page.locator('[data-testid=guide-welcome-categoria]').count() > 0, '[10c] "Comece aqui" lista categorias clicáveis');

  // Externo: abrir o pai, ver conteúdo, TOC dos <h2>, anterior/próximo e busca.
  await page.locator('[data-testid=guide-tab-externo]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid=guide-menu-item]', { hasText: tPai }).first().click();
  await page.waitForTimeout(700);
  const conteudo = await page.locator('[data-testid=guide-conteudo]').innerText();
  check(conteudo.includes(`corpo do painel ${rid}`), '[10c] o conteúdo do manual é renderizado');
  check(await page.locator('[data-testid=guide-toc] a').count() >= 2, '[10c] o TOC lista os títulos (h2) do manual');
  await page.locator('[data-testid=guide-toc] a').first().click().catch(() => {});
  check(await page.locator('[data-testid=guide-proximo]').count() > 0, '[10c] existe botão "próximo" quando há mais manuais');
  await page.locator('[data-testid=guide-proximo]').click();
  await page.waitForTimeout(500);
  check(await page.locator('[data-testid=guide-anterior]').count() > 0, '[10c] após avançar, existe "anterior"');

  // Item 22: o ícone do manual aparece no menu do guia.
  await page.locator('[data-testid=guide-menu-item]', { hasText: tPai }).first().click();
  await page.waitForTimeout(500);
  check(await page.locator('[data-testid=guide-menu-item] i').count() > 0, '[item22] o ícone do manual é exibido no menu do guia');

  // Item 25: o "Nesta página" (TOC) fica à ESQUERDA do conteúdo e sem background.
  const tocPos = await page.evaluate(() => {
    const toc = document.querySelector('[data-testid=guide-toc]');
    const cont = document.querySelector('[data-testid=guide-conteudo]');
    if (!toc || !cont) return null;
    const t = toc.getBoundingClientRect(), c = cont.getBoundingClientRect();
    const bg = getComputedStyle(toc).backgroundColor;
    return { left: t.left < c.left, transparent: bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' };
  });
  check(!!tocPos && tocPos.left, '[item25] "Nesta página" fica à esquerda do conteúdo');
  check(!!tocPos && tocPos.transparent, '[item25] "Nesta página" não tem background');

  // Item 26: a busca abre um POPOVER de resultados (não filtra o menu lateral).
  const menuItensAntes = await page.locator('[data-testid=guide-menu-item]').count();
  await page.fill('[data-testid=guide-busca]', tExterno2.slice(0, 12));
  await page.waitForTimeout(600);
  check(await page.locator('[data-testid=guide-busca-resultados]').count() === 1, '[item26] a busca abre um popover flutuante de resultados');
  check(await page.locator('[data-testid=guide-busca-resultado]', { hasText: tExterno2 }).count() > 0, '[item26] o popover lista o manual encontrado pelo título');
  check(await page.locator('[data-testid=guide-menu-item]').count() === menuItensAntes, '[item26] a busca NÃO filtra o menu lateral (continua completo)');
  await page.locator('[data-testid=guide-busca-resultado]', { hasText: tExterno2 }).first().click();
  await page.waitForTimeout(500);
  check(await page.locator('[data-testid=guide-busca-resultados]').count() === 0, '[item26] escolher um resultado fecha o popover');
  check((await page.locator('[data-testid=guide-conteudo]').innerText()).includes('outro externo'), '[item26] o resultado escolhido abre o manual');

  // Item 23: o campo de busca é centralizado (estreito, não ocupa a largura toda).
  const larg = await page.evaluate(() => ({ inp: document.querySelector('[data-testid=guide-busca]').getBoundingClientRect().width, header: document.querySelector('header').getBoundingClientRect().width }));
  check(larg.inp < larg.header * 0.6, `[item23] busca centralizada e estreita (${Math.round(larg.inp)}/${Math.round(larg.header)}px)`);

  // Item 24: "Comece aqui" lista só a categoria da aba ativa (externo não vê a só-interna).
  await page.locator('[data-testid=guide-tab-externo]').click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid=guide-menu] button', { hasText: 'Comece aqui' }).first().click();
  await page.waitForTimeout(400);
  const welcomeExterno = await page.locator('[data-testid=guide-welcome]').innerText();
  check(!welcomeExterno.includes(nomeCatInterna), '[item24] "Comece aqui" (externo) NÃO lista a categoria só-interna');

  await page.fill('[data-testid=guide-busca]', '');
  await page.waitForTimeout(300);
  check(await semOverflow(page), '[10c] Guide sem overflow horizontal (web)');
  await page.screenshot({ path: `${OUT}/f10-guide-web.png`, fullPage: true });
  await ctx.close();

  // ══════════ 10c — GUIDE ANÔNIMO: interno não vaza ══════════
  const anonCtx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const anon = anonCtx.newPage ? await anonCtx.newPage() : null;
  await anon.goto(`${BASE}/guide`, { waitUntil: 'networkidle' });
  await anon.waitForTimeout(1200);
  check(await anon.locator('[data-testid=guide-tab-interno]').count() === 0, '[10c] anônimo NÃO vê a aba Interno');
  check(await anon.locator('[data-testid=guide-tab-tecnico]').count() === 0, '[10c] anônimo NÃO vê a aba Técnico');
  const menuAnon = await anon.locator('[data-testid=guide-menu]').innerText();
  check(menuAnon.includes(tExterno2) || menuAnon.includes(tPai), '[10c] anônimo vê os manuais externos');
  check(!menuAnon.includes(tInterno), '[10c] o manual interno NÃO aparece para o anônimo');
  await anonCtx.close();

  // ══════════ Botão no login → /guide ══════════
  const loginCtx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const lp = await loginCtx.newPage();
  await lp.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await lp.waitForSelector('[data-testid=login-abrir-guide]', { timeout: 10000 });
  await lp.click('[data-testid=login-abrir-guide]');
  await lp.waitForURL((u) => u.pathname.includes('/guide'), { timeout: 10000 });
  check(lp.url().includes('/guide'), '[10c] botão do login abre o Guide');
  await loginCtx.close();

  // ══════════ MOBILE 375 ══════════
  const mob = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const m = await mob.newPage();
  await login(m);
  await m.goto(`${BASE}/admin/manuais`, { waitUntil: 'networkidle' });
  await m.waitForSelector('[data-testid=novo-manual]', { timeout: 15000 });
  check(await semOverflow(m), '[mobile] lista de manuais sem overflow horizontal');
  await m.goto(`${BASE}/manual/nova`, { waitUntil: 'networkidle' });
  await m.waitForSelector('[data-testid=manual-titulo]', { timeout: 10000 });
  check(await clipped(m, '[data-testid=manual-titulo], [data-testid=manual-categoria], [data-testid=manual-publico], [data-testid=rich-text-editor] button') === 0, '[mobile] editor de manual (aba própria) sem controles cortados');
  check(await semOverflow(m), '[mobile] editor de manual sem overflow horizontal');
  await m.screenshot({ path: `${OUT}/f10-admin-mobile.png`, fullPage: true });

  await m.goto(`${BASE}/guide`, { waitUntil: 'networkidle' });
  await m.waitForSelector('[data-testid=guide-navbar]', { timeout: 15000 });
  await m.waitForTimeout(800);
  await m.locator('[data-testid=guide-tab-externo]').click();
  await m.waitForTimeout(400);
  await m.locator('[data-testid=guide-menu-item]', { hasText: tPai }).first().click();
  await m.waitForTimeout(700);
  check((await m.locator('[data-testid=guide-conteudo]').innerText()).includes(`corpo do painel ${rid}`), '[mobile] Guide renderiza o conteúdo do manual');
  check(await semOverflow(m), '[mobile] Guide sem overflow horizontal');
  await m.screenshot({ path: `${OUT}/f10-guide-mobile.png`, fullPage: true });
  await mob.close();
} finally {
  await browser.close();
}

console.log(ok.map((m) => `✓ ${m}`).join('\n'));
if (bad.length) console.log(bad.map((m) => `✗ ${m}`).join('\n'));
console.log(bad.length ? `FALHOU (${bad.length}/${ok.length + bad.length})` : `PASSOU (${ok.length} checks)`);
process.exit(bad.length ? 1 : 0);

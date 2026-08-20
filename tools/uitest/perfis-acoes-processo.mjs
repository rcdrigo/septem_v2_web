// Fase 3 (requisitos 2026-08-03): as permissões das ações administrativas sobre uma
// requisição aparecem no perfil de acesso e podem ser concedidas.
//
// A fase NÃO expõe botão nenhum — de propósito. O que se prova aqui é o vocabulário
// chegando à tela e, principalmente, que a marcação PERSISTE depois de recarregar:
// "salvar-antes-de-carregar" é o bug clássico desta tela (o form abre vazio, salva por
// cima e apaga o que o usuário não tocou), e marcar a caixa não prova que salvou.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const NOVAS = [
  'workflow:cancel', 'workflow:reopen', 'workflow:return',
  'workflow:forward', 'workflow:reassign',
];

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

// O catálogo é a fonte da tela: se a permissão não estiver aqui, não há o que marcar.
const catalogo = (await api(token, '/api/v1/permissions')).body ?? [];
const chaves = (Array.isArray(catalogo) ? catalogo : catalogo.items ?? []).map((p) => p.key);
for (const k of NOVAS) check(chaves.includes(k), `[api] o catálogo traz ${k}`);

const rid = Math.floor(Math.random() * 1e9);
const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });

/**
 * Caixa da permissão pelo <code> com a chave — o rótulo pode mudar, a chave não.
 *
 * Sobe do <code> para o label MAIS PRÓXIMO. Filtrar `label` por conteúdo não serve:
 * o label externo ("Permissões") envolve todos os itens, então ele também "contém" a
 * chave — e a busca resolvia para as 33 caixas da tela.
 */
const caixaDe = (page, chave) =>
  page.locator(`code:text-is("${chave}")`).locator('xpath=ancestor::label[1]').locator('input[type=checkbox]');

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20000 });

    await page.goto(`${BASE}/admin/profiles`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Novo perfil/i }).click();
    await page.waitForSelector('input[type=checkbox]', { timeout: 10000 });

    // As cinco aparecem, e no grupo "Processos" (prefixo workflow).
    for (const chave of NOVAS) {
      const caixa = caixaDe(page, chave);
      check(await caixa.count() === 1, `[${vp.n}] a permissão ${chave} aparece na tela`);
    }
    // O rótulo do grupo é "Processos"; o CAIXA ALTA vem do CSS (uppercase), não do DOM.
    const grupoProcessos = await page.locator('p:text-is("Processos")').count();
    check(grupoProcessos > 0, `[${vp.n}] as permissões novas ficam no grupo "Processos"`);

    // Preenche o nome e marca as cinco.
    const nome = `Chefia UI ${vp.n} ${rid}`;
    await page.locator('input[type=text]').first().fill(nome);
    for (const chave of NOVAS) await caixaDe(page, chave).check();

    // Mede o MODAL, que é o que está sob teste. Medir a página inteira contava os
    // botões da tabela por baixo, que ficam fora da viewport por estarem no scroll
    // horizontal PRÓPRIO dela — comportamento correto (a página não rola: 302 de 302
    // estavam dentro de <table>, nenhum dentro do modal).
    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const modal = document.querySelector('[role=dialog]') ?? document.body;
      const clipped = [...modal.querySelectorAll('button, input, label')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
      }).length;
      return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
    });
    check(!layout.overflows, `[${vp.n}] editor de perfil sem overflow horizontal`);
    check(layout.clipped === 0, `[${vp.n}] editor de perfil sem controle recortado (${layout.clipped})`);
    await page.screenshot({ path: `${OUT}/perfis-acoes-${vp.n}.png`, fullPage: true });

    await page.getByRole('button', { name: /^Salvar$/i }).click();
    await page.waitForTimeout(2000);

    // ── A prova: RECARREGAR e reabrir. Marcar não é salvar. ──────────────────
    await page.goto(`${BASE}/admin/profiles`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const linha = page.locator('tr', { hasText: nome }).first();
    check(await linha.count() === 1, `[${vp.n}] o perfil "${nome}" foi criado e aparece na lista`);
    // A linha não é clicável: o editor abre pelo botão de lápis da própria linha.
    await linha.locator('button[title="Editar"]').click();
    await page.waitForSelector('input[type=checkbox]', { timeout: 10000 });

    const persistidas = [];
    for (const chave of NOVAS) if (await caixaDe(page, chave).isChecked()) persistidas.push(chave);
    check(persistidas.length === NOVAS.length,
      `[${vp.n}] as 5 permissões PERSISTEM após recarregar (${persistidas.length}/5: ${JSON.stringify(persistidas)})`);

    // E o backend confirma — a tela poderia estar mostrando estado local.
    const perfis = (await api(token, '/api/v1/access-profiles')).body ?? [];
    const salvo = (Array.isArray(perfis) ? perfis : perfis.items ?? []).find((p) => p.name === nome);
    const noBackend = NOVAS.filter((k) => (salvo?.permissions ?? []).includes(k));
    check(noBackend.length === NOVAS.length,
      `[${vp.n}] o backend guardou as 5 permissões (${noBackend.length}/5)`);

    await ctx.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

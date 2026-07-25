// Fase 10 (10a — backend) contra o servidor REAL (:5000, Postgres de verdade). Prova o
// que o dotnet test in-process não cobre: a migration aplicada no banco real, o fluxo por
// HTTP real e — o ponto de segurança — o HTML sanitizado renderizado DENTRO do navegador
// sem disparar XSS. Sem tela de Manuais ainda (10b/10c); aqui é API real + render do HTML.
import { chromium } from 'playwright-core';

const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const login = async (id, pw) => (await api(null, '/api/v1/auth/login', 'POST', { identifier: id, password: pw })).body.accessToken;
const token = await login('admin@prefeitura-x.local', 'admin123');
const rid = Math.floor(Math.random() * 1e9);

// ── Categoria inline + manuais de cada público ──────────────────────────────
const cat = (await api(token, '/api/v1/manual-categories', 'POST', { name: `Guia F10 ${rid}` })).body.id;
check(!!cat, '[api] categoria criada inline');

const criar = async (body) => (await api(token, '/api/v1/manuals', 'POST', { categoryId: cat, published: true, ...body })).body.id;

const tExterno = `Externo ${rid}`;
const tInterno = `Interno ${rid}`;
const tTecnico = `Tecnico ${rid}`;
const tRascunho = `Rascunho ${rid}`;

// HTML propositalmente perigoso: o backend tem de limpar isto NA ESCRITA.
const PERIGOSO = `<p>conteudo-legitimo-${rid}</p>`
  + `<script>window.__xss=(window.__xss||0)+1</script>`
  + `<img src=x onerror="window.__xss=(window.__xss||0)+1">`
  + `<a href="javascript:window.__xss=(window.__xss||0)+1">clique</a>`
  + `<iframe src="https://evil-${rid}.example.com/x"></iframe>`
  + `<iframe src="https://www.youtube.com/embed/vid${rid}"></iframe>`;

const idExterno = await criar({ title: tExterno, audience: 'externo', contentHtml: PERIGOSO });
await criar({ title: tInterno, audience: 'interno', contentHtml: '<p>interno</p>' });
const idTecnico = await criar({ title: tTecnico, audience: 'interno', isTechnical: true, contentHtml: '<p>tecnico</p>' });
await criar({ title: tRascunho, audience: 'externo', published: false, contentHtml: '<p>rascunho</p>' });

// ── Sanitização (o servidor devolve HTML já limpo) ──────────────────────────
const det = (await api(token, `/api/v1/manuals/${idExterno}`)).body;
const html = det.contentHtml || '';
check(!/<script/i.test(html), '[seg] <script> removido do HTML salvo');
check(!/onerror/i.test(html), '[seg] atributo onerror removido');
check(!/javascript:/i.test(html), '[seg] href javascript: removido');
check(!html.includes(`evil-${rid}.example.com`), '[seg] iframe de host não permitido removido');
check(html.includes(`youtube.com/embed/vid${rid}`), '[seg] iframe de vídeo (host permitido) preservado');
check(html.includes(`conteudo-legitimo-${rid}`), '[seg] texto legítimo preservado');

// ── Guide ANÔNIMO: interno e rascunho não podem aparecer ────────────────────
const anon = (await api(null, '/api/v1/guide')).body;
check(anon.isInternal === false, '[guide] visitante anônimo não é interno');
const anonTitulos = (anon.external || []).map((m) => m.title);
check(anonTitulos.includes(tExterno), '[guide] anônimo vê o manual externo publicado');
check(!anonTitulos.includes(tRascunho), '[guide] anônimo NÃO vê rascunho');
check(!(anon.internal || []).some((m) => m.title === tInterno), '[guide] interno não vaza para anônimo');
check((anon.technical || []).length === 0 && anon.canTechnical === false, '[guide] anônimo não tem aba técnica');

// ── Guide INTERNO (admin): interno visível, técnico só na aba técnica ───────
const adminGuide = (await api(token, '/api/v1/guide')).body;
check(adminGuide.isInternal === true, '[guide] admin logado é interno');
check((adminGuide.internal || []).some((m) => m.title === tInterno), '[guide] interno aparece para o interno logado');
check(adminGuide.canTechnical === true, '[guide] admin tem a aba técnica');
check((adminGuide.technical || []).some((m) => m.title === tTecnico), '[guide] técnico aparece na aba Técnico');
check(!(adminGuide.internal || []).some((m) => m.title === tTecnico), '[guide] técnico NÃO polui a aba Interno');
check(adminGuide.welcome?.title?.includes('Bem-vindo'), '[guide] "Comece aqui" traz a saudação');
check((adminGuide.welcome?.categories || []).some((k) => k.id === cat), '[guide] "Comece aqui" lista a categoria do manual');

// ── Usuário SEM manuals:technical: sem aba técnica e 403 no detalhe ─────────
const perfil = (await api(token, '/api/v1/access-profiles', 'POST', { name: `Comum M10 ${rid}`, permissions: ['workflow:read', 'manuals:read'] })).body.id;
const u = (await api(token, '/api/v1/users', 'POST', { name: 'Comum', email: `comum.m10.${rid}@prefeitura-x.local`, isInternal: true })).body;
await api(token, `/api/v1/users/${u.id}`, 'PUT', { accessProfileIds: [perfil] });
const comumToken = await login(`comum.m10.${rid}@prefeitura-x.local`, u.initialPassword);
const comumGuide = (await api(comumToken, '/api/v1/guide')).body;
check(comumGuide.canTechnical === false, '[guide] usuário sem permissão não tem aba técnica');
check((comumGuide.technical || []).length === 0, '[guide] técnico não aparece para quem não pode');
check((await api(comumToken, `/api/v1/manuals/${idTecnico}`)).status === 403, '[guide] detalhe de manual técnico dá 403 sem permissão');

// ── NAVEGADOR: renderizar o HTML sanitizado e provar que o XSS NÃO dispara ──
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
try {
  for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    let dialog = false;
    page.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
    // Renderiza EXATAMENTE o que o backend guardou (o que o Guide serviria).
    await page.setContent(`<!doctype html><html><body><article id="c">${html}</article></body></html>`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(600);
    const tag = vp.width === 1280 ? 'web' : 'mobile';
    const xss = await page.evaluate(() => window.__xss || 0);
    check(xss === 0 && !dialog, `[${tag}] HTML sanitizado NÃO executa script/onerror no navegador`);
    const temTexto = await page.evaluate((r) => document.body.innerText.includes(`conteudo-legitimo-${r}`), rid);
    check(temTexto, `[${tag}] o conteúdo legítimo é renderizado`);
    const iframes = await page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src') || ''));
    check(iframes.some((s) => s.includes('youtube.com/embed')), `[${tag}] o vídeo do YouTube é renderizado`);
    check(!iframes.some((s) => s.includes('evil-')), `[${tag}] nenhum iframe malicioso no DOM`);
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)),
      `[${tag}] conteúdo do manual sem overflow horizontal`);
    await page.screenshot({ path: `${OUT}/f10-conteudo-${tag}.png`, fullPage: true });
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(ok.map((m) => `✓ ${m}`).join('\n'));
if (bad.length) console.log(bad.map((m) => `✗ ${m}`).join('\n'));
console.log(bad.length ? `FALHOU (${bad.length}/${ok.length + bad.length})` : `PASSOU (${ok.length} checks)`);
process.exit(bad.length ? 1 : 0);

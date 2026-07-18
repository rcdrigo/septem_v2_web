// Organograma e Unidades usam a mesma árvore compacta: cada unidade tem card
// intrínseco, nomes nunca truncam e somente o viewport da árvore rola na horizontal.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const CHROME = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome');
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));
const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;

// Garante ao menos uma unidade: cria uma se o tenant não tiver nenhuma (o dev
// costuma já ter). Não falha se o create for rejeitado — o que importa é existir uma.
const rid = Math.floor(Math.random() * 1e6);
let tree = (await api(token, '/api/v1/org-units/tree')).body ?? [];
if (!Array.isArray(tree) || tree.length === 0) {
  await api(token, '/api/v1/org-units/', 'POST', { name: `Secretaria ${rid}`, sigla: `sec${rid}` });
  tree = (await api(token, '/api/v1/org-units/tree')).body ?? [];
}
check(Array.isArray(tree) && tree.length > 0, `[api] há unidade(s) para o organograma (${tree.length})`);

// Cria uma raiz com nome deliberadamente longo e uma filha para provar largura
// intrínseca, rolagem interna, conectores e expansão/recolhimento.
const nomeLongo = `Secretaria Municipal de Planejamento Estratégico, Governança Digital e Coordenação Intersetorial ${rid}`;
const criadas = [];
const raizLonga = await api(token, '/api/v1/org-units/', 'POST', {
  name: nomeLongo,
  sigla: `ORG${rid}`,
});
if (raizLonga.body?.id) criadas.push(raizLonga.body.id);
const filhaLonga = raizLonga.body?.id
  ? await api(token, '/api/v1/org-units/', 'POST', {
      name: `Coordenação subordinada de acompanhamento e resultados ${rid}`,
      sigla: `SUB${rid}`,
      parentId: raizLonga.body.id,
    })
  : { status: 0, body: null };
if (filhaLonga.body?.id) criadas.push(filhaLonga.body.id);
check(raizLonga.status < 300 && filhaLonga.status < 300, '[api] cria raiz longa e subunidade para validar a árvore');

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const vp of [
  { n: 'web', w: 1280, h: 900 },
  { n: 'mobile-320', w: 320, h: 760 },
  { n: 'mobile-375', w: 375, h: 812 },
  { n: 'mobile-414', w: 414, h: 896 },
  { n: 'tablet-768', w: 768, h: 900 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
    await page.goto(BASE + '/organograma', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=organograma-linha]', { timeout: 15000 });

    // Cada unidade é seu próprio card; o viewport externo é transparente e rolável.
    const linhas = await page.locator('[data-testid=organograma-linha]').count();
    check(linhas > 0, `[${vp.n}] organograma renderiza cards individuais (${linhas})`);
    const temAvatar = await page.locator('[data-testid=organograma-linha] [data-testid=avatar]').count();
    check(temAvatar > 0, `[${vp.n}] cada linha tem avatar do titular (${temAvatar})`);
    const linhaLonga = page.locator('[data-testid=organograma-linha]', { hasText: nomeLongo }).first();
    const layout = await linhaLonga.evaluate((card) => {
      const viewport = card.closest('[data-testid=org-unit-tree-viewport]');
      const nome = card.querySelector('[data-testid=org-unit-name]');
      const csCard = getComputedStyle(card);
      const csNome = nome ? getComputedStyle(nome) : null;
      const csViewport = viewport ? getComputedStyle(viewport) : null;
      return {
        cardTemBorda: parseFloat(csCard.borderTopWidth) > 0,
        viewportTemBorda: !!csViewport && parseFloat(csViewport.borderTopWidth) > 0,
        cardWidth: card.getBoundingClientRect().width,
        viewportWidth: viewport?.getBoundingClientRect().width ?? 0,
        viewportScrollable: !!viewport && viewport.scrollWidth > viewport.clientWidth + 1,
        nomeCompleto: nome?.textContent?.trim(),
        whiteSpace: csNome?.whiteSpace,
        textOverflow: csNome?.textOverflow,
        overflow: csNome?.overflow,
        documentoComOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    check(layout.cardTemBorda && !layout.viewportTemBorda, `[${vp.n}] card individual com borda e viewport externo transparente`);
    check(layout.nomeCompleto === nomeLongo, `[${vp.n}] nome longo aparece integralmente`);
    check(layout.whiteSpace === 'nowrap' && layout.textOverflow !== 'ellipsis' && layout.overflow !== 'hidden',
      `[${vp.n}] nome sem quebra, elipse ou recorte`);
    check(!layout.documentoComOverflow, `[${vp.n}] documento sem overflow horizontal`);
    if (vp.w <= 414) {
      check(layout.cardWidth > layout.viewportWidth && layout.viewportScrollable,
        `[${vp.n}] card cresce pelo texto e somente a árvore rola horizontalmente`);
    }

    // A raiz longa tem uma filha: o conector existe e o chevron controla o ramo.
    const ramoLongo = linhaLonga.locator('xpath=..');
    check((await ramoLongo.locator('[data-testid=org-unit-children]').count()) > 0,
      `[${vp.n}] hierarquia renderiza conector e subunidade`);
    await linhaLonga.getByRole('button', { name: `Recolher ${nomeLongo}` }).click();
    check((await ramoLongo.locator('[data-testid=org-unit-children]').count()) === 0,
      `[${vp.n}] recolher oculta as subunidades`);
    await linhaLonga.getByRole('button', { name: `Expandir ${nomeLongo}` }).click();
    check((await ramoLongo.locator('[data-testid=org-unit-children]').count()) > 0,
      `[${vp.n}] expandir restaura as subunidades`);

    if (vp.n === 'web') {
      // Clicar numa unidade abre o detalhamento /unidade?id= em nova aba.
      const [popup] = await Promise.all([
        ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null),
        linhaLonga.locator('button[title="Abrir a unidade em nova aba"]').click(),
      ]);
      const url = popup ? popup.url() : '';
      check(/\/unidade\?id=/.test(url), `[web] clicar na unidade abre o detalhamento (/unidade?id=) — url="${url}"`);
      if (popup) await popup.close();
    }
    await page.screenshot({ path: `${OUT}/organograma-${vp.n}.png`, fullPage: true });
  } finally { await ctx.close(); }
}
await browser.close();
for (const id of criadas.reverse()) await api(token, `/api/v1/org-units/${id}`, 'DELETE');
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Bug: "O organograma ainda está com layout antigo. Usar o mesmo layout de Unidades;
// clicar na unidade abre o detalhamento." Fix: OrganogramaPage reescrita no padrão de
// UnidadesPage (card + chevron + avatar + sigla/titular), read-only, clique → /unidade?id=.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
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

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
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

    // Layout novo: linhas em card, com avatar e sigla (não mais caixas soltas).
    const linhas = await page.locator('[data-testid=organograma-linha]').count();
    check(linhas > 0, `[${vp.n}] organograma renderiza linhas no novo layout (${linhas})`);
    const temAvatar = await page.locator('[data-testid=organograma-linha] [data-testid=avatar]').count();
    check(temAvatar > 0, `[${vp.n}] cada linha tem avatar do titular (${temAvatar})`);
    const card = await page.evaluate(() => {
      const l = document.querySelector('[data-testid=organograma-linha]');
      const container = l?.parentElement;
      return !!container && /rounded-md/.test(container.className) && /border/.test(container.className);
    });
    check(card, `[${vp.n}] linhas dentro de um card com borda (layout de Unidades)`);
    // Sem overflow horizontal.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!overflow, `[${vp.n}] sem overflow horizontal`);

    if (vp.n === 'web') {
      // Clicar numa unidade abre o detalhamento /unidade?id= em nova aba.
      const [popup] = await Promise.all([
        ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null),
        page.locator('[data-testid=organograma-linha] button[title="Abrir a unidade em nova aba"]').first().click(),
      ]);
      const url = popup ? popup.url() : '';
      check(/\/unidade\?id=/.test(url), `[web] clicar na unidade abre o detalhamento (/unidade?id=) — url="${url}"`);
      if (popup) await popup.close();
      await page.screenshot({ path: `${OUT}/organograma.png` });
    }
  } finally { await ctx.close(); }
}
await browser.close();
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

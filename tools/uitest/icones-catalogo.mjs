// Fase 4e — Catálogo de ícones expandido. Antes o picker mostrava ~140 ícones
// curados; agora a busca varre o catálogo COMPLETO do FontAwesome Free (~1400),
// que já estava carregado por CSS. Prova: buscar um ícone fora da lista curada
// (rocket, atom) encontra resultado, e o placeholder cita o total. Web + mobile.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

try {
  for (const view of [{ name: 'web', w: 1280, h: 900 }, { name: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);

    await page.goto(`${BASE}/flows/edit?key=teste_condicoes_ui`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-element-id="T005"]', { state: 'attached', timeout: 20000 });
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.waitForTimeout(1200);

    // Abre o picker do campo "Ícone" (processo sem ícone → botão "Sem ícone").
    await page.locator('button', { hasText: 'Sem ícone' }).first().click();
    await page.waitForSelector('input[placeholder*="ícones"]', { timeout: 8000 });

    // O placeholder cita o catálogo completo (~1400), não os ~140 curados.
    const ph = await page.locator('input[placeholder*="ícones"]').getAttribute('placeholder');
    const total = Number((ph || '').replace(/\D+/g, ''));
    check(total > 1000, `[${view.name}] o picker busca no catálogo completo (${total} ícones)`);

    // Buscar um ícone FORA da lista curada encontra resultado.
    await page.locator('input[placeholder*="ícones"]').fill('rocket');
    await page.waitForTimeout(500);
    const achouRocket = await page.locator('button', { hasText: 'rocket' }).count();
    check(achouRocket > 0, `[${view.name}] buscar "rocket" (fora do catálogo antigo) encontra o ícone`);

    await page.locator('input[placeholder*="ícones"]').fill('atom');
    await page.waitForTimeout(400);
    check(await page.locator('button', { hasText: 'atom' }).count() > 0, `[${view.name}] buscar "atom" também encontra`);
    await page.screenshot({ path: `${OUT}/icones-${view.name}.png`, fullPage: true });

    // Selecionar o ícone aplica a classe FontAwesome.
    await page.locator('input[placeholder*="ícones"]').fill('rocket');
    await page.waitForTimeout(400);
    await page.locator('button', { hasText: 'rocket' }).first().click();
    await page.waitForTimeout(400);
    const temIcone = await page.locator('i.fa-rocket, i.fa-solid.fa-rocket').count();
    check(temIcone > 0, `[${view.name}] selecionar aplica o ícone (fa-rocket)`);

    // Sem overflow horizontal.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!overflow, `[${view.name}] sem overflow horizontal`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

/** Verifica a origem dos processos já instalados nos ambientes dos clientes. */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

for (const vp of [{ n: 'web', width: 1280, height: 900 }, { n: 'mobile', width: 375, height: 812 }]) {
  const c2 = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const p2 = await c2.newPage();
  await p2.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p2.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await p2.fill('input[name=password]', 'admin123');
  await p2.click('button[type=submit]');
  await p2.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });

  await p2.route('**/api/v1/workflow/process-definitions/?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            key: 'vindo-do-catalogo', name: 'Licença do catálogo', description: null, version: 3,
            status: 'published', icon: null, category: null, categoryId: null, categoryColor: null,
            categoryIcon: null, area: null, updatedAt: new Date().toISOString(),
            catalogKey: 'licenca-de-obra', catalogVersion: 2, customized: true,
          },
          {
            key: 'proprio-do-cliente', name: 'Processo próprio', description: null, version: 1,
            status: 'draft', icon: null, category: null, categoryId: null, categoryColor: null,
            categoryIcon: null, area: null, updatedAt: new Date().toISOString(),
            catalogKey: null, catalogVersion: null, customized: false,
          },
        ],
        total: 2, page: 1, pageSize: 20,
      }),
    });
  });

  await p2.goto(BASE + '/admin/flows', { waitUntil: 'networkidle' });
  // Espera tolerante: se a origem não aparecer, o check falha com mensagem — estourar aqui
  // mataria a suíte e esconderia os outros casos.
  const origem = await p2.waitForSelector('[data-testid=origem-catalogo-vindo-do-catalogo]', { timeout: 20000 })
    .then((el) => el.innerText()).catch(() => '');
  check(/catálogo v2/i.test(origem) && /personalizado/i.test(origem),
    `[${vp.n}] a lista mostra "do catálogo v2, personalizado" ("${origem.trim()}")`);
  check(await p2.locator('[data-testid=origem-catalogo-proprio-do-cliente]').count() === 0,
    `[${vp.n}] processo próprio do cliente NÃO ganha rótulo de origem`);
  // Só no mobile: a versão com `|| vp.n === 'web'` que estava aqui NÃO podia falhar em
  // 1280 — um check que passa sempre é pior que check nenhum.
  if (vp.n === 'mobile')
    check(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      '[mobile] a lista com a origem não rola na horizontal');
  await p2.screenshot({ path: `${OUT}/catalogo-origem-${vp.n}.png`, fullPage: true });
  await c2.close();
}

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

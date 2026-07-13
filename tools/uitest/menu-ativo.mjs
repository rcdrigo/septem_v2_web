import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';

// rota → [rótulo ativo esperado, grupo esperado (null = item de topo)]
const CASES = [
  ['/admin/processos', 'Processos', 'Processos'],
  // categorias de processo viraram modal em Admin › Processos; a rota antiga redireciona
  ['/admin/processos/categorias', 'Processos', 'Processos'],
  ['/admin/modelos-email', 'Modelos de e-mails', 'Processos'],
  ['/admin/modelos-doc', 'Modelos de documentos', 'Processos'],
  ['/admin/fontes-dados', 'Fontes de dados', 'Processos'],
  ['/admin/fontes-dados?scope=report', 'Fontes de dados', 'Relatórios e Dashboards'],
  ['/admin/relatorios', 'Relatórios', 'Relatórios e Dashboards'],
  ['/admin/relatorios/categorias', 'Relatórios', 'Relatórios e Dashboards'], // redireciona (modal)
  ['/admin/dashboards', 'Dashboards', 'Relatórios e Dashboards'],
  ['/admin/usuarios', 'Usuários', 'Configurações'],
  ['/admin/perfis', 'Perfis de acesso', 'Configurações'],
  ['/servicos', 'Serviços', null],
];

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

async function actives(route) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  return page.evaluate(() => {
    const links = [...document.querySelectorAll('aside a')];
    return links
      .filter((a) => [...a.classList].some((c) => c === 'bg-slate-100' || c === 'bg-slate-900'))
      .map((a) => ({
        label: a.textContent?.trim(),
        // grupo = <li> pai com <button><span>rótulo</span></button>
        group: a.closest('ul')?.closest('li')?.querySelector('button span')?.textContent?.trim() ?? null,
        ariaCurrent: a.getAttribute('aria-current'),
      }));
  });
}

let failures = 0;
for (const [route, label, group] of CASES) {
  const found = await actives(route);
  const ok = found.length === 1 && found[0].label === label && found[0].group === group;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${route} → ${JSON.stringify(found)}`);
}

// Mobile spot-check no caso mais crítico (query string)
await page.setViewportSize({ width: 375, height: 812 });
const mob = await actives('/admin/fontes-dados?scope=report');
const mobOk = mob.length === 1 && mob[0].group === 'Relatórios e Dashboards';
if (!mobOk) failures++;
console.log(`${mobOk ? '✓' : '✗ FALHOU'} [mobile] /admin/fontes-dados?scope=report → ${JSON.stringify(mob)}`);
await page.screenshot({ path: `${OUT}/menu-fontes-mobile.png` });

console.log(failures === 0 ? 'PASSOU (todos os casos)' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

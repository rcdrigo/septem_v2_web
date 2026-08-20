import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}

// ── AUTOSSUFICIÊNCIA ─────────────────────────────────────────────────────────
// A suíte dependia dos 3 relatórios demo do seeder aparecerem no catálogo. Mas
// /reports carrega no máximo 100 publicados (useReportsList pageSize:100, sem
// paginação): num tenant com mais que isso, os demo simplesmente somem da tela e a
// suíte quebrava por dado alheio. Agora ela CLONA os 3 demo (mesma fonte, mesma
// definição, nome com rid) e trabalha nas cópias — que, sendo as mais recentes,
// estão sempre visíveis. Idempotente e imune ao volume do banco.
const rid = Math.floor(Math.random() * 1e9);
const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;

/** Cria e publica um relatório sobre a fonte informada. Devolve {nome, key}. */
async function criar(rotulo, dataSourceId, definitionJson) {
  const nome = `${rotulo} ${rid}`;
  const criado = await api(token, '/api/v1/reports/', 'POST', { name: nome, sourceType: 'dataSource', dataSourceId, definitionJson });
  if (criado.status !== 201) throw new Error(`criação de "${nome}" falhou (${criado.status})`);
  const pub = await api(token, `/api/v1/reports/${criado.body.key}/publish`, 'POST', {});
  if (pub.status !== 200) throw new Error(`publicação de "${nome}" falhou (${pub.status}): ${JSON.stringify(pub.body)}`);
  return { nome, key: criado.body.key };
}

/** Lê um relatório demo do seeder para reaproveitar fonte e definição. */
async function demo(origem) {
  // Sem fixar versão: os demo não têm todos a mesma (despesas_por_unidade nasceu
  // na v0) e o que interessa é a definição corrente.
  const { body } = await api(token, `/api/v1/reports/${origem}`);
  if (!body) throw new Error(`relatório demo "${origem}" não encontrado`);
  return body;
}

const basePainel = await demo('painel_de_despesas');
const basePaginada = await demo('tabela_paginada');

const painel = await criar('Painel de Despesas', basePainel.dataSourceId, basePainel.definitionJson);
// "Sem coluna oculta" = tabela default sobre a mesma fonte do painel. O demo
// `despesas_por_unidade` não serve de molde: está sem fonte no banco (só sobrevive
// pelo snapshot congelado da v0), então não é clonável nem republicável.
const porUnidade = await criar('Despesas por unidade', basePainel.dataSourceId, '{}');
const paginada = await criar('Tabela Paginada', basePaginada.dataSourceId, basePaginada.definitionJson);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

// Os cards do catálogo são <article> e o "Abrir" leva o relatório para uma ABA
// PRÓPRIA (/reports/view?key=) — não há mais viewer embutido na página.
const cardDoRelatorio = (nome) => page.locator('section .grid > article', { hasText: nome });

async function abrirRelatorio(nome) {
  await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 20000 }),
    cardDoRelatorio(nome).locator('button', { hasText: 'Abrir' }).first().click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  return popup;
}

// ── 1. Consultas: abrir o painel e conferir blocos ───────────────────────────
let viewer = await abrirRelatorio(painel.nome);
check(/\/reports\/view\?key=/.test(viewer.url()), `"Abrir" leva o relatório para a aba própria (${new URL(viewer.url()).pathname})`);
await viewer.waitForSelector('text=Total de despesas', { timeout: 20000 });
await viewer.waitForTimeout(800);
await viewer.screenshot({ path: `${OUT}/viewer-desktop.png`, fullPage: true });

const state = await viewer.evaluate(() => ({
  kpi: document.body.innerText.includes('R$') && document.body.innerText.includes('2.750'),
  charts: document.querySelectorAll('canvas').length,
  timestamp: /Dados de \d{2}\/\d{2}\/\d{4}/.test(document.body.innerText),
  filtro: [...document.querySelectorAll('label')].some((l) => l.textContent?.includes('Setor')),
  detailBtns: document.querySelectorAll('button[aria-label="Visualizar detalhamento"]').length,
  exportBtns: [...document.querySelectorAll('button')].filter((b) => /CSV|XLSX/.test(b.textContent ?? '')).length,
}));
check(state.kpi, 'KPI formatado em moeda com o total correto (R$ 2.750)');
check(state.charts >= 2, `gráficos Chart.js renderizados (pizza + barras): ${state.charts} canvas`);
check(state.timestamp, 'timestamp do cache exibido');
check(state.filtro, 'filtro global "Setor" presente');
check(state.detailBtns > 0, `tabela com coluna oculta mostra botão de detalhe por linha (${state.detailBtns})`);
check(state.exportBtns >= 2, 'botões de exportação CSV/XLSX presentes');

// filtro global: aplica "Obras" → KPI recalcula (1200+800=2000)
await viewer.selectOption('select', 'Obras');
await viewer.locator('button', { hasText: 'Aplicar filtros' }).click();
await viewer.waitForTimeout(1200);
check(await viewer.evaluate(() => document.body.innerText.includes('2.000')), 'filtro global aplicado recalcula KPI (R$ 2.000)');
await viewer.selectOption('select', '');
await viewer.locator('button', { hasText: 'Aplicar filtros' }).click();
await viewer.waitForTimeout(800);

// detalhe da linha (coluna oculta)
await viewer.locator('button[aria-label="Visualizar detalhamento"]').first().click();
await viewer.waitForSelector('[role=dialog]', { timeout: 5000 });
const detailHasValue = await viewer.evaluate(() => document.querySelector('[role=dialog]')?.textContent?.includes('Valor'));
check(!!detailHasValue, 'modal de detalhe mostra o campo oculto (Valor)');
await viewer.screenshot({ path: `${OUT}/viewer-detalhe.png` });
await viewer.keyboard.press('Escape');

// drill-down: clique numa barra/fatia
{
  const box = await viewer.locator('canvas').first().boundingBox();
  if (box) {
    await viewer.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 20);
    await viewer.waitForTimeout(900);
    const drillOpen = await viewer.locator('[role=dialog]').count();
    check(drillOpen > 0, 'clique na fatia abre o drill-down com os registros do segmento');
    if (drillOpen) {
      await viewer.screenshot({ path: `${OUT}/viewer-drilldown.png` });
      // drill-down também exporta (CSV/XLSX dentro do modal)
      const drillExports = await viewer.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].filter((b) => /CSV|XLSX/.test(b.textContent ?? '')).length);
      check(drillExports === 2, `modal de drill-down tem export CSV/XLSX (${drillExports})`);
    }
    await viewer.keyboard.press('Escape');
  }
}

// export CSV baixa arquivo
{
  const dl = viewer.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  await viewer.locator('button', { hasText: 'CSV' }).first().click();
  const file = await dl;
  check(!!file, `export CSV baixou arquivo: ${file ? await file.suggestedFilename() : '—'}`);
}

// mobile (na própria aba do relatório)
await viewer.setViewportSize({ width: 375, height: 812 });
await viewer.waitForTimeout(800);
check(!(await viewer.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), 'viewer mobile sem scroll horizontal');
await viewer.screenshot({ path: `${OUT}/viewer-mobile.png` });
await viewer.close();

// relatório SEM coluna oculta (tabela default) → botão de detalhe NÃO aparece
viewer = await abrirRelatorio(porUnidade.nome);
await viewer.waitForSelector('text=Obter dados mais recentes', { timeout: 20000 });
await viewer.waitForTimeout(1000);
const noHidden = await viewer.evaluate(() => document.querySelectorAll('button[aria-label="Visualizar detalhamento"]').length);
check(noHidden === 0, `sem coluna oculta → sem botão de detalhe (${noHidden})`);
await viewer.close();

// paginação da tabela (relatório com 25 linhas → 2 páginas)
viewer = await abrirRelatorio(paginada.nome);
await viewer.waitForSelector('text=Obter dados mais recentes', { timeout: 20000 });
await viewer.waitForTimeout(1000);
check(await viewer.evaluate(() => document.body.innerText.includes('1 / 2')), 'tabela paginada mostra pager 1 / 2');
check(await viewer.evaluate(() => document.body.innerText.includes('Item 01') && !document.body.innerText.includes('Item 25')), 'página 1 mostra os 20 primeiros');
await viewer.locator('button', { hasText: '›' }).click();
await viewer.waitForTimeout(400);
check(await viewer.evaluate(() => document.body.innerText.includes('Item 25')), 'página 2 mostra o restante');
await viewer.close();

// Cards dos componentes no grid de 12 colunas do builder.
const cardsDoGrid = () => page.locator('section', { hasText: 'Componentes do relatório' }).last().locator('[draggable="true"]');

// ── 2. Builder: abrir, ver campos da origem, adicionar bloco, salvar, preview ─
await page.goto(`${BASE}/reports/edit?key=${painel.key}`, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Origem dos dados', { timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/builder-desktop.png`, fullPage: true });

const builder = await page.evaluate(() => ({
  blocks: ['KPI', 'Pizza', 'Barras'].some((t) => document.body.innerText.includes(t)),
  publishedNote: /v\d+ · (publicado \(editar cria novo rascunho\)|draft)/.test(document.body.innerText),
}));
check(builder.blocks, 'builder mostra os blocos existentes');
check(builder.publishedNote, 'builder indica versão e status (publicado→novo rascunho / rascunho)');

// aba Origem: lista os campos da fonte com tipo e rótulo editável
await page.locator('nav button', { hasText: 'Origem' }).click();
await page.waitForTimeout(600);
check(await page.evaluate(() => document.body.innerText.includes('value') && document.body.innerText.includes('label')),
  'builder lista os campos da origem com tipos');

// adicionar um bloco KPI pelo modal e salvar rascunho → vira v2 draft
await page.locator('nav button', { hasText: 'Blocos' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Adicionar componente' }).first().click();
await page.waitForSelector('[role=dialog]', { timeout: 8000 });
await page.getByRole('button', { name: 'KPI / Card', exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
await page.waitForTimeout(600);
await page.locator('button', { hasText: 'Salvar rascunho' }).click();
// O toast "Rascunho salvo" é transiente e some sozinho — sob carga da suíte cheia o
// POST+render passa de um tempo fixo (ou o toast já sumiu). Espera o SINAL real assim
// que ele aparece, não um tempo fixo.
const salvou = await page
  .waitForFunction(() => document.body.innerText.includes('Rascunho salvo'), { timeout: 12000 })
  .then(() => true)
  .catch(() => false);
check(salvou, 'salvar rascunho OK (toast)');

// Devolve o relatório demo ao estado original: sem isto cada execução deixaria
// mais um KPI no rascunho (a suíte tem de ser idempotente).
await cardsDoGrid().last().locator('button[aria-label="Remover bloco"]').click();
await page.locator('button', { hasText: 'Salvar rascunho' }).click();
await page.waitForTimeout(1800);

// preview com dados reais (aba Preview do builder)
await page.locator('nav button', { hasText: 'Preview' }).click();
await page.waitForSelector('text=Obter dados mais recentes', { timeout: 20000 });
await page.waitForTimeout(1500);
const previewOk = await page.evaluate(() => document.querySelectorAll('canvas').length >= 2 && /Dados de \d{2}\/\d{2}\/\d{4}/.test(document.body.innerText));
check(previewOk, 'preview executa o rascunho com dados reais + timestamp');
await page.screenshot({ path: `${OUT}/builder-preview.png`, fullPage: true });

// catálogo continua servindo a v1 publicada (rascunho v2 não vazou)
await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
check(await cardDoRelatorio(painel.nome).count() > 0, 'catálogo segue com a versão publicada após criar rascunho v2');

// ── 3. Builder: controles avançados e regras de acesso ──────────────────────
await page.goto(`${BASE}/reports/edit?key=${painel.key}`, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Origem dos dados', { timeout: 15000 });
await page.waitForTimeout(600);

// blocos posicionáveis no grid da página (arrastar) + editor no modal
const cards = cardsDoGrid();
check(await cards.count() >= 4, `blocos arrastáveis para reposicionar no grid (${await cards.count()})`);

// ordenação / formatação / filtros do bloco vivem no modal do componente
// (o ✎ só aparece no hover — duplo-clique no card abre o mesmo editor).
// Usa o bloco de TABELA: é o que oferece os três controles.
await cards.filter({ hasText: 'Tabela' }).first().dblclick();
await page.waitForSelector('[role=dialog]', { timeout: 8000 });
await page.waitForTimeout(800);
const modal = await page.evaluate(() => {
  const t = (document.querySelector('[role=dialog]')?.innerText ?? '').toUpperCase();
  return {
    sort: t.includes('ORDENAÇÃO'),
    format: t.includes('MOEDA (R$)'),      // formatação é por coluna (Automático/Número/Moeda/Data/Texto)
    blockFilters: t.includes('FILTROS DO COMPONENTE'),
    grid: t.includes('TAMANHO NO GRID'),
  };
});
check(modal.sort && modal.format && modal.blockFilters && modal.grid,
  `modal do componente tem ordenação/formatação/filtros próprios/tamanho no grid (${JSON.stringify(modal)})`);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// aba Acesso: cria regra "Todos permitir" e salva
await page.locator('nav button', { hasText: 'Acesso' }).click();
await page.waitForSelector('text=Quem pode ver este relatório', { timeout: 10000 });
await page.locator('button', { hasText: 'Nova regra' }).click();
await page.waitForTimeout(300);
await page.locator('button', { hasText: 'Salvar regras' }).click();
await page.waitForTimeout(800);
check(await page.evaluate(() => document.body.innerText.includes('Regras de acesso salvas')), 'regra de acesso salva pela UI');
await page.screenshot({ path: `${OUT}/builder-acesso.png` });

// recarrega e confere persistência da regra
await page.reload({ waitUntil: 'networkidle' });
await page.locator('nav button', { hasText: 'Acesso' }).click();
await page.waitForTimeout(800);
check(await page.evaluate(() => document.body.innerText.includes('Todos os usuários')), 'regra persiste após recarregar');

console.log(failures === 0 ? 'PASSOU (todos os casos)' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

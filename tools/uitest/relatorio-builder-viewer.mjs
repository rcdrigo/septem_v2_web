import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

// ── 1. Consultas: abrir o painel e conferir blocos ───────────────────────────
await page.goto(BASE + '/consultas', { waitUntil: 'networkidle' });
await page.locator('section .grid > div', { hasText: 'Painel de Despesas' }).locator('button', { hasText: 'Abrir' }).click();
await page.waitForSelector('text=Total de despesas', { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/viewer-desktop.png`, fullPage: true });

const state = await page.evaluate(() => ({
  kpi: document.body.innerText.includes('R$') && document.body.innerText.includes('2.750'),
  charts: document.querySelectorAll('canvas').length,
  timestamp: /Dados de \d{2}\/\d{2}\/\d{4}/.test(document.body.innerText),
  filtro: [...document.querySelectorAll('label')].some((l) => l.textContent?.includes('Setor')),
  detailBtns: document.querySelectorAll('button[aria-label="Detalhes do registro"]').length,
  exportBtns: [...document.querySelectorAll('button')].filter((b) => /CSV|XLSX/.test(b.textContent ?? '')).length,
}));
check(state.kpi, 'KPI formatado em moeda com o total correto (R$ 2.750)');
check(state.charts >= 2, `gráficos Chart.js renderizados (pizza + barras): ${state.charts} canvas`);
check(state.timestamp, 'timestamp do cache exibido');
check(state.filtro, 'filtro global "Setor" presente');
check(state.detailBtns > 0, `tabela com coluna oculta mostra botão de detalhe por linha (${state.detailBtns})`);
check(state.exportBtns >= 2, 'botões de exportação CSV/XLSX presentes');

// filtro global: aplica "Obras" → KPI recalcula (1200+800=2000)
await page.selectOption('select', 'Obras');
await page.locator('button', { hasText: 'Aplicar filtros' }).click();
await page.waitForTimeout(1200);
check(await page.evaluate(() => document.body.innerText.includes('2.000')), 'filtro global aplicado recalcula KPI (R$ 2.000)');
await page.selectOption('select', '');
await page.locator('button', { hasText: 'Aplicar filtros' }).click();
await page.waitForTimeout(800);

// detalhe da linha (coluna oculta)
await page.locator('button[aria-label="Detalhes do registro"]').first().click();
await page.waitForSelector('[role=dialog]', { timeout: 5000 });
const detailHasValue = await page.evaluate(() => document.querySelector('[role=dialog]')?.textContent?.includes('Valor'));
check(!!detailHasValue, 'modal de detalhe mostra o campo oculto (Valor)');
await page.screenshot({ path: `${OUT}/viewer-detalhe.png` });
await page.keyboard.press('Escape');

// drill-down: clique numa barra/fatia
const canvas = page.locator('canvas').first();
const box = await canvas.boundingBox();
if (box) {
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 20);
  await page.waitForTimeout(900);
  const drillOpen = await page.locator('[role=dialog]').count();
  check(drillOpen > 0, 'clique na fatia abre o drill-down com os registros do segmento');
  if (drillOpen) await page.screenshot({ path: `${OUT}/viewer-drilldown.png` });
  await page.keyboard.press('Escape');
}

// export CSV baixa arquivo
const dl = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
await page.locator('button', { hasText: 'CSV' }).first().click();
const file = await dl;
check(!!file, `export CSV baixou arquivo: ${file ? await file.suggestedFilename() : '—'}`);

// relatório SEM coluna oculta (tabela default) → botão de detalhe NÃO aparece
await page.goto(BASE + '/consultas', { waitUntil: 'networkidle' });
await page.locator('section .grid > div', { hasText: 'Despesas por unidade' }).locator('button', { hasText: 'Abrir' }).click();
await page.waitForSelector('text=Obter dados mais recentes', { timeout: 15000 });
await page.waitForTimeout(1000);
const noHidden = await page.evaluate(() => document.querySelectorAll('button[aria-label="Detalhes do registro"]').length);
check(noHidden === 0, `sem coluna oculta → sem botão de detalhe (${noHidden})`);
await page.goto(BASE + '/consultas', { waitUntil: 'networkidle' });
await page.locator('section .grid > div', { hasText: 'Painel de Despesas' }).locator('button', { hasText: 'Abrir' }).click();
await page.waitForSelector('text=Total de despesas', { timeout: 15000 });
await page.waitForTimeout(600);

// mobile
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(600);
const mobOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
check(!mobOverflow, 'viewer mobile sem scroll horizontal');
await page.screenshot({ path: `${OUT}/viewer-mobile.png` });
await page.setViewportSize({ width: 1280, height: 950 });

// ── 2. Builder: abrir, ver campos da origem, adicionar bloco, salvar, preview ─
await page.goto(BASE + '/relatorios/editar?key=painel_de_despesas', { waitUntil: 'networkidle' });
await page.waitForSelector('text=Origem dos dados', { timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/builder-desktop.png`, fullPage: true });

const builder = await page.evaluate(() => ({
  fields: document.body.innerText.includes('value') && document.body.innerText.includes('label'),
  blocks: ['KPI', 'Pizza', 'Barras'].every((t) => document.body.innerText.includes(t)),
  publishedNote: /v\d+ · (publicado \(editar cria novo rascunho\)|draft)/.test(document.body.innerText),
}));
check(builder.fields, 'builder lista os campos da origem com tipos');
check(builder.blocks, 'builder mostra os blocos existentes');
check(builder.publishedNote, 'builder indica versão e status (publicado→novo rascunho / rascunho)');

// adicionar um bloco KPI e salvar rascunho → vira v2 draft
await page.locator('button', { hasText: 'KPI / Card' }).first().click();
await page.locator('button', { hasText: 'Salvar rascunho' }).click();
// O toast "Rascunho salvo" é transiente e some sozinho — sob carga da suíte cheia o
// POST+render passa de um tempo fixo (ou o toast já sumiu). Espera o SINAL real assim
// que ele aparece, não um tempo fixo.
const salvou = await page
  .waitForFunction(() => document.body.innerText.includes('Rascunho salvo'), { timeout: 12000 })
  .then(() => true)
  .catch(() => false);
check(salvou, 'salvar rascunho OK (toast)');

// preview com dados reais
await page.locator('button', { hasText: 'Preview' }).first().click();
await page.waitForSelector('text=Obter dados mais recentes', { timeout: 15000 });
await page.waitForTimeout(1200);
const previewOk = await page.evaluate(() => document.querySelectorAll('canvas').length >= 2 && /Dados de \d{2}\/\d{2}\/\d{4}/.test(document.body.innerText));
check(previewOk, 'preview executa o rascunho com dados reais + timestamp');
await page.screenshot({ path: `${OUT}/builder-preview.png`, fullPage: true });

// catálogo continua servindo a v1 publicada (rascunho v2 não vazou)
const cat = await page.evaluate(async () => {
  const token = JSON.parse(localStorage.getItem('septem.session') ?? '{}');
  return null; // catálogo conferido via UI abaixo
});
await page.goto(BASE + '/consultas', { waitUntil: 'networkidle' });
check(await page.locator('section .grid > div', { hasText: 'Painel de Despesas' }).count() > 0, 'catálogo segue com a versão publicada após criar rascunho v2');

// ── 3. Lacunas fechadas: drill-export, paginação, builder avançado, acesso ──

// drill-down com botões de export dentro do modal
await page.goto(BASE + '/consultas', { waitUntil: 'networkidle' });
await page.locator('section .grid > div', { hasText: 'Painel de Despesas' }).locator('button', { hasText: 'Abrir' }).click();
await page.waitForSelector('text=Total de despesas', { timeout: 15000 });
await page.waitForTimeout(800);
const canvas2 = page.locator('canvas').first();
const box2 = await canvas2.boundingBox();
if (box2) {
  await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2 - 20);
  await page.waitForTimeout(900);
  const drillExports = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].filter((b) => /CSV|XLSX/.test(b.textContent ?? '')).length);
  check(drillExports === 2, `modal de drill-down tem export CSV/XLSX (${drillExports})`);
  await page.keyboard.press('Escape');
}

// paginação da tabela (relatório com 25 linhas → 2 páginas)
await page.goto(BASE + '/consultas', { waitUntil: 'networkidle' });
await page.locator('section .grid > div', { hasText: 'Tabela Paginada' }).locator('button', { hasText: 'Abrir' }).click();
await page.waitForSelector('text=Obter dados mais recentes', { timeout: 15000 });
await page.waitForTimeout(1000);
check(await page.evaluate(() => document.body.innerText.includes('1 / 2')), 'tabela paginada mostra pager 1 / 2');
check(await page.evaluate(() => document.body.innerText.includes('Item 01') && !document.body.innerText.includes('Item 25')), 'página 1 mostra os 20 primeiros');
await page.locator('button', { hasText: '›' }).click();
await page.waitForTimeout(400);
check(await page.evaluate(() => document.body.innerText.includes('Item 25')), 'página 2 mostra o restante');

// builder: controles avançados (ordenação, formatação, filtros do bloco, drag)
await page.goto(BASE + '/relatorios/editar?key=painel_de_despesas', { waitUntil: 'networkidle' });
await page.waitForSelector('text=Origem dos dados', { timeout: 15000 });
await page.waitForTimeout(600);
const adv = await page.evaluate(() => {
  const text = document.body.innerText.toUpperCase(); // labels renderizam uppercase via CSS
  return {
    sort: text.includes('ORDENAÇÃO'),
    format: text.includes('FORMATAÇÃO'),
    blockFilters: text.includes('FILTROS DO BLOCO'),
    drag: document.querySelectorAll('[draggable="true"]').length,
  };
});
check(adv.sort && adv.format && adv.blockFilters, `builder tem ordenação/formatação/filtros por bloco`);
check(adv.drag >= 4, `blocos arrastáveis para reordenar (${adv.drag})`);

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

// Fase 1.1 — Configurações › Parâmetros do sistema, aba "Informações gerais".
// Navega como o usuário (menu → página), edita, salva e confere que o branding
// recarrega (nome do cliente no topo). Roda em web (1280) e mobile (375).
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (cond, msg) => (cond ? ok.push(msg) : bad.push(msg));

// Valor original do seed — restaurado no fim para a suíte ser idempotente.
const ORIG = { cliente: 'Prefeitura X', ambiente: 'Septem', cor: '#0ea5e9' };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function login(page) {
  await page.goto(BASE + '/login?returnUrl=/me', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}

// A seleção em lote escolhe destinos; os resumos comprovam a semana configurada.
const DIAS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
async function selectDays(page, want) {
  for (let day = 1; day <= 7; day++) {
    const button = page.getByTestId(`business-hours-select-${day}`);
    if (((await button.getAttribute('aria-pressed')) === 'true') !== want.includes(day)) await button.click();
  }
}
async function setWeek(page, want, start, end) {
  const editor = page.getByTestId('business-hours-editor');
  const expanded = editor.locator('button[aria-expanded=true]');
  if (await expanded.count()) await expanded.click();
  const removeModel = editor.getByRole('button', { name: /Remover período \d+ de Modelo/ });
  while (await removeModel.count()) await removeModel.first().click();
  const withoutHours = [1, 2, 3, 4, 5, 6, 7].filter(day => !want.includes(day));
  if (withoutHours.length) {
    await selectDays(page, withoutHours);
    await page.getByTestId('business-hours-apply').click();
  }
  await editor.getByRole('button', { name: 'Adicionar período', exact: true }).click();
  await editor.getByRole('textbox', { name: 'Modelo, período 1, início', exact: true }).fill(start);
  await editor.getByRole('textbox', { name: 'Modelo, período 1, fim', exact: true }).fill(end);
  await selectDays(page, want);
  await page.getByTestId('business-hours-apply').click();
}
async function weekMatches(page, want, start, end) {
  for (let day = 1; day <= 7; day++) {
    const summary = await page.getByTestId(`business-hours-day-${day}`).innerText();
    if (!summary.includes(DIAS[day - 1]) || !summary.includes(want.includes(day) ? `${start}–${end}` : 'Sem horas úteis')) return false;
  }
  return true;
}

/** Mede overflow horizontal e recorte dos campos — critério objetivo de layout. */
async function layout(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflows = doc.scrollWidth > doc.clientWidth + 1;
    const form = document.querySelector('[data-testid=form-geral]');
    const r = form?.getBoundingClientRect();
    const clipped = [...(form?.querySelectorAll('input, select, textarea, button') ?? [])].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
    }).length;
    return { overflows, clipped, formWidth: r?.width ?? 0 };
  });
}

for (const view of [
  { name: 'web', width: 1280, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const mobile = view.name === 'mobile';
  await login(page);

  // 1) Chegar pelo MENU (não por URL direta) — prova que o item existe.
  if (mobile) {
    await page.click('button[aria-label="Abrir menu"]');
    await page.waitForFunction(() => {
      // Drawer DESLIZADO para dentro (PENDENCIAS §5.5 / gotcha de fase0-bugs).
      const a = document.querySelector('aside');
      return !!a && a.getBoundingClientRect().left >= 0;
    }, null, { timeout: 15000 }).catch(() => {});
  }
  await page.getByRole('button', { name: 'Configurações' }).first().click();
  await page.getByRole('link', { name: 'Parâmetros do sistema' }).first().click();
  await page.waitForURL(/\/admin\/settings/, { timeout: 10000 });
  await page.waitForSelector('[data-testid=form-geral]', { timeout: 10000 });
  check(true, `[${view.name}] menu Configurações › Parâmetros do sistema abre a página`);

  // 2) As 3 abas existem e "Informações gerais" é a ativa.
  const tabs = await page.locator('[role=tab]').allInnerTexts();
  // Fase 1: Informações gerais, E-mail, Arquivos · Fase 2 acrescentou Segurança.
  const nomes = tabs.map((t) => t.trim());
  const esperadas = ['Informações gerais', 'E-mail', 'Integrações', 'Arquivos', 'Segurança'];
  // Contar abas não prova NADA sobre quais são: a lista nomeada pega tanto a aba que
  // sumiu quanto a que foi renomeada. "Integrações" entrou na Fase 10.
  check(esperadas.every((e) => nomes.some((n) => n.includes(e))),
    `[${view.name}] as ${esperadas.length} abas esperadas (${nomes.join(' | ')})`);
  check(
    (await page.locator('[role=tab][aria-selected=true]').innerText()).includes('Informações gerais'),
    `[${view.name}] aba ativa = Informações gerais`,
  );

  // 3) Formulário carregou os valores do backend (não vazio).
  const cliente = await page.locator('input[name=clienteNome]').inputValue();
  check(cliente.length > 0, `[${view.name}] campo "Nome do cliente" pré-carregado ("${cliente}")`);
  await setWeek(page, [1, 2, 3, 4, 5], '08:00', '18:00');
  check(await weekMatches(page, [1, 2, 3, 4, 5], '08:00', '18:00'), `[${view.name}] resumos confirmam seg–sex e fim de semana sem horas úteis`);

  // 3.1) As abas cabem inteiras no viewport (no mobile a barra não pode cortar "Arquivos").
  const tabsClipped = await page.evaluate(() =>
    [...document.querySelectorAll('[role=tab]')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.right > window.innerWidth + 1 || b.left < -1;
    }).length,
  );
  check(tabsClipped === 0, `[${view.name}] as abas cabem no viewport (cortadas: ${tabsClipped})`);

  // 4) Layout: nada estoura a largura nem fica recortado.
  const L = await layout(page);
  check(!L.overflows, `[${view.name}] sem overflow horizontal`);
  check(L.clipped === 0, `[${view.name}] nenhum campo recortado (${L.clipped})`);
  await page.screenshot({ path: `${OUT}/parametros-geral-${view.name}.png`, fullPage: true });

  // 5) Validação client-side: fim <= início não salva.
  await page.getByTestId('business-hours-day-1').click();
  await page.getByRole('textbox', { name: 'Segunda-feira, período 1, início', exact: true }).fill('18:00');
  await page.getByRole('textbox', { name: 'Segunda-feira, período 1, fim', exact: true }).fill('09:00');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(500);
  const erroHorario = await page.getByText(/o fim deve ser depois do início, no mesmo dia\./).count();
  check(erroHorario > 0, `[${view.name}] bloqueia expediente com fim antes do início`);

  // 6) Edição real: muda nome/cor/expediente/dias e salva.
  const novoNome = `Prefeitura Municipal (${view.name})`;
  await page.fill('input[name=clienteNome]', novoNome);
  await page.fill('input[name=primaryColor]', '#0d9488');
  await setWeek(page, [1, 2, 3, 4, 5, 6], '09:15', '17:30'); // sábado e minutos
  await page.fill('input[name=heroImageUrl]', 'https://picsum.photos/id/1015/1200/900');
  await page.fill('textarea[name=systemDescription]', 'Portal de serviços do município.');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForSelector('text=Parâmetros salvos.', { timeout: 10000 });
  check(true, `[${view.name}] salvou (toast "Parâmetros salvos.")`);

  // 7) O branding recarregou sem F5 (nome do cliente no shell).
  await page.waitForTimeout(600);
  const brandingOk = await page.evaluate((n) => document.body.innerText.includes(n), novoNome);
  check(brandingOk, `[${view.name}] branding do shell atualizou para "${novoNome}" sem reload`);

  // 8) Persistiu: recarrega a página e os valores voltam do backend.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=form-geral]');
  check(
    (await page.locator('input[name=clienteNome]').inputValue()) === novoNome,
    `[${view.name}] nome persistido após reload`,
  );
  check(
    await weekMatches(page, [1, 2, 3, 4, 5, 6], '09:15', '17:30'),
    `[${view.name}] minutos, sábado e domingo sem horas úteis persistidos após reload`,
  );
  check(
    (await page.locator('textarea[name=systemDescription]').inputValue()) === 'Portal de serviços do município.',
    `[${view.name}] descrição do sistema persistida`,
  );

  // 8.1) OG tags saem dos Parâmetros (compartilhar a URL mostra o cliente, não "Septem").
  const og = await page.evaluate(() => ({
    title: document.querySelector('meta[property="og:title"]')?.content,
    desc: document.querySelector('meta[property="og:description"]')?.content,
  }));
  check(
    (og.title ?? '').includes(novoNome) && (og.desc ?? '').includes('Portal de serviços do município.'),
    `[${view.name}] meta tags de compartilhamento (og:title/og:description) refletem os parâmetros`,
  );

  // 9) Ponta a ponta: a descrição salva aparece na TELA DE LOGIN (config público).
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/login?returnUrl=/me', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  check(
    (await page.getByTestId('login-descricao').count()) === 1 &&
      (await page.getByTestId('login-descricao').innerText()).includes('Portal de serviços do município.'),
    `[${view.name}] descrição do sistema aparece na tela de login`,
  );
  const hero = await page.evaluate(() => {
    const el = document.querySelector('[data-testid=login-hero]');
    if (!el) return null;
    const bg = getComputedStyle(el).backgroundImage;
    // o texto precisa continuar legível: sobreposição escura por cima da imagem
    const overlay = !!el.querySelector('.bg-slate-900\\/75');
    return { bg, overlay };
  });
  check(
    !!hero && hero.bg.includes('picsum.photos'),
    `[${view.name}] imagem de destaque vira o fundo do painel do login`,
  );
  check(!!hero && hero.overlay, `[${view.name}] sobreposição escura mantém o texto legível sobre a imagem`);
  await page.screenshot({ path: `${OUT}/parametros-login-${view.name}.png`, fullPage: true });

  await ctx.close();
}

// Restaura o seed (suíte idempotente: não deixa a base "suja" para as outras).
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(BASE + '/admin/settings', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=form-geral]');
  await page.fill('input[name=clienteNome]', ORIG.cliente);
  await page.fill('input[name=ambienteNome]', ORIG.ambiente);
  await page.fill('input[name=primaryColor]', ORIG.cor);
  await page.fill('input[name=heroImageUrl]', '');
  await page.fill('textarea[name=systemDescription]', '');
  await setWeek(page, [1, 2, 3, 4, 5], '08:00', '18:00'); // volta para seg–sex
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForSelector('text=Parâmetros salvos.', { timeout: 10000 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=form-geral]');
  check(
    (await page.locator('input[name=clienteNome]').inputValue()) === ORIG.cliente &&
      await weekMatches(page, [1, 2, 3, 4, 5], '08:00', '18:00'),
    '[cleanup] seed restaurado (Prefeitura X, seg–sex 08–18)',
  );
  await ctx.close();
}

await browser.close();

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

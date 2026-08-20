// Fase 5d — UX de fontes de dados + responsáveis/prazos no painel da tarefa.
//  - Rotinas: UM só botão "Nova fonte de dados" acima dos 4 seletores (cada seletor
//    não repete o seu); ícone de atualizar em TODO seletor de fonte.
//  - Ao selecionar uma fonte, aparece o link "Editar fonte selecionada".
//  - Setor (5b): ganha o mesmo ícone de atualizar (re-lê as raias sem F5).
//  - Responsáveis e prazos: rótulo encurtado "…OU CAMPO"; ao escolher campo, o prazo
//    em horas é LIMPO (efeito, não só a tela).
// Modelador é desktop (canvas some no mobile) → web 1280. Usa o processo seedado
// teste_condicoes_ui (tem tarefa + campos de formulário) e NÃO salva (não polui o seed).
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (token, path, method = 'GET', body) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;

// Garante ao menos uma fonte de dados no catálogo (para testar o link "editar").
let sources = (await api(token, '/api/v1/data-sources')).body ?? [];
if (!Array.isArray(sources) || sources.length === 0) {
  const rid = Math.floor(Math.random() * 1e9);
  await api(token, '/api/v1/data-sources', 'POST', { name: `Fonte UX ${rid}`, type: 'fixed', scope: 'process', config: { options: [] } });
  sources = (await api(token, '/api/v1/data-sources')).body ?? [];
}
check(Array.isArray(sources) && sources.length > 0, `[api] há fonte(s) de dados no catálogo (${sources.length})`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  await page.goto(`${BASE}/flows/edit?key=teste_condicoes_ui`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
  await page.locator('[data-element-id="T005"]').click();
  await page.waitForSelector('section:has(h3:has-text("Rotinas"))', { timeout: 10000 });
  await page.waitForTimeout(800);

  // ── Rotinas: 1 botão "Nova fonte de dados" + 4 ícones de atualizar ──
  const rotinas = page.locator('section', { has: page.locator('h3', { hasText: 'Rotinas' }) });
  const novasNaRotina = await rotinas.locator('button', { hasText: 'Nova fonte de dados' }).count();
  check(novasNaRotina === 1, `[web] Rotinas tem UM só botão "Nova fonte de dados" (${novasNaRotina})`);
  const refreshNaRotina = await rotinas.locator('button[aria-label="Atualizar fontes de dados"]').count();
  check(refreshNaRotina === 4, `[web] cada um dos 4 seletores de fonte tem ícone de atualizar (${refreshNaRotina})`);

  // ── Setor (5b) ganhou o ícone de atualizar ──
  const setorRefresh = await page.locator('button[aria-label="Atualizar raias"]').count();
  check(setorRefresh >= 1, `[web] o campo Setor tem ícone de atualizar as raias (${setorRefresh})`);

  // ── Responsáveis e prazos: rótulo "…OU CAMPO" ──
  const prazos = page.locator('section', { has: page.locator('h3', { hasText: 'Responsáveis e prazos' }) });
  const temOuCampo = await prazos.locator('label', { hasText: 'OU CAMPO' }).count();
  check(temOuCampo === 1, `[web] rótulo encurtado "…OU CAMPO" presente (${temOuCampo})`);

  // Opções do combobox ABERTO (escopadas ao painel via o input de busca — há
  // outros <ul> na página; um `ul li button` global pegaria a lista errada).
  const openPanelOptions = () => page.locator('input[placeholder="Pesquisar…"]').locator('xpath=../../ul/li/button');

  // ── EFEITO 1: selecionar uma fonte em Rotinas revela "Editar fonte selecionada" ──
  const primeiroSeletor = rotinas.locator('label', { hasText: 'Pré-criação' }).locator('button').first();
  await primeiroSeletor.click();
  await page.waitForSelector('input[placeholder="Pesquisar…"]', { timeout: 5000 });
  await openPanelOptions().nth(1).click(); // 1ª fonte real (após o "— nenhuma —")
  await page.waitForTimeout(400);
  const editarLink = await rotinas.locator('button', { hasText: 'Editar fonte selecionada' }).count();
  check(editarLink >= 1, `[web] ao selecionar uma fonte, aparece "Editar fonte selecionada" (${editarLink})`);

  // ── EFEITO 2: preencher prazo em horas e escolher campo → horas é LIMPO ──
  const horas = prazos.locator('label', { hasText: 'Prazo (horas)' }).locator('input').first();
  await horas.fill('48');
  await horas.blur();
  await page.waitForTimeout(200);
  const antes = await horas.inputValue();
  const ouCampoBtn = prazos.locator('label', { hasText: 'OU CAMPO' }).locator('button').first();
  await ouCampoBtn.click();
  await page.waitForSelector('input[placeholder="Pesquisar…"]', { timeout: 5000 });
  const nOpts = await openPanelOptions().count();
  await openPanelOptions().nth(1).click(); // 1º campo real (após "— nenhum —")
  await page.waitForTimeout(400);
  const depois = await horas.inputValue();
  check(antes === '48' && depois === '', `[web] escolher campo LIMPA o prazo em horas (antes="${antes}" depois="${depois}", ${nOpts} opções)`);

  // ── EFEITO 3: o ícone de ATUALIZAR realmente refaz o fetch (fonte criada em outra
  //    aba aparece sem recarregar a página) — provar o efeito, não só o ícone existir. ──
  const seletorPos = rotinas.locator('label', { hasText: 'Pós-criação' }).locator('button').first();
  await seletorPos.click();
  await page.waitForSelector('input[placeholder="Pesquisar…"]', { timeout: 5000 });
  const optsAntes = await openPanelOptions().count();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  // Cria uma fonte NOVA no backend (simula "criei numa outra aba").
  const novoNome = `Fonte Refresh ${Math.floor(Math.random() * 1e9)}`;
  await api(token, '/api/v1/data-sources', 'POST', { name: novoNome, type: 'fixed', scope: 'process', config: { options: [] } });
  // Sem refresh, a lista em memória ainda é a antiga. Clica no ícone de atualizar do seletor.
  await rotinas.locator('label', { hasText: 'Pós-criação' }).locator('button[aria-label="Atualizar fontes de dados"]').click();
  await page.waitForTimeout(800);
  await seletorPos.click();
  await page.waitForSelector('input[placeholder="Pesquisar…"]', { timeout: 5000 });
  await page.fill('input[placeholder="Pesquisar…"]', 'Refresh');
  await page.waitForTimeout(300);
  const achouNova = await openPanelOptions().filter({ hasText: novoNome }).count();
  const optsDepois = optsAntes + 1;
  check(achouNova >= 1, `[web] o ícone de atualizar REFAZ o fetch — a fonte nova "${novoNome}" aparece sem F5 (antes ${optsAntes} → agora inclui a nova)`);
  void optsDepois;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ── Painel sem overflow horizontal (controles novos não estouram) ──
  const panelOverflow = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent?.includes('Rotinas'));
    const panel = sec?.parentElement;
    if (!panel) return { found: false };
    return { found: true, overflows: panel.scrollWidth > panel.clientWidth + 1 };
  });
  check(panelOverflow.found && !panelOverflow.overflows, `[web] painel de propriedades sem overflow horizontal (${JSON.stringify(panelOverflow)})`);

  await page.screenshot({ path: `${OUT}/fonte-dados-ux.png`, fullPage: true });
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

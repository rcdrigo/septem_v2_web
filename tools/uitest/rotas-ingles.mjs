// Fase 1 (requisitos 2026-08-03): as rotas do SPA passaram para o inglês.
//
// Decisão do dono (resposta 1): as rotas antigas em português foram DESCARTADAS,
// sem camada de redirect. Então esta suíte prova duas coisas opostas:
//   (a) cada rota NOVA renderiza a tela certa — asserção do <h1> real, não de a
//       página existir. Cair no curinga também "existe", e passaria em falso;
//   (b) cada rota ANTIGA morreu e cai num 404 que oferece SAÍDA — e o botão da
//       saída é CLICADO, porque botão que não leva a lugar nenhum passa em falso.
//
// O trio sob /reports tem seção própria: catálogo, visualização e edição dividem
// prefixo, e é onde um `path` trocado passaria despercebido.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

// rota nova → <h1> exato da tela (colhido da aplicação real, não suposto)
const TELAS = [
  ['/tasks', 'Tarefas'],
  ['/requests', 'Requisições'],
  ['/reports', 'Consultas'],
  ['/orgchart', 'Organograma'],
  ['/dashboard', 'Dashboard'],
  ['/admin/flows', 'Processos'],
  ['/admin/email-templates', 'Modelos de e-mail'],
  ['/admin/document-templates', 'Modelos de documentos'],
  ['/admin/data-sources', 'Fontes de dados · Processos'],
  ['/admin/reports', 'Relatórios'],
  ['/admin/settings', 'Parâmetros do sistema'],
  ['/admin/manuals', 'Manuais'],
  ['/admin/users', 'Usuários'],
  ['/admin/org-units', 'Unidades organizacionais'],
  ['/admin/positions', 'Posições'],
  ['/admin/profiles', 'Perfis de acesso'],
  ['/admin/logs', 'Logs de auditoria'],
  ['/me', 'Meus dados'],
];

// rotas antigas em português — todas devem estar mortas
const MORTAS = [
  '/tarefas', '/requisicoes', '/consultas', '/consultas/ver', '/organograma',
  '/processos/editar', '/relatorios/editar', '/unidade', '/campos-servico',
  '/suporte', '/modelador', '/me/senha',
  '/admin/processos', '/admin/usuarios', '/admin/parametros', '/admin/perfis',
  '/admin/unidades', '/admin/posicoes', '/admin/manuais', '/admin/relatorios',
  '/admin/modelos-email', '/admin/modelos-doc', '/admin/fontes-dados',
];

// O backend também GERA caminho de SPA (busca global, favoritos). A expectativa da
// costura é derivada da própria API — não hardcoded — e depois conferida na tela.
const apiGet = async (t, path) => {
  const r = await fetch(API + path, { headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${t}` } });
  return r.json().catch(() => null);
};
const apiToken = await (await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x' },
  body: JSON.stringify({ identifier: 'admin@prefeitura-x.local', password: 'admin123' }),
})).json().then((b) => b.accessToken);

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const estado = () => page.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent?.trim() ?? '',
  perdida: document.body.textContent?.includes('Página não encontrada') ?? false,
  acao: document.querySelector('[data-testid=stub-action]')?.textContent?.trim() ?? null,
  url: location.pathname + location.search,
}));

try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20000 });

  // O login manda para a rota nova, não para /tarefas. O `waitForURL` acima dispara
  // ainda em "/" — o redirect do índice (<Navigate to=/tasks>) só resolve no render
  // seguinte, então esperar a rota final é obrigatório, senão o check lê "/".
  await page.waitForURL((u) => u.pathname.startsWith('/tasks'), { timeout: 10000 }).catch(() => {});
  check(page.url().includes('/tasks'), `[web] login cai em /tasks (url: ${page.url()})`);

  // ── 1) Cada rota nova renderiza a tela certa ───────────────────────────────
  for (const [rota, titulo] of TELAS) {
    await page.goto(BASE + rota, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const s = await estado();
    check(s.h1 === titulo && !s.perdida, `[web] ${rota} → "${titulo}" (veio "${s.h1}", 404=${s.perdida})`);
  }

  // ── 2) Rotas em aba própria (sem menu) ─────────────────────────────────────
  await page.goto(`${BASE}/flows/edit`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 20000 });
  check(true, '[web] /flows/edit abre o modelador BPMN (paleta presente)');

  await page.goto(`${BASE}/service-fields`, { waitUntil: 'networkidle' });
  check((await page.locator('body').innerText()).includes('CAMPOS DISPONÍVEIS'),
    '[web] /service-fields abre o catálogo de campos');

  await page.goto(`${BASE}/manual-templates`, { waitUntil: 'networkidle' });
  check((await estado()).h1 === 'Como montar um modelo de documento',
    '[web] /manual-templates abre a ajuda de modelos');

  await page.goto(`${BASE}/data-sources/nova`, { waitUntil: 'networkidle' });
  check((await estado()).h1 === 'Nova fonte de dados', '[web] /data-sources/nova abre o editor de fonte');

  await page.goto(`${BASE}/manuals/nova`, { waitUntil: 'networkidle' });
  check((await estado()).h1 === 'Novo manual', '[web] /manuals/nova abre o editor de manual');

  await page.goto(`${BASE}/org-unit`, { waitUntil: 'networkidle' });
  check((await page.locator('body').innerText()).includes('Informe a unidade'),
    '[web] /org-unit responde (pede o id em vez de 404)');

  // ── 3) O trio sob /reports resolve para telas DIFERENTES ───────────────────
  // Catálogo, visualização e edição dividem prefixo: é aqui que um path trocado
  // passaria batido, porque as três "funcionam".
  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  const catalogo = await estado();
  await page.goto(`${BASE}/reports/view`, { waitUntil: 'networkidle' });
  const visualizar = await estado();       // sem ?key= volta para o catálogo
  await page.goto(`${BASE}/reports/edit`, { waitUntil: 'networkidle' });
  const editar = await estado();           // sem ?key= volta para a administração
  check(catalogo.h1 === 'Consultas' && !catalogo.perdida, '[web] /reports = catálogo de consultas');
  check(visualizar.url.startsWith('/reports') && !visualizar.perdida,
    `[web] /reports/view sem chave volta ao catálogo (url: ${visualizar.url})`);
  check(editar.url.startsWith('/admin/reports') && !editar.perdida,
    `[web] /reports/edit sem chave volta à administração (url: ${editar.url})`);

  // ── 4) As rotas antigas morreram — e o 404 oferece saída ───────────────────
  let vivas = [];
  for (const rota of MORTAS) {
    await page.goto(BASE + rota, { waitUntil: 'networkidle' });
    const s = await estado();
    if (!s.perdida) vivas.push(`${rota}→${s.url}`);
  }
  check(vivas.length === 0, `[web] as ${MORTAS.length} rotas antigas caem no 404 (vivas: ${JSON.stringify(vivas)})`);

  // O botão do 404 é CLICADO: 404 sem saída é o que a decisão do dono pediu evitar.
  await page.goto(`${BASE}/tarefa/qualquer-coisa`, { waitUntil: 'networkidle' });
  const perdida = await estado();
  check(perdida.acao === 'Ir para Tarefas pendentes', `[web] o 404 oferece saída (botão: ${JSON.stringify(perdida.acao)})`);
  check((await page.locator('body').innerText()).includes('mudaram para o inglês'),
    '[web] o 404 explica que os endereços mudaram');
  await page.click('[data-testid=stub-action]');
  await page.waitForTimeout(600);
  const destino = await estado();
  check(destino.url.startsWith('/tasks') && destino.h1 === 'Tarefas',
    `[web] o botão do 404 leva mesmo a Tarefas (url: ${destino.url})`);
  await page.screenshot({ path: `${OUT}/rotas-404-desktop.png` });

  // ── 4b) COSTURA: o caminho gerado pelo BACKEND abre uma página de verdade ──
  // A API devolve o href pronto e o front faz openTab(item.href)
  // (GlobalSearchDialog.tsx). Testar só o texto do href na API e só as rotas no
  // SPA deixa a JUNÇÃO sem prova — e é nela que um caminho velho sobrevive calado.
  const achados = await apiGet(apiToken, '/api/v1/search?q=compra&type=service');
  const alvo = (achados?.items ?? [])[0];
  check(!!alvo?.href?.startsWith('/services/'),
    `[web] a API gera href de serviço em inglês (${JSON.stringify(alvo?.href)})`);

  await page.goto(BASE + '/tasks', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Buscar no Septem/i }).first().click();
  await page.locator('[role=dialog] input').first().fill('compra');
  await page.waitForTimeout(1500);
  const resultado = page.locator('[role=dialog] button', { hasText: alvo.title }).first();
  const [abaNova] = await Promise.all([ctx.waitForEvent('page'), resultado.click()]);
  await abaNova.waitForLoadState('networkidle');
  await abaNova.waitForTimeout(800);
  const destinoBusca = await abaNova.evaluate(() => ({
    path: location.pathname,
    perdida: document.body.textContent?.includes('Página não encontrada') ?? false,
    texto: (document.body.innerText || '').slice(0, 60),
  }));
  check(destinoBusca.path === alvo.href,
    `[web] clicar no resultado abre exatamente o href da API (${destinoBusca.path} vs ${alvo.href})`);
  check(!destinoBusca.perdida,
    `[web] e a página abre de verdade, não no 404 ("${destinoBusca.texto.replace(/\n/g, ' | ')}")`);
  await abaNova.close();

  // ── 5) Mobile 375: amostra + layout ────────────────────────────────────────
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [rota, titulo] of [['/tasks', 'Tarefas'], ['/reports', 'Consultas'], ['/admin/users', 'Usuários']]) {
    await page.goto(BASE + rota, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const s = await estado();
    check(s.h1 === titulo && !s.perdida, `[mobile] ${rota} → "${titulo}" (veio "${s.h1}")`);
  }
  await page.goto(`${BASE}/rota-que-nao-existe`, { waitUntil: 'networkidle' });
  const L = await page.evaluate(() => {
    const doc = document.documentElement;
    // Ignora o que está dentro do <aside>: no mobile o menu é uma gaveta off-canvas
    // (left ≈ -248) e estar fora da tela é a posição CORRETA dele, não um recorte.
    const clipped = [...document.querySelectorAll('button, a, img')].filter((el) => {
      if (el.closest('aside')) return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
    }).length;
    return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
  });
  check(!L.overflows, '[mobile] 404 sem overflow horizontal');
  check(L.clipped === 0, `[mobile] 404 sem controle recortado (${L.clipped})`);
  check(await page.locator('[data-testid=stub-action]').isVisible(), '[mobile] o botão de saída do 404 aparece');
  await page.screenshot({ path: `${OUT}/rotas-404-mobile.png` });
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

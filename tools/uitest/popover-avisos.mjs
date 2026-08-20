// Fase 5e — o popover de avisos/diagnóstico do modelador saía POR BAIXO do frame
// (era posicionado com `absolute` dentro de um contêiner com overflow) e ficava
// inacessível. Agora o Popover renderiza em PORTAL (document.body) com posição fixed.
// Este teste abre o badge na view FORMULÁRIO e prova: (a) o painel é filho do body
// (portal) e (b) cabe inteiro no viewport (não é cortado). Modelador é desktop → 1280.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

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
  await page.waitForSelector('[data-element-id="G1"]', { timeout: 20000 });
  await page.waitForTimeout(1000);

  // Vai para a view FORMULÁRIO (onde o bug foi reportado).
  await page.locator('header button, nav button', { hasText: 'Formulário' }).first().click();
  await page.waitForTimeout(1200);

  // O badge de diagnóstico mostra "Tudo certo" / "N avisos" / "N erros".
  const badge = page.locator('button', { hasText: /Tudo certo|avis|erro/ }).first();
  check(await badge.count() > 0, '[web] badge de avisos presente na view Formulário');
  await badge.click();
  await page.waitForTimeout(400);

  // O popover (header "Diagnóstico") deve existir, ser filho do body (portal) e
  // caber inteiro no viewport.
  const info = await page.evaluate(() => {
    const header = [...document.querySelectorAll('[role=menu]')].find((m) => m.textContent?.includes('Diagnóstico'));
    if (!header) return { found: false };
    const r = header.getBoundingClientRect();
    return {
      found: true,
      childOfBody: header.parentElement === document.body,
      rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) },
      vw: window.innerWidth,
      vh: window.innerHeight,
      dentro: r.top >= 0 && r.left >= 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
      visivel: r.width > 0 && r.height > 0,
    };
  });
  console.log('[popover]', JSON.stringify(info));
  check(info.found, '[web] popover de diagnóstico abre');
  check(info.childOfBody, '[web] popover é renderizado em PORTAL (filho de document.body)');
  check(info.visivel && info.dentro, '[web] popover cabe inteiro no viewport (não cortado pelo frame)');
  await page.screenshot({ path: `${OUT}/popover-avisos.png` });

  // Inspeciona o [role=menu] aberto que contém `texto` (portal + dentro do viewport).
  const inspectMenu = (texto) => page.evaluate((t) => {
    const m = [...document.querySelectorAll('[role=menu]')].find((el) => el.textContent?.includes(t));
    if (!m) return { found: false };
    const r = m.getBoundingClientRect();
    return {
      found: true,
      childOfBody: m.parentElement === document.body,
      dentro: r.top >= 0 && r.left >= 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
      visivel: r.width > 0 && r.height > 0,
    };
  }, texto);

  // ── Outros dois consumidores do Popover compartilhado (não regredir com o portal). ──
  // Recursos (dropdown do navbar do modelador).
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.locator('button', { hasText: 'Recursos' }).first().click();
  await page.waitForTimeout(300);
  const rec = await inspectMenu('');
  check(rec.found && rec.childOfBody && rec.visivel && rec.dentro, `[web] dropdown "Recursos" abre em portal e cabe no viewport (${JSON.stringify(rec)})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Menu do usuário (SidebarUser) — numa página do AppShell (align=left, fullWidth).
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('aside span', { hasText: 'admin@prefeitura-x.local' }).first().click();
  await page.waitForTimeout(300);
  const userMenu = await inspectMenu('Meus dados');
  check(userMenu.found && userMenu.childOfBody && userMenu.visivel && userMenu.dentro, `[web] menu do usuário abre em portal e cabe no viewport (${JSON.stringify(userMenu)})`);
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

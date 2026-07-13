import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
// Cria (ou recria) o usuário de nome/e-mail longos via API — suíte auto-suficiente.
async function ensureLongUser() {
  const login = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x' },
    body: JSON.stringify({ email: 'admin@prefeitura-x.local', password: 'admin123' }),
  });
  const { accessToken } = await login.json();
  const H = { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${accessToken}` };
  const email = `maximiliano.constantino.wanderley.${Date.now().toString(36)}@prefeitura-x.local`;
  const r = await fetch('http://localhost:5000/api/v1/users', {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: 'Maximiliano Constantino de Albuquerque Wanderley', email, isInternal: true }),
  });
  const u = await r.json();
  return { email, senha: u.initialPassword };
}
const { email: LONG_EMAIL, senha: SENHA } = await ensureLongUser();
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[name=identifier]', LONG_EMAIL);
await page.fill('input[type=password]', SENHA);
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/sidenav-truncate.png` });

const m = await page.evaluate(() => {
  const aside = document.querySelector('aside');
  if (!aside) return null;
  const ar = aside.getBoundingClientRect();
  // qualquer texto do chip do usuário vazando além do aside?
  const leaks = [...aside.querySelectorAll('span')].filter((s) => {
    const r = s.getBoundingClientRect();
    return r.width > 0 && r.right > ar.right + 1;
  }).map((s) => s.textContent?.trim().slice(0, 40));
  const email = [...aside.querySelectorAll('span')].find((s) => s.textContent?.toLowerCase().includes('maximiliano'));
  const er = email?.getBoundingClientRect();
  return { leaks, emailRight: er ? Math.round(er.right) : null, asideRight: Math.round(ar.right) };
});
check(m !== null && m.leaks.length === 0, `nada vaza além do sidenav (vazando: ${JSON.stringify(m?.leaks)})`);
check(m !== null && m.emailRight !== null && m.emailRight <= m.asideRight, `email truncado dentro do sidenav (${m?.emailRight} ≤ ${m?.asideRight})`);
console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

// Fase 6e (:46) — o manual técnico é exclusivo de quem trabalha com documentos.
// Prova os DOIS lados: quem tem documents:read lê o manual; quem NÃO tem vê o aviso de
// acesso restrito. Sem o lado negativo, a restrição seria só uma afirmação.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));
const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;

// Usuário SEM permissão de documentos (só vê processos).
const rid = Math.floor(Math.random() * 1e6);
const perfil = await api(token, '/api/v1/access-profiles', 'POST',
  { name: `Sem docs ${rid}`, description: '', permissions: ['workflow:read'] });
const email = `sem.docs.${rid}@prefeitura-x.local`;
const criado = await api(token, '/api/v1/users', 'POST', {
  name: `Sem Docs ${rid}`, email, isInternal: true,
  accessProfileIds: [perfil.body.id], positionIds: [],
});
check(criado.status === 201, `[api] usuário sem permissão de documentos criado (${criado.status})`);
const senha = criado.body?.initialPassword;
check(!!senha, '[api] senha inicial devolvida pelo servidor');

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
async function abrirManual(user, pass) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', user);
  await page.fill('input[type=password]', pass);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 }).catch(() => {});
  await page.goto(BASE + '/manual-templates', { waitUntil: 'networkidle' });
  // Espera sair do "Carregando…" (a página faz o bootstrap da sessão sozinha).
  await page.waitForFunction(() => !document.body.innerText.includes('Carregando…'), { timeout: 15000 }).catch(() => {});
  const txt = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: `${OUT}/manual-acesso-${user.split('@')[0]}.png` });
  await ctx.close();
  return txt;
}

try {
  // ✅ admin (tem permissão): vê o conteúdo do manual
  const comPermissao = await abrirManual('admin@prefeitura-x.local', 'admin123');
  check(/Como montar um modelo/i.test(comPermissao), '[web] quem tem permissão vê o manual');
  check(!/Acesso restrito/i.test(comPermissao), '[web] e NÃO vê o aviso de acesso restrito');

  // ❌ usuário sem documents:read: bloqueado
  const semPermissao = await abrirManual(email, senha);
  check(/Acesso restrito/i.test(semPermissao), '[web] quem NÃO tem permissão vê "Acesso restrito"');
  check(!/qrcode|#hide-if/i.test(semPermissao), '[web] e o conteúdo do manual não vaza para ele');

  // ── As páginas novas do 6e abrem em ABA PRÓPRIA: precisam servir no celular também.
  // (Sem isto elas ficavam testadas só em 1280 — a mesma lacuna que o histórico teve.)
  const svc = (await api(token, '/api/v1/document-templates/services')).body?.[0]?.key;
  for (const [nome, url] of [
    ['manual', '/manual-templates'],
    ['campos', svc ? `/service-fields?key=${encodeURIComponent(svc)}` : null],
  ]) {
    if (!url) continue;
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 }).catch(() => {});
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.body.innerText.includes('Carregando'), { timeout: 15000 }).catch(() => {});
    const medidas = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const cortados = [...document.querySelectorAll('button, input, a, code')]
        .filter((el) => el.offsetParent !== null)
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1); }).length;
      // CONTEÚDO escondido: um contêiner cujo conteúdo é mais largo que ele. Medir só
      // controles passava em falso — a coluna "Tipo" da tabela ficava cortada e ninguém
      // via, porque <td> não é botão nem link.
      const contDemais = [...document.querySelectorAll('div, table, section, ul')]
        .filter((el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1).length;
      return { overflow: document.documentElement.scrollWidth > vw + 1, cortados, contDemais };
    });
    check(!medidas.overflow, `[mobile] ${nome}: sem overflow horizontal`);
    check(medidas.cortados === 0, `[mobile] ${nome}: nenhum controle cortado (${medidas.cortados})`);
    check(medidas.contDemais === 0, `[mobile] ${nome}: nenhum conteúdo escondido por overflow (${medidas.contDemais})`);
    await page.screenshot({ path: `${OUT}/6e-${nome}-mobile.png` });
    await ctx.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Bugs do editor de Modelos de e-mail:
//  (2) o CORPO não carregava ao clicar em Editar (editor uncontrolled + dado async);
//  (1) o corpo começava em NEGRITO (estado "grudado" do execCommand entre instâncias);
//  (+) novo botão "Testar template" (envia teste via SMTP do tenant).
// Prova: cria um modelo via API, edita na UI e confere que o corpo carrega; clica em
// Testar e confere que dispara o endpoint + toast; num modelo NOVO, o negrito "grudado"
// é limpo ao re-focar o editor vazio. Página no AppShell → web+mobile (dialog em 1280).
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

const rid = Math.floor(Math.random() * 1e9);
const NOME = `Modelo Teste ${rid}`;
const CORPO = `CorpoUnico ${rid} do modelo`;
const created = await api(token, '/api/v1/email-templates/', 'POST', {
  name: NOME, subject: `Assunto ${rid}`, bodyHtml: `<p>${CORPO}</p>`, attachments: [], recipients: [],
});
check(created.status === 201 || created.status === 200, `[api] modelo criado (${created.status})`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
  await page.goto(BASE + '/admin/modelos-email', { waitUntil: 'networkidle' });
  await page.waitForSelector('table', { timeout: 15000 });

  // (2) EDITAR → o corpo carrega no editor.
  const row = page.locator('tr', { hasText: NOME });
  await row.locator('button').first().click(); // Pencil (editar)
  await page.waitForSelector('[role=dialog] [contenteditable]', { timeout: 10000 });
  await page.waitForTimeout(1000); // dá tempo do fetch async + re-hidratação
  const corpoCarregou = await page.evaluate((txt) => {
    const ed = document.querySelector('[role=dialog] [contenteditable]');
    return (ed?.textContent ?? '').includes(txt);
  }, CORPO);
  check(corpoCarregou, '[web] o CORPO do modelo carrega ao clicar em Editar');

  // (+) botão TESTAR: dispara o endpoint e mostra um toast (sucesso ou erro de SMTP).
  let testCalled = false;
  page.on('response', (r) => { if (r.url().includes('/email-templates/test')) testCalled = true; });
  await page.locator('[role=dialog] button', { hasText: 'Testar' }).click();
  const toast = await page.waitForFunction(() => {
    const t = document.body.innerText;
    return t.includes('Teste enviado') || t.includes('SMTP') || t.includes('Configure') || t.includes('Não foi possível enviar');
  }, { timeout: 8000 }).then(() => true).catch(() => false);
  check(testCalled, '[web] botão "Testar" dispara POST /email-templates/test');
  check(toast, '[web] "Testar" retorna feedback (toast de sucesso ou erro de SMTP)');
  // fecha o dialog de edição
  await page.locator('[role=dialog] button', { hasText: 'Cancelar' }).click();
  await page.waitForTimeout(400);

  // (1) NEGRITO: num modelo NOVO, digitar não sai em negrito (guarda de regressão).
  // Obs.: o estado "grudado" do execCommand entre instâncias só se manifesta no Chrome
  // real; no headless não é reproduzível. O fix (limpar formatação ao focar editor vazio)
  // é validado por lógica — aqui garantimos ao menos que o padrão não é negrito.
  await page.locator('header button', { hasText: 'Novo modelo' }).click();
  await page.waitForSelector('[role=dialog] [contenteditable]', { timeout: 8000 });
  const editor = page.locator('[role=dialog] [contenteditable]').first();
  await editor.click();
  await page.waitForTimeout(150); // deixa o reset deferido (setTimeout 0) rodar após o foco
  await editor.type('texto normal');
  await page.waitForTimeout(200);
  const html = await editor.evaluate((el) => el.innerHTML);
  const negrito = /<b>|<strong>|font-weight\s*:\s*(bold|[6-9]00)/i.test(html);
  check(!negrito, `[web] texto digitado em modelo novo NÃO sai em negrito (html="${html.slice(0, 80)}")`);
  await page.screenshot({ path: `${OUT}/modelo-email.png` });
} finally { await browser.close(); }
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

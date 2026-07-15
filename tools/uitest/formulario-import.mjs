// Fase 4d — Importar formulário via planilha. No MODELADOR: baixar o modelo, subir
// a planilha e SOBRESCREVER o formulário; planilha inválida lista os erros; o botão
// é DESABILITADO quando o processo já tem instâncias. Web 1280 (+ modal no mobile 375).
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

// Processo com DIAGRAMA e SEM instâncias: copia o XML de um processo existente, mas
// com NOME novo (a chave deriva do nome — senão viraria nova versão do original, que
// já tem instâncias). O import sobrescreve o formulário que vier.
const orig = await api(token, '/api/v1/workflow/process-definitions/teste_condicoes_ui');
const nomeUnico = `Import Teste ${Math.floor(Math.random() * 1e9)}`;
const xml = orig.body.bpmnXml.replace(/(<bpmn:process\b[^>]*\bname=")[^"]*(")/, `$1${nomeUnico}$2`);
const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xml });
const key = saved.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

// Baixa o modelo (planilha válida) para reenviar como "preenchida".
const tmplResp = await fetch(`${API}/api/v1/workflow/form-import/template`, { headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` } });
const template = Buffer.from(await tmplResp.arrayBuffer());
check(template.length > 0 && tmplResp.headers.get('content-type')?.includes('spreadsheet'), '[api] baixar modelo devolve um .xlsx');

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

const abrirFormulario = async (page) => {
  await page.goto(`${BASE}/processos/editar?key=${key}`, { waitUntil: 'networkidle' });
  // No mobile o canvas BPMN fica oculto (limitação conhecida): basta o elemento existir.
  await page.waitForSelector('[data-element-id="T005"]', { state: 'attached', timeout: 20000 });
  await page.getByRole('button', { name: 'Formulário', exact: true }).click();
  await page.waitForTimeout(2500);
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);
  await abrirFormulario(page);

  // Sem instâncias → botão Importar HABILITADO.
  check(await page.getByRole('button', { name: 'Importar' }).count() > 0, '[web] botão Importar habilitado (processo sem instâncias)');
  await page.getByRole('button', { name: 'Importar' }).click();
  await page.waitForSelector('[data-testid=import-input]', { state: 'attached', timeout: 8000 });

  // Planilha INVÁLIDA (bytes que não são xlsx) → lista de erros.
  await page.setInputFiles('[data-testid=import-input]', { name: 'ruim.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('isto nao e uma planilha') });
  await page.waitForSelector('[data-testid=import-erros]', { timeout: 8000 });
  check(await page.locator('[data-testid=import-erros]').count() > 0, '[web] planilha inválida lista os erros');
  await page.screenshot({ path: `${OUT}/import-erros.png`, fullPage: true });

  // Planilha VÁLIDA (o próprio modelo) → sobrescreve o formulário com os campos de exemplo.
  await page.setInputFiles('[data-testid=import-input]', { name: 'modelo.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: template });
  await page.waitForTimeout(2500);
  const canvas = await page.locator('.fjs-editor-container').innerText();
  check(/Nome completo/i.test(canvas) && /DADOS DO REQUERENTE/i.test(canvas), '[web] importar sobrescreve o formulário com os campos da planilha');
  await page.screenshot({ path: `${OUT}/import-ok.png`, fullPage: true });
  await ctx.close();

  // ── Modal responsivo no mobile ────────────────────────────────────────────
  const mob = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const mpage = await mob.newPage();
  await login(mpage);
  await abrirFormulario(mpage);
  await mpage.getByRole('button', { name: 'Importar' }).click();
  await mpage.waitForSelector('[data-testid=import-input]', { state: 'attached', timeout: 8000 });
  const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!overflow, '[mobile] modal de importação sem overflow horizontal');
  await mob.close();

  // ── Botão DESABILITADO quando há instâncias ───────────────────────────────
  await api(token, '/api/v1/workflow/instances', 'POST', { key, data: {} });
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page2 = await ctx2.newPage();
  await login(page2);
  await abrirFormulario(page2);
  check(await page2.locator('[data-testid=import-btn-disabled]').count() > 0, '[web] com instâncias iniciadas, o Importar fica desabilitado (não sobrescreve)');
  await page2.screenshot({ path: `${OUT}/import-desabilitado.png`, fullPage: true });
  await ctx2.close();
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

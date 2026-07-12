import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR || '.';
let failures = 0;
function check(ok, msg) { if (!ok) failures++; console.log(`${ok ? '✓' : '✗ FALHOU'} ${msg}`); }

async function apiToken() {
  const r = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x' },
    body: JSON.stringify({ email: 'admin@prefeitura-x.local', password: 'admin123' }),
  });
  return (await r.json()).accessToken;
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'admin@prefeitura-x.local');
await page.fill('input[type=password]', 'admin123');
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

await page.goto('http://localhost:5173/processos/editar?key=teste_condicoes_ui', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-element-id="T006"]', { timeout: 20000 });
await page.waitForTimeout(800);
await page.locator('header button', { hasText: 'Campos' }).click();
await page.waitForTimeout(1000);

// bulk "visível" (olho, botão do meio do BulkToggle) na coluna da tarefa 006
const th006 = page.locator('thead th', { hasText: '006.' });
await th006.locator('button').nth(1).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/matriz-visivel.png` });

// salva o fluxo
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.waitForTimeout(1500);

// confere no XML salvo: entradas visibility="visible" persistidas na T006
const token = await apiToken();
const detail = await (await fetch('http://localhost:5000/api/v1/workflow/process-definitions/teste_condicoes_ui', {
  headers: { Authorization: `Bearer ${token}`, 'X-Tenant': 'prefeitura-x' },
})).json();
const xml = detail.bpmnXml ?? '';
const i006 = xml.indexOf('id="T006"');
const t006 = xml.slice(i006, xml.indexOf('</bpmn:userTask>', i006));
// moddle omite visibility="visible" por ser o default do descritor — o que
// importa é a ENTRADA existir (parser assume "visible" na ausência do atributo).
const entradas = (t006.match(/<septem:formFieldEntry /g) ?? []).length;
const semHiddenEditable = !/visibility="(hidden|editable)"/.test(t006);
check(entradas >= 5, `entradas de campo persistidas no XML da T006 (${entradas})`);
check(semHiddenEditable, 'todas as entradas da T006 são "visível" (default omitido)');

console.log(failures === 0 ? 'PASSOU' : `FALHOU: ${failures} caso(s)`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

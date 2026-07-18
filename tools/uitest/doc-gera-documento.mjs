// Fase 6f (:50-:58) — campo de anexo com "Gera documento?": ao marcar, aparece a seção
// "Parametrização do documento" com anexo manual, e os três modos (fixo / lista / regra).
// Prova o EFEITO: configura no modelador, SALVA e confere que a parametrização
// sobreviveu no schema do processo (não basta a tela mostrar os controles).
// Modelador é desktop (o canvas some no mobile) → web 1280.
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

// Precisa existir um modelo de documento ATIVO para escolher.
const modelo = await api(token, '/api/v1/document-templates/', 'POST',
  { name: `Modelo Anexo ${rid}`, outputType: 'docx', active: true });
check(modelo.status === 201, `[api] modelo de documento criado (${modelo.status})`);

// Processo com um campo de ANEXO. Em vez de escrever o BPMN à mão (a fidelidade
// estrutural do DI/namespaces é sensível e o modelador abria vazio), COPIAMOS o XML de
// um processo real criado pelo app e trocamos só o nome e o formulário.
const base = await api(token, '/api/v1/workflow/process-definitions/teste_condicoes_ui');
// O EDITOR do form-js exige o envelope (type/schemaVersion) — sem ele recusa o schema
// com "form field of type <undefined> not supported" e abre o formulário vazio. O
// runtime (ReactForm) é tolerante, por isso os outros testes passavam sem o envelope.
const FORM = {
  type: 'default',
  schemaVersion: 17,
  components: [{ type: 'filepicker', key: 'documento', label: 'Documento', id: 'doc_anexo' }],
};
const XML = (base.body?.bpmnXml ?? '')
  .replace(/<septem:formSchema>[\s\S]*?<\/septem:formSchema>/, `<septem:formSchema>${JSON.stringify(FORM)}</septem:formSchema>`)
  .replace(/(<bpmn:process[^>]*\sname=")[^"]*(")/, `$1Gera Documento ${rid}$2`);
check(XML.includes('filepicker'), '[setup] XML base preparado com o campo de anexo');
const salvo = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(salvo.status === 201, `[api] processo com campo de anexo criado (${salvo.status})`);
const key = salvo.body.key;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
try {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  await page.goto(`${BASE}/processos/editar?key=${key}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 20000 });
  await page.locator('header button, nav button', { hasText: 'Formulário' }).first().click();
  await page.waitForTimeout(2000);

  // Seleciona o campo de anexo no canvas do form-js.
  await page.locator('.fjs-element').last().click();
  await page.waitForTimeout(800);

  // :50 — o checkbox existe e vem DESMARCADO por padrão.
  const geraCb = page.locator('aside label', { hasText: 'Gera documento?' }).locator('input[type=checkbox]');
  check(await geraCb.count() === 1, '[web] campo de anexo tem o checkbox "Gera documento?"');
  check(!(await geraCb.isChecked()), '[web] "Gera documento?" vem DESMARCADO por padrão');
  // :51 — a seção só aparece depois de marcar.
  check(await page.locator('[data-testid=doc-param]').count() === 0, '[web] a seção de parametrização só aparece ao marcar');

  await geraCb.check();
  await page.waitForTimeout(500);
  check(await page.locator('[data-testid=doc-param]').count() === 1, '[web] marcar exibe "Parametrização do documento"');

  // :52 — anexo manual, desmarcado por padrão.
  const manualCb = page.locator('aside label', { hasText: 'Permitir anexar documento manualmente?' }).locator('input[type=checkbox]');
  check(await manualCb.count() === 1, '[web] existe "Permitir anexar documento manualmente?"');
  check(!(await manualCb.isChecked()), '[web] anexo manual vem DESMARCADO por padrão (:53)');

  // :54/:55 — documento FIXO: escolhe o modelo no modal.
  await page.locator('[data-testid=doc-param] button', { hasText: 'Buscar modelo' }).click();
  await page.waitForSelector('[data-testid=modelo-picker-ok]', { timeout: 8000 });
  await page.locator('[role=dialog] button', { hasText: 'Selecione o modelo' }).first().click();
  await page.waitForSelector('input[placeholder="Pesquisar…"]', { timeout: 5000 });
  await page.fill('input[placeholder="Pesquisar…"]', `Modelo Anexo ${rid}`);
  await page.waitForTimeout(400);
  await page.locator('input[placeholder="Pesquisar…"]').locator('xpath=../../ul/li/button').first().click();
  await page.locator('[data-testid=modelo-picker-ok]').click();
  await page.waitForTimeout(500);
  const fixoTxt = await page.locator('[data-testid=doc-param-fixo]').innerText();
  check(fixoTxt.includes(`Modelo Anexo ${rid}`), `[web] modelo fixo selecionado aparece ("${fixoTxt}")`);

  // :56 — LISTA: modal multi-seleção define quais modelos ficam disponíveis.
  await page.locator('[data-testid=doc-param] input[type=radio]').nth(1).check();
  await page.waitForTimeout(300);
  await page.locator('[data-testid=doc-param] button', { hasText: 'Escolher modelos' }).click();
  await page.waitForSelector('[data-testid=modelo-picker-lista]', { timeout: 8000 });
  const caixas = page.locator('[data-testid=modelo-picker-lista] input[type=checkbox]');
  const nCaixas = await caixas.count();
  check(nCaixas > 0, `[web] o modal de lista mostra os modelos ativos (${nCaixas})`);
  await caixas.nth(0).check();
  if (nCaixas > 1) await caixas.nth(1).check();
  await page.locator('[data-testid=modelo-picker-ok]').click();
  await page.waitForTimeout(400);
  const escolhidos = await page.locator('[data-testid=doc-param-lista] li').count();
  check(escolhidos === Math.min(2, nCaixas), `[web] os modelos escolhidos aparecem na lista (${escolhidos})`);

  // :57/:58 — regra de negócio PREENCHIDA: campo/operador/valor → modelo.
  await page.locator('[data-testid=doc-param] input[type=radio]').nth(2).check();
  await page.waitForTimeout(300);
  await page.locator('[data-testid=doc-param-add-regra]').click();
  await page.waitForTimeout(300);
  const linhaRegra = page.locator('[data-testid=doc-param-regras] > div').first();
  check(await linhaRegra.locator('select[aria-label="Campo da regra"]').count() === 1,
    '[web] regra de negócio: linha com campo/operador/valor → modelo');
  // Preenche a regra de verdade (campo do formulário + operador + valor + modelo).
  const opcoesCampo = await linhaRegra.locator('select[aria-label="Campo da regra"] option').count();
  if (opcoesCampo > 1) await linhaRegra.locator('select[aria-label="Campo da regra"]').selectOption({ index: 1 });
  await linhaRegra.locator('select[aria-label="Operador da regra"]').selectOption('eq');
  await linhaRegra.locator('input[aria-label="Valor da regra"]').fill('urgente');
  await linhaRegra.locator('button', { hasText: 'nenhum' }).click();
  await page.waitForSelector('[data-testid=modelo-picker-ok]', { timeout: 8000 });
  await page.locator('[role=dialog] button', { hasText: 'Selecione o modelo' }).first().click();
  await page.waitForSelector('input[placeholder="Pesquisar…"]', { timeout: 5000 });
  await page.fill('input[placeholder="Pesquisar…"]', `Modelo Anexo ${rid}`);
  await page.waitForTimeout(400);
  await page.locator('input[placeholder="Pesquisar…"]').locator('xpath=../../ul/li/button').first().click();
  await page.locator('[data-testid=modelo-picker-ok]').click();
  await page.waitForTimeout(400);
  check((await linhaRegra.innerText()).includes(`Modelo Anexo ${rid}`),
    '[web] a regra aponta para o modelo escolhido');

  // Salva no modo REGRA para provar que a regra PREENCHIDA persiste (:58).
  await page.locator('header button', { hasText: 'Salvar' }).first().click();
  await page.waitForTimeout(3000);
  const detRegra = await api(token, `/api/v1/workflow/process-definitions/${key}`);
  const cfgRegra = (detRegra.body?.bpmnXml ?? '').match(/septemDocGenConfig[^&]*?(\{.*?\})\\?"/);
  const xmlRegra = detRegra.body?.bpmnXml ?? '';
  check(xmlRegra.includes('"mode\\":\\"regra') || xmlRegra.includes('&quot;mode&quot;:&quot;regra'),
    '[web] o modo REGRA persiste no processo salvo');
  check(xmlRegra.includes('urgente'), '[web] a condição preenchida (valor "urgente") persiste');
  void cfgRegra;

  // Volta para FIXO (é o que vamos persistir e verificar).
  await page.locator('[data-testid=doc-param] input[type=radio]').first().check();
  await page.waitForTimeout(300);
  await manualCb.check(); // marca o anexo manual para provar que persiste também
  // SEM espera antes do Salvar: o schema do formulário entra no BPMN por polling
  // (600ms), então salvar "no susto" é justamente o caso que perdia a alteração.
  check(await manualCb.isChecked(), '[web] o checkbox de anexo manual fica marcado ao clicar');

  // SALVA e confere o EFEITO no schema persistido.
  await page.locator('header button', { hasText: 'Salvar' }).first().click();
  await page.waitForTimeout(3500);

  const det = await api(token, `/api/v1/workflow/process-definitions/${key}`);
  const xml = det.body?.bpmnXml ?? '';
  check(/septemDocGen/.test(xml), '[api] "Gera documento?" persiste no processo salvo');
  check(/septemDocManual/.test(xml), '[api] "permitir anexo manual" persiste');
  check(xml.includes(modelo.body.id), '[api] o modelo escolhido persiste na parametrização');
  await page.screenshot({ path: `${OUT}/doc-gera-documento.png`, fullPage: false });
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

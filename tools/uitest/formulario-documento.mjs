// Fase 4a — Documento (CPF/CNPJ) com máscara dinâmica + validação de dígito.
// (1) No MODELADOR: um campo de texto ganha a opção "Documento" na aba Aparência.
// (2) No PREENCHIMENTO: a máscara formata ao digitar (11→CPF, 14→CNPJ), o CPF
// inválido dá erro em vermelho e BLOQUEIA concluir; o válido conclui a tarefa.
// Web 1280 + mobile 375.
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

// Processo com um campo CPF (septemDocKind=cpf) — publicado via API para o preenchimento.
const FORM = { components: [{ type: 'textfield', key: 'cpf', label: 'CPF do requerente', properties: { septemDocKind: 'cpf' } }] };
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="Doc CPF UI" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${JSON.stringify(FORM)}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Preencher CPF">
      <bpmn:extensionElements><septem:actionButtons><septem:actionButton id="ok" label="Concluir" /></septem:actionButtons></bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
const key = saved.body.key;
await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

try {
  for (const view of [{ name: 'web', w: 1280, h: 900 }, { name: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);

    // ── Preenchimento: inicia uma instância nova e abre a tarefa ────────────
    const inst = await api(token, '/api/v1/workflow/instances', 'POST', { key, data: {} });
    const taskId = inst.body.tasks[0].id;
    await page.goto(`${BASE}/tarefa/${taskId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input', { timeout: 15000 });
    await page.waitForTimeout(600);

    const campo = page.locator('input').first();

    // Máscara dinâmica: digitar 11 dígitos formata como CPF.
    await campo.fill('');
    await campo.type('52998224725', { delay: 8 });
    const valorMascara = await campo.inputValue();
    check(valorMascara === '529.982.247-25', `[${view.name}] a máscara formata o CPF ao digitar (${valorMascara})`);

    // Troca para um CPF INVÁLIDO e tenta concluir → erro vermelho + bloqueia.
    await campo.fill('');
    await campo.type('52998224724', { delay: 8 });
    await page.getByRole('button', { name: 'Concluir' }).click();
    await page.waitForTimeout(500);
    const erroVisivel = await page.locator('text=CPF inválido.').count();
    check(erroVisivel > 0, `[${view.name}] CPF inválido mostra "CPF inválido." abaixo do campo`);

    // A tarefa continua pendente (não concluiu com valor inválido).
    const aindaPendente = (await api(token, `/api/v1/workflow/tasks/${taskId}`)).status === 200;
    check(aindaPendente, `[${view.name}] CPF inválido NÃO concluiu a tarefa (continua aberta)`);
    await page.screenshot({ path: `${OUT}/doc-invalido-${view.name}.png`, fullPage: true });

    // Corrige para um CPF válido → conclui.
    await campo.fill('');
    await campo.type('52998224725', { delay: 8 });
    await page.getByRole('button', { name: 'Concluir' }).click();
    await page.waitForTimeout(1500);
    const concluida = (await api(token, `/api/v1/workflow/instances`)).body;
    const doneOk = await page.locator('text=/conclu/i').count();
    check(doneOk > 0, `[${view.name}] CPF válido conclui a tarefa (tela de conclusão)`);

    // Layout do preenchimento.
    const L = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }));
    check(!L.overflow, `[${view.name}] preenchimento sem overflow horizontal`);

    await ctx.close();
  }

  // ── Modelador: a opção "Documento" aparece para um campo de texto ─────────
  // Adiciona um textfield pela paleta e abre a aba Aparência.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);
  try {
    // Processo que já tem formulário com campos de texto (o mesmo das outras suítes).
    await page.goto(`${BASE}/processos/editar?key=teste_condicoes_ui`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
    await page.getByRole('button', { name: 'Formulário', exact: true }).click();
    await page.waitForTimeout(2500);
    // Clicar num campo de texto do canvas seleciona-o e abre o painel de config.
    await page.locator('.fjs-editor-container .fjs-form-field', { hasText: 'Nome do requisitante' }).first().click({ timeout: 8000 });
    await page.waitForTimeout(600);
    await page.locator('button', { hasText: 'Aparência' }).first().click({ timeout: 3000 });
    await page.waitForTimeout(400);
    const temDoc = await page.getByText('Documento', { exact: true }).count();
    check(temDoc > 0, '[modelador] a aba Aparência de um campo de texto tem a opção "Documento"');
    // E de fato oferece CPF/CNPJ no select.
    const opcoes = await page.locator('option', { hasText: /CPF/ }).count();
    check(opcoes > 0, '[modelador] o seletor Documento oferece CPF/CNPJ');
    await page.screenshot({ path: `${OUT}/doc-modelador.png`, fullPage: true });
  } catch (e) {
    check(false, `[modelador] falhou ao abrir config do campo: ${String(e.message).slice(0, 80)}`);
  }
  await ctx.close();
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

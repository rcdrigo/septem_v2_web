// Ajustes 26/07 — formulário de execução:
//  (4) grupos em ABAS (tablist), não empilhados;
//  (5/7) campo de data adapta: data e hora = calendário + horas ao lado; só data =
//        só calendário; só hora = só horas (shadcn 24h date & time picker);
//  (6) restrição de data: SEM restrição não bloqueia passado; noPast bloqueia.
// Construído por API (start form real). Item 4 web+mobile; picker no web.
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

// Form: grupos em abas + 4 campos de data (loose, aparecem acima das abas).
const FORM = JSON.stringify({
  type: 'default', schemaVersion: 17, septemGroupLayout: 'tabs',
  components: [
    { type: 'datetime', key: 'dt_dt', id: 'i1', label: 'Data e hora', properties: { septemDateMode: 'datetime' } },
    { type: 'datetime', key: 'dt_date', id: 'i2', label: 'Só data', properties: { septemDateMode: 'date' } },
    { type: 'datetime', key: 'dt_time', id: 'i3', label: 'Só hora', properties: { septemDateMode: 'time' } },
    { type: 'datetime', key: 'dt_np', id: 'i4', label: 'Sem passado', properties: { septemDateMode: 'date', septemDateLimit: 'noPast' } },
    { type: 'group', id: 'g1', label: `Aba Um ${rid}`, components: [{ type: 'textfield', key: 'a', label: 'Campo A', id: 'fa' }] },
    { type: 'group', id: 'g2', label: `Aba Dois ${rid}`, components: [{ type: 'textfield', key: 'b', label: 'Campo B', id: 'fb' }] },
  ],
}).replace(/'/g, '&apos;');

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dF${rid}" targetNamespace="x">
  <bpmn:process id="PF${rid}" name="Form Abas ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig inbox="Teste {{formulario.a}}" accessRules='[{"type":"all","action":"allow","capability":"view"}]' />
      <septem:formSchema>${FORM}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="SF${rid}"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="TF${rid}" name="Analisar"><bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="EF${rid}"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="SF${rid}" targetRef="TF${rid}" />
    <bpmn:sequenceFlow id="f2" sourceRef="TF${rid}" targetRef="EF${rid}" />
  </bpmn:process>
</bpmn:definitions>`;

const saved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
check(saved.status === 201, `[api] processo criado (${saved.status})`);
const key = saved.body.key;
const pub = await api(token, `/api/v1/workflow/process-definitions/${key}/status`, 'PATCH', { status: 'published' });
check(pub.status === 200 || pub.status === 204, `[api] processo publicado (${pub.status})`);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}

for (const view of [{ name: 'web', width: 1280, height: 900 }, { name: 'mobile', width: 375, height: 812 }]) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(`${BASE}/servico/${key}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.septem-date-picker', { timeout: 12000 });

  // ── Item 4: grupos em ABAS ──
  const tablist = page.locator('[role=tablist]');
  check(await tablist.count() >= 1, `[${view.name}] formulário renderiza ABAS (role=tablist) — item 4`);
  const tabs = await page.locator('[role=tab]').allInnerTexts();
  check(tabs.some((t) => /aba um/i.test(t)) && tabs.some((t) => /aba dois/i.test(t)),
    `[${view.name}] as abas são os grupos (Aba Um / Aba Dois) — [${tabs.map((t) => t.trim()).join(', ')}]`);
  // Empilhado teria 2 cards de grupo simultâneos; em abas, só o conteúdo da aba ativa.
  check(await page.getByText('Campo A').count() >= 1 && await page.getByText('Campo B').isVisible().catch(() => false) === false,
    `[${view.name}] só o conteúdo da aba ativa aparece (Campo B oculto até trocar de aba)`);

  // ── Item 5/7: modos do campo de data ──
  const modes = await page.locator('.septem-date-picker').evaluateAll((els) => els.map((e) => e.getAttribute('data-date-picker-mode')));
  check(JSON.stringify(modes.slice(0, 4)) === JSON.stringify(['datetime', 'date', 'time', 'date']),
    `[${view.name}] modos dos campos de data corretos — [${modes.join(', ')}]`);

  if (view.name === 'web') {
    // data e hora → calendário + horas
    await page.locator('.septem-date-picker .septem-date-picker-input').nth(0).focus();
    await page.waitForSelector('[data-date-picker-popover]', { timeout: 5000 });
    await page.waitForTimeout(300);
    check(await page.locator('[data-date-picker-popover] td button').count() > 0 && await page.locator('[data-date-picker-time]').count() === 1,
      `[web] "data e hora": calendário E coluna de horas lado a lado (item 5/7)`);
    const dnDatetime = await page.locator('[data-date-picker-popover] td button[disabled]').count();
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);

    // só data → calendário, sem horas; SEM restrição não bloqueia passado (item 6)
    await page.locator('.septem-date-picker .septem-date-picker-input').nth(1).focus();
    await page.waitForSelector('[data-date-picker-popover]', { timeout: 5000 });
    await page.waitForTimeout(300);
    check(await page.locator('[data-date-picker-time]').count() === 0 && await page.locator('[data-date-picker-popover] td button').count() > 0,
      `[web] "só data": apenas calendário (sem horas) — item 5/7`);
    const dnDate = await page.locator('[data-date-picker-popover] td button[disabled]').count();
    check(dnDate === 0, `[web] "só data" SEM restrição não bloqueia datas passadas (item 6) — ${dnDate} dias bloqueados`);
    void dnDatetime;
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);

    // só hora → só horas, sem calendário
    await page.locator('.septem-date-picker .septem-date-picker-input').nth(2).focus();
    await page.waitForSelector('[data-date-picker-popover]', { timeout: 5000 });
    await page.waitForTimeout(300);
    check(await page.locator('[data-date-picker-time]').count() === 1 && await page.locator('[data-date-picker-popover] td button').count() === 0,
      `[web] "só hora": apenas horas (sem calendário) — item 5/7`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);

    // noPast → bloqueia passado
    await page.locator('.septem-date-picker .septem-date-picker-input').nth(3).focus();
    await page.waitForSelector('[data-date-picker-popover]', { timeout: 5000 });
    await page.waitForTimeout(300);
    const dnNoPast = await page.locator('[data-date-picker-popover] td button[disabled]').count();
    check(dnNoPast > 0, `[web] restrição "não permitir passado" bloqueia dias passados (item 6) — ${dnNoPast} bloqueados`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!overflow, `[${view.name}] form de início sem overflow horizontal`);
  await page.screenshot({ path: `${OUT}/ajustes-form-${view.name}.png`, fullPage: false });
  await ctx.close();
}

// ── Item 4 (round-trip): o MODELADOR persiste a escolha de layout dos grupos ──
// Usa uma CÓPIA de um processo real (com BPMN DI) — sem DI, o bpmn-js do modelador
// não monta o businessObject e o form embutido não carrega (artefato de teste).
{
  const base = await api(token, '/api/v1/workflow/process-definitions/teste_condicoes_ui');
  const rtXml = (base.body?.bpmnXml ?? '').replace(/(<bpmn:process[^>]*\sname=")[^"]*(")/, `$1RoundTrip ${rid}$2`);
  const rtSaved = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: rtXml });
  const rtKey = rtSaved.body.key;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(`${BASE}/processos/editar?key=${rtKey}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 20000 });
  await page.locator('header button, nav button', { hasText: 'Formulário' }).first().click();
  await page.waitForTimeout(2500);

  // O toggle carrega a escolha persistida (o processo base nasceu com 'tabs').
  const abasBtn = page.locator('button', { hasText: 'Abas' }).first();
  const empBtn = page.locator('button', { hasText: 'Empilhados' }).first();
  const abasAtivo = await abasBtn.evaluate((el) => el.className.includes('bg-slate-900'));
  check(abasAtivo, '[modelador] o toggle carrega a escolha persistida (Abas ativa)');
  const key = rtKey; // o round-trip abaixo opera sobre a cópia

  async function salvar() {
    await page.locator('header button', { hasText: 'Salvar' }).first().click();
    await page.waitForTimeout(3000);
  }
  const layoutNoXml = async () => {
    const det = await api(token, `/api/v1/workflow/process-definitions/${key}`);
    const m = (det.body?.bpmnXml ?? '').match(/septemGroupLayout[\\"':]+(\w+)/);
    return m?.[1] ?? null;
  };

  await empBtn.click();
  await page.waitForTimeout(500);
  await salvar();
  check((await layoutNoXml()) === 'stacked', '[modelador] trocar para Empilhados persiste (stacked) no processo salvo');

  await empBtn.click(); // reabre para clicar Abas (mesmo grupo de botões)
  await page.locator('button', { hasText: 'Abas' }).first().click();
  await page.waitForTimeout(500);
  await salvar();
  check((await layoutNoXml()) === 'tabs', '[modelador] trocar para Abas persiste (tabs) no processo salvo');

  await ctx.close();
}

await browser.close();
ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

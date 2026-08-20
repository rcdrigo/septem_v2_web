// Fase 6 (requisitos 2026-08-03): configuração de assinaturas na tarefa —
// campos ESCOLHIDOS (não digitados), "Assinatura obrigatória" e "Assinar em lote".
//
// O que a suíte prova:
//  (a) o seletor lista SÓ campos de anexo (resposta 13) — asserção do conteúdo da
//      lista, não da existência do controle;
//  (b) escolher um campo o move para a lista de escolhidos e ele sai das opções;
//  (c) marcar os dois parâmetros e salvar → PERSISTE após recarregar (caça ao
//      salvar-antes-de-carregar) e chega ao BACKEND;
//  (d) um campo legado que não existe mais no formulário aparece marcado como não
//      encontrado, em vez de sumir em silêncio.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const token = (await api(null, '/api/v1/auth/login', 'POST',
  { identifier: 'admin@prefeitura-x.local', password: 'admin123' })).body.accessToken;

const rid = Math.floor(Math.random() * 1e9);
// Formulário com DOIS anexos e um texto: o texto é o controle negativo do filtro.
const FORM = '{"type":"default","schemaVersion":17,"components":['
  + '{"type":"filepicker","key":"anexo_parecer","label":"Parecer assinado"},'
  + '{"type":"filepicker","key":"anexo_oficio","label":"Ofício"},'
  + '{"type":"textfield","key":"observacao","label":"Observação"}]}';

const xml = (assinatura) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dsu" targetNamespace="x">
  <bpmn:process id="Psu" name="Assinatura UI ${rid}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig status="draft" />
      <septem:formSchema>${FORM}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="Ssu"><bpmn:outgoing>N1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="TSIG" name="Assinar UI ${rid}">
      <bpmn:extensionElements>${assinatura}</bpmn:extensionElements>
      <bpmn:incoming>N1</bpmn:incoming><bpmn:outgoing>N2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="Esu"><bpmn:incoming>N2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="N1" sourceRef="Ssu" targetRef="TSIG" />
    <bpmn:sequenceFlow id="N2" sourceRef="TSIG" targetRef="Esu" />
  </bpmn:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Dsu">
    <bpmndi:BPMNPlane id="Plsu" bpmnElement="Psu">
      <bpmndi:BPMNShape id="Sh_Ssu" bpmnElement="Ssu"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="150" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sh_TSIG" bpmnElement="TSIG"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="240" y="78" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sh_Esu" bpmnElement="Esu"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="400" y="100" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// Começa com um campo LEGADO que não existe no formulário — é o caso (d).
const salvo = await api(token, '/api/v1/workflow/process-definitions', 'POST',
  { bpmnXml: xml('<septem:signature mode="electronic" fields="campo_que_sumiu" />') });
check(salvo.status < 300, `[setup] processo criado (${salvo.status})`);
const key = salvo.body.key;

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });

/** Abre a tarefa no modelador e a seção Assinaturas. */
async function abrirSecaoAssinaturas(page) {
  await page.goto(`${BASE}/flows/edit?key=${key}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.djs-palette', { timeout: 25000 });
  await page.waitForSelector('[data-element-id="TSIG"]', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.click('[data-element-id="TSIG"]');
  await page.waitForTimeout(900);
  const secao = page.locator('aside', { hasText: 'Assinaturas' }).first();
  await secao.waitFor({ timeout: 8000 });
  return secao;
}

try {
  // Só desktop: o modelador é ferramenta de desktop (o canvas BPMN não é usável em
  // 375px — limitação conhecida e registrada do harness).
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20000 });

  await abrirSecaoAssinaturas(page);

  // Liga a assinatura eletrônica.
  await page.getByRole('radio', { name: /assinatura eletrônica/i }).check().catch(async () => {
    await page.locator('input[type=radio][value=electronic]').check();
  });
  await page.waitForTimeout(600);

  // ── (d) campo legado continua visível, marcado como não encontrado ─────────
  const escolhidos = page.locator('[data-testid=sig-campos-escolhidos]');
  await escolhidos.waitFor({ timeout: 8000 });
  const textoLegado = await escolhidos.innerText();
  check(textoLegado.includes('campo_que_sumiu'),
    'o campo legado NÃO é descartado em silêncio');
  check(/não encontrado/i.test(textoLegado),
    'e é marcado como não encontrado no formulário');

  // ── (a) o seletor lista SÓ anexos ─────────────────────────────────────────
  // ⚠️ Escopado ao seletor DA ASSINATURA: o painel do modelador tem vários
  // comboboxes, e ler `[role=option]` do documento inteiro pegava a lista de outra
  // seção — foi o que fez o check "não oferece campo de texto" falhar, medindo a
  // caixa errada.
  const seletor = page.locator('[data-testid=sig-seletor-campos]');
  await seletor.waitFor({ timeout: 8000 });
  await seletor.locator('input, button').first().click();
  const lista = page.locator('[data-testid=combobox-popover]');
  await lista.waitFor({ timeout: 8000 });
  const opcoes = (await lista.locator('li').allTextContents()).map((t) => t.trim()).filter(Boolean);
  const temAnexos = opcoes.some((o) => o.includes('Parecer assinado')) && opcoes.some((o) => o.includes('Ofício'));
  check(temAnexos, `o seletor oferece os campos de anexo (${JSON.stringify(opcoes.slice(0, 6))})`);
  check(!opcoes.some((o) => o.includes('Observação')),
    'e NÃO oferece campo de texto — só anexo é assinável');

  // ── (b) escolher move para a lista ────────────────────────────────────────
  await lista.locator('li', { hasText: 'Parecer assinado' }).first().click();
  await page.waitForTimeout(700);
  check((await escolhidos.innerText()).includes('Parecer assinado'),
    'o campo escolhido entra na lista de assináveis');

  // ── (c) marcar os dois parâmetros e SALVAR ────────────────────────────────
  await page.locator('[data-testid=sig-obrigatoria]').check();
  await page.locator('[data-testid=sig-lote]').check();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/assinatura-config.png`, fullPage: false });

  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const aside = document.querySelector('aside');
    const clipped = [...(aside?.querySelectorAll('input, button, li') ?? [])].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
    }).length;
    return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
  });
  check(!layout.overflows, 'painel de assinaturas sem overflow horizontal');
  check(layout.clipped === 0, `painel de assinaturas sem controle recortado (${layout.clipped})`);

  await page.getByRole('button', { name: /^Salvar/ }).first().click();
  await page.waitForTimeout(3000);

  // ⭐ A prova: RECARREGAR e reabrir. Marcar não é salvar.
  await abrirSecaoAssinaturas(page);
  await page.waitForTimeout(600);
  const obrigatoria = await page.locator('[data-testid=sig-obrigatoria]').isChecked();
  const lote = await page.locator('[data-testid=sig-lote]').isChecked();
  check(obrigatoria && lote, `os dois parâmetros PERSISTEM após recarregar (obrigatória=${obrigatoria}, lote=${lote})`);
  const escolhidosDepois = await page.locator('[data-testid=sig-campos-escolhidos]').innerText();
  check(escolhidosDepois.includes('Parecer assinado'), 'e o campo escolhido também persiste');

  // E o BACKEND guardou — a tela poderia estar mostrando estado local.
  const xmlSalvo = await (await fetch(`${API}/api/v1/workflow/process-definitions/${key}?format=xml`, {
    headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` },
  })).text();
  check(/required="true"/.test(xmlSalvo), 'o XML no servidor traz required="true"');
  check(/batch="true"/.test(xmlSalvo), 'o XML no servidor traz batch="true"');
  check(/anexo_parecer/.test(xmlSalvo), 'e o campo escolhido');

  await ctx.close();
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

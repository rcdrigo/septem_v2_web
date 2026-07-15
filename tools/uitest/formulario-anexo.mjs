// Fase 4c — Campo de anexo: upload REAL. (1) PREENCHIMENTO: enviar um PDF mostra o
// arquivo na lista (com tamanho e link); enviar uma extensão fora das permitidas dá
// erro do servidor. (2) MODELADOR: o campo de anexo tem "Extensões permitidas".
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

// Esta suíte testa o storage LOCAL (fallback). Garante que não há bucket S3
// configurado (outra suíte pode ter deixado um), senão o upload tentaria o S3 real.
await api(token, '/api/v1/settings/storage', 'PUT', {
  bucketName: null, region: null, endpoint: null, accessKey: null, baseFolder: null,
  cdnUrl: null, useSignedUrls: false, urlExpirationMinutes: 60, storageClass: null,
  encryption: null, maxUploadMb: 25, blockedExtensions: 'exe,bat,cmd', secretKey: '',
});

// Campo de anexo que aceita só pdf/png.
const FORM = { components: [{ type: 'filepicker', key: 'anexo', label: 'Documento do processo', properties: { septemAllowedExts: 'pdf,png' } }] };
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="Anexo UI" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${JSON.stringify(FORM)}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Anexar documento">
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
const pdf = { name: 'parecer.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 conteudo de teste') };
const gif = { name: 'foto.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') };

try {
  for (const view of [{ name: 'web', w: 1280, h: 900 }, { name: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await login(page);

    const inst = await api(token, '/api/v1/workflow/instances', 'POST', { key, data: {} });
    const taskId = inst.body.tasks[0].id;
    await page.goto(`${BASE}/tarefa/${taskId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=anexo-input]', { timeout: 15000 });

    // O campo mostra as extensões aceitas.
    const dica = await page.locator('[data-testid=anexo-campo]').innerText();
    check(/pdf/.test(dica) && /png/.test(dica), `[${view.name}] o campo mostra as extensões aceitas (pdf, png)`);

    // Enviar um PDF → aparece na lista, com link e tamanho.
    await page.setInputFiles('[data-testid=anexo-input]', pdf);
    await page.waitForSelector('[data-testid=anexo-item]', { timeout: 15000 });
    const item = await page.locator('[data-testid=anexo-item]').first().innerText();
    check(item.includes('parecer.pdf'), `[${view.name}] o PDF enviado aparece na lista de anexos`);
    const href = await page.locator('[data-testid=anexo-item] a').first().getAttribute('href');
    check(!!href && /parecer_\d{17}\.pdf/.test(href), `[${view.name}] o anexo tem link com timestamp no nome (${href?.slice(-30)})`);

    // Enviar um GIF (fora das permitidas) → erro do servidor.
    await page.setInputFiles('[data-testid=anexo-input]', gif);
    await page.waitForTimeout(1500);
    const erro = await page.locator('[data-testid=anexo-erro]').count();
    check(erro > 0, `[${view.name}] extensão não permitida mostra erro do servidor`);
    // O anexo válido continua lá (a lista não some por causa do erro).
    check(await page.locator('[data-testid=anexo-item]').count() === 1, `[${view.name}] o anexo válido permanece após o erro`);
    await page.screenshot({ path: `${OUT}/anexo-${view.name}.png`, fullPage: true });

    // Remover o anexo.
    await page.locator('[data-testid=anexo-item] button[aria-label^="Remover"]').first().click();
    await page.waitForTimeout(300);
    check(await page.locator('[data-testid=anexo-item]').count() === 0, `[${view.name}] remover tira o anexo da lista`);

    // Concluir com o anexo reenviado.
    await page.setInputFiles('[data-testid=anexo-input]', pdf);
    await page.waitForSelector('[data-testid=anexo-item]', { timeout: 15000 });
    await page.getByRole('button', { name: 'Concluir' }).click();
    await page.waitForTimeout(1500);
    check(await page.locator('text=/conclu/i').count() > 0, `[${view.name}] conclui a tarefa com o anexo`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!overflow, `[${view.name}] preenchimento sem overflow horizontal`);
    await ctx.close();
  }

  // ── Modelador: o campo de anexo tem "Extensões permitidas" ────────────────
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);
  try {
    await page.goto(`${BASE}/processos/editar?key=teste_condicoes_ui`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-element-id="T005"]', { timeout: 20000 });
    await page.getByRole('button', { name: 'Formulário', exact: true }).click();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Upload de arquivo' }).click();
    await page.waitForTimeout(1000);
    // O painel de config abre na aba Geral; o picker de extensões está lá.
    check(await page.locator('[data-testid=ext-picker]').count() > 0, '[modelador] campo de anexo tem "Extensões permitidas"');
    // Adiciona "dwg" (formato de arquitetura) pela busca.
    await page.locator('[data-testid=ext-picker] input').fill('dwg');
    await page.waitForTimeout(300);
    await page.locator('[data-testid=ext-picker] button', { hasText: '.dwg' }).first().click();
    await page.waitForTimeout(300);
    check(await page.locator('[data-testid=ext-chip]', { hasText: 'dwg' }).count() > 0, '[modelador] adicionar "dwg" (CAD) vira um chip');
    await page.screenshot({ path: `${OUT}/anexo-modelador.png`, fullPage: true });
  } catch (e) {
    check(false, `[modelador] falhou: ${String(e.message).slice(0, 90)}`);
  }
  await ctx.close();
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

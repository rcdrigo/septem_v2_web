// Fase 6g (modelos_documentos:61-65) — GERAR o documento dentro da tarefa.
// Prova o EFEITO, não a presença do botão: clicar "Gerar documento" cria um anexo
// REAL no campo, cujo arquivo baixa e contém o dado da solicitação. Também cobre o
// modo LISTA (seletor de modelo), o anexo manual só quando liberado (:52/:53) e a
// recusa do servidor quando o campo é somente-leitura naquela tarefa (:63).
// Web 1280 + mobile 375.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (token, p, method = 'GET', body) => {
  const r = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;
const rid = Math.floor(Math.random() * 1e9);

// Storage LOCAL (outra suíte pode ter deixado S3 configurado).
await api(token, '/api/v1/settings/storage', 'PUT', {
  bucketName: null, region: null, endpoint: null, accessKey: null, baseFolder: null,
  cdnUrl: null, useSignedUrls: false, urlExpirationMinutes: 60, storageClass: null,
  encryption: null, maxUploadMb: 25, blockedExtensions: 'exe,bat,cmd', secretKey: '',
});

// ── modelos de documento com .docx REAL (LibreOffice converte um .txt) ──
const dir = mkdtempSync(path.join(tmpdir(), 'docgen-'));
const docx = (nome, texto) => {
  const txt = path.join(dir, `${nome}.txt`);
  writeFileSync(txt, texto, 'utf8');
  execFileSync('soffice', ['--headless', '--convert-to', 'docx', '--outdir', dir, txt], { stdio: 'ignore', timeout: 120000 });
  return path.join(dir, `${nome}.docx`);
};
const oficioPath = docx('oficio', 'Oficio para {{nome}} - protocolo {{nome}}');
const anexoPath = docx('anexo2', 'Anexo alternativo de {{nome}}');
check(true, '[setup] .docx de teste gerados pelo LibreOffice');

// Upload via multipart (fetch + FormData com o arquivo lido do disco).
const { readFileSync } = await import('node:fs');
const criarModelo = async (nome, caminho) => {
  const cri = await api(token, '/api/v1/document-templates/', 'POST', { name: nome, outputType: 'docx', active: true });
  const form = new FormData();
  form.append('file', new Blob([readFileSync(caminho)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'modelo.docx');
  const up = await fetch(`${API}/api/v1/document-templates/${cri.body.id}/file`, {
    method: 'POST', headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` }, body: form,
  });
  check(up.status === 200, `[api] modelo "${nome}" com .docx enviado (${up.status})`);
  return cri.body.id;
};
const modeloFixo = await criarModelo(`Oficio ${rid}`, oficioPath);
const modeloAlt = await criarModelo(`Alternativo ${rid}`, anexoPath);

// ── processos: um FIXO (sem anexo manual) e um LISTA (com anexo manual) ──
const proc = (nome, campoProps) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d${nome}" targetNamespace="x">
  <bpmn:process id="P${nome}" name="${nome}" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${JSON.stringify({
      components: [
        { type: 'textfield', key: 'nome', label: 'Nome' },
        { type: 'filepicker', key: 'doc', label: 'Documento', properties: campoProps },
      ],
    })}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Emitir documento">
      <bpmn:extensionElements>
        <septem:actionButtons><septem:actionButton id="ok" label="Concluir" /></septem:actionButtons>
        <septem:formFields>
          <septem:formFieldEntry fieldRef="nome" visibility="editable" />
          <septem:formFieldEntry fieldRef="doc" visibility="editable" />
        </septem:formFields>
      </bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="T2" name="Conferir">
      <bpmn:extensionElements>
        <septem:actionButtons><septem:actionButton id="ok2" label="Concluir" /></septem:actionButtons>
        <septem:formFields>
          <septem:formFieldEntry fieldRef="nome" visibility="visible" />
          <septem:formFieldEntry fieldRef="doc" visibility="visible" />
        </septem:formFields>
      </bpmn:extensionElements>
      <bpmn:incoming>F2</bpmn:incoming><bpmn:outgoing>F3</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="T2" />
    <bpmn:sequenceFlow id="F3" sourceRef="T2" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

const publicar = async (xml) => {
  const s = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xml });
  check(s.status === 201, `[api] processo publicado (${s.status})`);
  await api(token, `/api/v1/workflow/process-definitions/${s.body.key}/status`, 'PATCH', { status: 'published' });
  return s.body.key;
};

// FIXO: gera documento e NÃO permite anexo manual.
const keyFixo = await publicar(proc(`DocFixo${rid}`, {
  septemDocGen: 'yes',
  septemDocGenConfig: JSON.stringify({ mode: 'fixo', templateId: modeloFixo }),
}));
// LISTA: dois modelos para escolher + anexo manual liberado.
const keyLista = await publicar(proc(`DocLista${rid}`, {
  septemDocGen: 'yes',
  septemDocManual: 'yes',
  septemDocGenConfig: JSON.stringify({ mode: 'lista', templateIds: [modeloFixo, modeloAlt] }),
}));

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
    page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
    await login(page);

    // ── modo FIXO ───────────────────────────────────────────────────
    const i1 = await api(token, '/api/v1/workflow/instances', 'POST', { key: keyFixo, data: { nome: `Joana ${rid}` } });
    const t1 = i1.body.tasks[0].id;
    await page.goto(`${BASE}/tasks/${t1}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=anexo-gerar]', { timeout: 15000 });

    check(await page.locator('[data-testid=anexo-input]').count() === 0,
      `[${view.name}] sem "anexar manualmente" o campo NÃO mostra o input de arquivo (:53)`);
    check(await page.locator('[data-testid=anexo-modelo]').count() === 0,
      `[${view.name}] modo fixo não pede escolha de modelo`);
    check(await page.locator('[data-testid=anexo-item]').count() === 0,
      `[${view.name}] o campo começa sem anexo`);

    await page.locator('[data-testid=anexo-gerar]').click();
    // O botão precisa dar sinal de progresso enquanto gera.
    await page.waitForSelector('[data-testid=anexo-item]', { timeout: 30000 });
    check(true, `[${view.name}] clicar "Gerar documento" anexa o arquivo ao campo (:61)`);

    const nomeArq = await page.locator('[data-testid=anexo-item]').first().innerText();
    check(/\.docx/i.test(nomeArq), `[${view.name}] o anexo gerado é .docx ("${nomeArq.split('\n')[0]}")`);

    // :62 — dá para VISUALIZAR: o item tem link e o arquivo baixa de verdade.
    const href = await page.locator('[data-testid=anexo-item] a').first().getAttribute('href');
    check(!!href, `[${view.name}] o anexo gerado tem link para visualizar (:62)`);
    const bin = await fetch(API + href, { headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` } });
    const bytes = Buffer.from(await bin.arrayBuffer());
    check(bin.status === 200 && bytes.length > 0, `[${view.name}] o arquivo gerado baixa (${bin.status}, ${bytes.length} bytes)`);
    // .docx é um zip: assinatura PK.
    check(bytes[0] === 0x50 && bytes[1] === 0x4b, `[${view.name}] o arquivo é um .docx válido (assinatura PK)`);
    // O conteúdo tem o dado REAL da solicitação (o texto fica em document.xml, comprimido,
    // então conferimos pelo endpoint que já sabe ler — o histórico do modelo).
    const hist = await api(token, `/api/v1/document-templates/${modeloFixo}/executions`);
    const prod = (hist.body ?? []).filter((e) => e.kind === 'producao' && e.status === 'sucesso');
    check(prod.length > 0, `[${view.name}] a geração entrou no histórico como produção (${prod.length})`);
    check(JSON.stringify(prod[0]?.payload ?? '').includes(`Joana ${rid}`),
      `[${view.name}] o documento foi gerado com os dados reais da solicitação`);

    // Sem estouro horizontal. NÃO dá para confiar em scrollWidth: o <main> tem
    // overflow-auto e RECORTA o excesso, então a página "não estoura" enquanto o
    // campo está fora da tela. Medimos o retângulo contra o viewport — foi assim
    // que apareceu o bug do nome longo do documento gerado esticando o grid.
    const medida = await page.evaluate(() => {
      const vw = window.innerWidth;
      return ['[data-testid=anexo-campo]', '[data-testid=anexo-item]', '[data-testid=anexo-gerar]'].map((s) => {
        const el = document.querySelector(s);
        if (!el) return { s, achou: false, ok: false, right: 0, vw };
        const r = el.getBoundingClientRect();
        return { s, achou: true, ok: r.right <= vw + 1, right: Math.round(r.right), vw };
      });
    });
    for (const m of medida) {
      check(m.achou && m.ok,
        `[${view.name}] ${m.s} cabe no viewport (${m.achou ? `direita=${m.right}, vw=${m.vw}` : 'NÃO ENCONTRADO'})`);
    }

    await page.screenshot({ path: `${OUT}/doc-gerar-tarefa-${view.name}.png`, fullPage: true });

    // ── modo LISTA ──────────────────────────────────────────────────
    const i2 = await api(token, '/api/v1/workflow/instances', 'POST', { key: keyLista, data: { nome: `Rui ${rid}` } });
    const t2 = i2.body.tasks[0].id;
    await page.goto(`${BASE}/tasks/${t2}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=anexo-modelo]', { timeout: 15000 });

    check(await page.locator('[data-testid=anexo-input]').count() === 1,
      `[${view.name}] com anexo manual liberado o input de arquivo aparece (:52)`);
    const opcoes = await page.locator('[data-testid=anexo-modelo] option').count();
    check(opcoes === 3, `[${view.name}] o seletor traz só os 2 modelos parametrizados + placeholder (${opcoes})`);
    check(await page.locator('[data-testid=anexo-gerar]').isDisabled(),
      `[${view.name}] sem escolher o modelo o botão fica desabilitado`);

    await page.locator('[data-testid=anexo-modelo]').selectOption({ label: `Alternativo ${rid}` });
    check(!(await page.locator('[data-testid=anexo-gerar]').isDisabled()),
      `[${view.name}] escolhido o modelo, o botão libera`);
    await page.locator('[data-testid=anexo-gerar]').click();
    await page.waitForSelector('[data-testid=anexo-item]', { timeout: 30000 });
    const histAlt = await api(token, `/api/v1/document-templates/${modeloAlt}/executions`);
    check((histAlt.body ?? []).some((e) => e.kind === 'producao' && e.status === 'sucesso'),
      `[${view.name}] gerou usando o modelo ESCOLHIDO na lista (:55)`);

    // ── :63 — o servidor recusa fora da tarefa onde o campo é editável ──
    // Conclui a tarefa: em T2 o campo "doc" é somente-leitura.
    const fim = await api(token, `/api/v1/workflow/tasks/${t2}/complete`, 'POST', { action: 'ok', data: {} });
    const t2b = fim.body?.nextTaskForMe ?? fim.body?.tasks?.[0]?.id;
    if (t2b) {
      const negado = await api(token, `/api/v1/workflow/tasks/${t2b}/generate-document`, 'POST', { fieldKey: 'doc' });
      check(negado.status === 403, `[${view.name}] campo somente-leitura na tarefa: geração recusada (${negado.status})`);
      await page.goto(`${BASE}/tasks/${t2b}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      check(await page.locator('[data-testid=anexo-gerar]').count() === 0,
        `[${view.name}] e a UI nem oferece o botão nessa tarefa`);
    } else {
      bad.push(`[${view.name}] não consegui avançar para a tarefa de conferência`);
    }
    // A tarefa já concluída também não gera mais.
    const velha = await api(token, `/api/v1/workflow/tasks/${t2}/generate-document`, 'POST', { fieldKey: 'doc' });
    check(velha.status === 403, `[${view.name}] tarefa concluída não gera documento (${velha.status})`);

    await ctx.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

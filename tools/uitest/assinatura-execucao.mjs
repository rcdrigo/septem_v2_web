// Fases 7a/7b/7c — assinatura na EXECUÇÃO da tarefa.
// Prova o efeito, não a presença do botão: assinar de verdade muda o estado do ícone,
// grava o registro no servidor e a representação visual sai com a página de assinaturas.
// Cobre também o caso que dá sentido a tudo: trocar o arquivo depois de assinado NÃO
// pode deixar o ícone verde; o card do certificado A1 (7b); e o lote + o bloqueio dos
// botões de conclusão (7c), inclusive o popover por TOQUE no mobile. Web 1280 + mobile 375.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

// Erro de React não pode passar como log ignorado: uma tela que estoura ("Rendered
// fewer hooks than expected") deixava a suíte VERDE porque só o HTTP era conferido.
const erros = [];
const vigiar = (pagina, rotulo) => {
  pagina.on('pageerror', (e) => erros.push(`${rotulo}: ${e.message.slice(0, 160)}`));
};

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
// Largura FIXA: id de largura variável cria colisão de prefixo com run anterior
// (o banco de dev não reseta) — armadilha já paga na suíte `unidades`.
const rid = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');

// Storage local (outra suíte pode ter deixado S3 configurado).
await api(token, '/api/v1/settings/storage', 'PUT', {
  bucketName: null, region: null, endpoint: null, accessKey: null, baseFolder: null,
  cdnUrl: null, useSignedUrls: false, urlExpirationMinutes: 60, storageClass: null,
  encryption: null, maxUploadMb: 25, blockedExtensions: 'exe,bat,cmd', secretKey: '',
});

// PDF de verdade (LibreOffice), para que a concatenação seja real.
const dir = mkdtempSync(path.join(tmpdir(), 'assin-'));
const pdf = (nome, texto) => {
  const txt = path.join(dir, `${nome}.txt`);
  writeFileSync(txt, texto, 'utf8');
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dir, txt], { stdio: 'ignore', timeout: 120000 });
  return path.join(dir, `${nome}.pdf`);
};
const pdfOriginal = pdf(`parecer${rid}`, `Parecer tecnico numero ${rid}`);
const pdfTrocado = pdf(`outro${rid}`, `Documento SUBSTITUIDO ${rid}`);
check(true, '[setup] PDFs de teste gerados pelo LibreOffice');

// Certificado A1 de TESTE, gerado aqui (nunca um real), com a extensão da ICP-Brasil:
// DDMMAAAA(8) + CPF(11) + NIS(11) + RG(15) + órgão. O CPF precisa bater com o cadastro.
const CPF_TESTE = '52998224725';
const conteudoIcp = `01011990${CPF_TESTE}${'0'.repeat(11)}${'0'.repeat(15)}SSPSP `;
const pfxPath = path.join(dir, 'teste.pfx');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', path.join(dir, 'k.pem'),
  '-out', path.join(dir, 'c.pem'), '-days', '365', '-nodes', '-subj', '/CN=ADMIN DO SEPTEM',
  '-addext', `subjectAltName=otherName:2.16.76.1.3.1;UTF8:${conteudoIcp}`], { stdio: 'ignore', timeout: 60000 });
execFileSync('openssl', ['pkcs12', '-export', '-out', pfxPath, '-inkey', path.join(dir, 'k.pem'),
  '-in', path.join(dir, 'c.pem'), '-passout', 'pass:senha123'], { stdio: 'ignore', timeout: 60000 });
check(true, '[setup] certificado A1 de teste gerado (openssl)');

// O CPF do cadastro tem de ser o mesmo do certificado — é a conferência da 7b.
const eu = await api(token, '/api/v1/me');
await api(token, `/api/v1/users/${eu.body.id}`, 'PUT', { cpf: '529.982.247-25' });

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dA${rid}" targetNamespace="x">
  <bpmn:process id="PA${rid}" name="Assinatura ${rid}" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${JSON.stringify({
      components: [
        { type: 'textfield', key: 'nome', label: 'Nome' },
        { type: 'filepicker', key: 'doc', label: 'Documento' },
        { type: 'filepicker', key: 'anexoLivre', label: 'Anexo livre' },
      ],
    })}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Assinar documento">
      <bpmn:extensionElements>
        <septem:signature mode="electronic" fields="doc" required="true" batch="false" />
        <septem:actionButtons><septem:actionButton id="ok" label="Concluir" /></septem:actionButtons>
        <septem:formFields>
          <septem:formFieldEntry fieldRef="nome" visibility="editable" />
          <septem:formFieldEntry fieldRef="doc" visibility="editable" />
          <septem:formFieldEntry fieldRef="anexoLivre" visibility="editable" />
        </septem:formFields>
      </bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;

const criado = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xml });
check(criado.status === 201, `[api] processo criado (${criado.status})`);
await api(token, `/api/v1/workflow/process-definitions/${criado.body.key}/status`, 'PATCH', { status: 'published' });

// Processo da Fase 7c: DOIS campos assináveis, obrigatória + lote, e um botão sem
// validação (devolução) — que precisa continuar clicável com assinatura pendente.
const xmlLote = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dL${rid}" targetNamespace="x">
  <bpmn:process id="PL${rid}" name="Lote ${rid}" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${JSON.stringify({
      components: [
        { type: 'filepicker', key: 'docA', label: 'Documento A' },
        { type: 'filepicker', key: 'docB', label: 'Documento B' },
      ],
    })}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Assinar em lote">
      <bpmn:extensionElements>
        <septem:signature mode="electronic" fields="docA&#10;docB" required="true" batch="true" />
        <septem:actionButtons>
          <septem:actionButton id="concluir" label="Concluir" validateForm="true" />
          <septem:actionButton id="devolver" label="Devolver" validateForm="false" />
        </septem:actionButtons>
        <septem:formFields>
          <septem:formFieldEntry fieldRef="docA" visibility="editable" />
          <septem:formFieldEntry fieldRef="docB" visibility="editable" />
        </septem:formFields>
      </bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;
const criadoLote = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xmlLote });
check(criadoLote.status === 201, `[api] processo de lote criado (${criadoLote.status})`);
await api(token, `/api/v1/workflow/process-definitions/${criadoLote.body.key}/status`, 'PATCH', { status: 'published' });
const keyLote = criadoLote.body.key;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

/** Mede overflow/recorte do elemento sob teste (não do documento inteiro). */
const layout = async (page, sel) => page.evaluate((s) => {
  const raiz = document.querySelector(s) ?? document.body;
  const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  let clipped = 0;
  for (const el of raiz.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) clipped++;
  }
  return { overflow, clipped };
}, sel);

try {
  for (const view of [{ name: 'web', w: 1280, h: 900 }, { name: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    vigiar(page, `${view.name}/tarefa`);
    await login(page);

    const inst = await api(token, '/api/v1/workflow/instances', 'POST', { key: criado.body.key, data: { nome: `Fulano ${rid}` } });
    const taskId = inst.body.tasks[0].id;

    await page.goto(`${BASE}/tasks/${taskId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=anexo-input]', { timeout: 15000 });

    // ── 1) Sem anexo, não há o que assinar ────────────────────────────────
    check(await page.locator('[data-testid=anexo-assinar]').count() === 0,
      `[${view.name}] campo vazio não oferece assinatura`);

    // ── 2) Anexar o PDF no campo ASSINÁVEL ────────────────────────────────
    const inputs = page.locator('[data-testid=anexo-input]');
    await inputs.nth(0).setInputFiles(pdfOriginal);
    await page.waitForSelector('[data-testid=anexo-item]', { timeout: 20000 });
    await page.waitForSelector('[data-testid=anexo-assinar]', { timeout: 20000 });

    const icone = page.locator('[data-testid=anexo-assinar]').first();
    check(await icone.getAttribute('data-estado') === 'pendente',
      `[${view.name}] o ícone nasce PENDENTE`);
    const classePendente = (await icone.getAttribute('class')) ?? '';
    check(/rose/.test(classePendente), `[${view.name}] o ícone pendente é VERMELHO`);
    check((await icone.getAttribute('title')) === 'Clique aqui para assinar o documento',
      `[${view.name}] o popover convida a assinar (texto exato da spec)`);
    check(await icone.isEnabled(), `[${view.name}] pendente o ícone está ATIVO (clicável)`);

    // ── 3) O campo NÃO configurado não ganha ícone ────────────────────────
    await inputs.nth(1).setInputFiles(pdfOriginal);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=anexo-item]').length >= 2, null, { timeout: 20000 });
    check(await page.locator('[data-testid=anexo-assinar]').count() === 1,
      `[${view.name}] só o campo configurado oferece assinatura (o outro anexo não)`);

    // ── 4) Clicar abre ABA NOVA com o documento e o card ──────────────────
    const [aba] = await Promise.all([ctx.waitForEvent('page'), icone.click()]);
    vigiar(aba, `${view.name}/assinatura`);
    await aba.waitForLoadState('networkidle');
    check(/\/sign\?/.test(aba.url()), `[${view.name}] abre em ABA NOVA na página de assinatura`);
    await aba.waitForSelector('[data-testid=assinatura-card]', { timeout: 20000 });
    check(await aba.locator('[data-testid=assinatura-iframe]').count() === 1,
      `[${view.name}] o documento aparece dentro de um iframe`);
    check(await aba.locator('[data-testid=assinatura-tipo-simples]').isChecked(),
      `[${view.name}] "pré-definida" já vem marcada ao carregar (padrão da spec)`);
    check(await aba.locator('[data-testid=assinatura-tipo-a1]').count() === 1,
      `[${view.name}] o certificado A1 aparece como opção`);
    check(await aba.locator('[data-testid=assinatura-abrir]').count() === 1,
      `[${view.name}] oferece abrir o documento fora do iframe (navegador sem visualizador)`);
    const textoCard = await aba.locator('[data-testid=assinatura-card]').innerText();
    check(/14\.063/.test(textoCard), `[${view.name}] o card cita a Lei 14.063/2020`);

    const l1 = await layout(aba, '[data-testid=pagina-assinatura]');
    check(!l1.overflow, `[${view.name}] página de assinatura sem overflow horizontal`);
    check(l1.clipped === 0, `[${view.name}] página de assinatura sem elemento recortado (${l1.clipped})`);
    await aba.screenshot({ path: `${OUT}/assinatura-exec-${view.name}.png`, fullPage: true });

    // ── 5) Assinar ────────────────────────────────────────────────────────
    await aba.locator('[data-testid=assinatura-assinar]').click();
    await aba.waitForSelector('[data-testid=assinatura-concluida]', { timeout: 20000 });
    check(true, `[${view.name}] assinou e a página confirma "Documento assinado"`);
    const lista = await aba.locator('[data-testid=assinatura-lista]').innerText();
    check(/Admin|admin/i.test(lista), `[${view.name}] a assinatura registrada nomeia o signatário`);

    // O servidor guardou o registro com hash — é ele que prova, não a tela.
    const reg = await api(token, `/api/v1/workflow/tasks/${taskId}/signatures`);
    const doc = reg.body.documentos.find((d) => d.fieldKey === 'doc');
    check(doc.assinaturas.length === 1, `[${view.name}] o servidor gravou 1 assinatura`);
    check(/^[0-9a-f]{64}$/.test(doc.assinaturas[0].hash), `[${view.name}] com o SHA-256 do arquivo`);
    check(doc.assinaturas[0].state === 'valid', `[${view.name}] e ela consta como válida`);

    await aba.close();

    // ── 6) De volta à tarefa: o ícone fica VERDE e INATIVO ────────────────
    await page.bringToFront();
    await page.waitForFunction(
      () => document.querySelector('[data-testid=anexo-assinar]')?.getAttribute('data-estado') === 'assinado',
      null, { timeout: 20000 });
    const iconeOk = page.locator('[data-testid=anexo-assinar]').first();
    check(/emerald/.test((await iconeOk.getAttribute('class')) ?? ''), `[${view.name}] o ícone assinado é VERDE`);
    check((await iconeOk.getAttribute('title')) === 'Documento assinado',
      `[${view.name}] o popover passa a "Documento assinado" (texto exato da spec)`);
    check(await iconeOk.getAttribute('aria-disabled') === 'true',
      `[${view.name}] assinado o ícone fica INATIVO (não é mais clicável)`);

    // ── 7) Visualizar assinaturas: PDF com a página final ────────────────
    check(await page.locator('[data-testid=anexo-ver-assinaturas]').count() === 1,
      `[${view.name}] aparece o botão de visualizar assinaturas ao lado`);
    const prev = await fetch(`${API}/api/v1/workflow/tasks/${taskId}/fields/doc/signatures/preview`, {
      headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` },
    });
    const buf = Buffer.from(await prev.arrayBuffer());
    check(prev.status === 200 && buf.subarray(0, 4).toString() === '%PDF',
      `[${view.name}] a representação visual volta como PDF`);
    check(buf.length > 2000, `[${view.name}] e traz conteúdo (${Math.round(buf.length / 1024)} KB)`);

    // ── 8) ⭐ Trocar o arquivo NÃO pode deixar o ícone verde ──────────────
    await page.locator('[data-testid=anexo-item]').first().locator('button[aria-label^="Remover"]').click();
    await inputs.nth(0).setInputFiles(pdfTrocado);
    // Condição POSITIVA: esperar "!== assinado" seria satisfeito no instante em que o
    // item some do DOM durante a troca — negação trivial, o erro clássico daqui.
    await page.waitForFunction(
      () => document.querySelector('[data-testid=anexo-assinar]')?.getAttribute('data-estado') === 'invalidada',
      null, { timeout: 20000 });
    const iconeTrocado = page.locator('[data-testid=anexo-assinar]').first();
    check(await iconeTrocado.getAttribute('data-estado') === 'invalidada',
      `[${view.name}] trocado o arquivo, a assinatura consta INVALIDADA`);
    check(!/emerald/.test((await iconeTrocado.getAttribute('class')) ?? ''),
      `[${view.name}] e o ícone NÃO fica verde apontando para arquivo diferente`);

    const l2 = await layout(page, '[data-testid=anexo-campo]');
    check(!l2.overflow, `[${view.name}] a tarefa segue sem overflow horizontal`);
    check(l2.clipped === 0, `[${view.name}] sem elemento recortado no campo (${l2.clipped})`);
    await page.screenshot({ path: `${OUT}/assinatura-tarefa-${view.name}.png`, fullPage: true });

    // ── 9) Fase 7b: o card do certificado A1 abre os campos ───────────────
    const inst2 = await api(token, '/api/v1/workflow/instances', 'POST', { key: criado.body.key, data: {} });
    const task2 = inst2.body.tasks[0].id;
    await page.goto(`${BASE}/tasks/${task2}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=anexo-input]', { timeout: 15000 });
    await page.locator('[data-testid=anexo-input]').first().setInputFiles(pdfOriginal);
    await page.waitForSelector('[data-testid=anexo-assinar]', { timeout: 20000 });
    const [abaCert] = await Promise.all([ctx.waitForEvent('page'), page.locator('[data-testid=anexo-assinar]').first().click()]);
    vigiar(abaCert, `${view.name}/assinatura-cert`);
    await abaCert.waitForSelector('[data-testid=assinatura-card]', { timeout: 20000 });

    check(!(await abaCert.locator('[data-testid=assinatura-tipo-a1]').isDisabled()),
      `[${view.name}] o certificado A1 está disponível (7b)`);
    check(await abaCert.locator('[data-testid=assinatura-pfx]').count() === 0,
      `[${view.name}] os campos do certificado só aparecem ao escolher o A1`);
    await abaCert.locator('[data-testid=assinatura-tipo-a1]').check();
    await abaCert.waitForSelector('[data-testid=assinatura-pfx]', { timeout: 10000 });
    check(await abaCert.locator('[data-testid=assinatura-senha]').count() === 1,
      `[${view.name}] escolher A1 pede arquivo .pfx e senha`);
    check(await abaCert.locator('[data-testid=assinatura-senha]').getAttribute('type') === 'password',
      `[${view.name}] a senha do certificado não fica visível na tela`);

    // ⭐ Assina DE VERDADE com o certificado — sem isto a 7b só teria a tela provada.
    await abaCert.locator('[data-testid=assinatura-pfx]').setInputFiles(pfxPath);
    await abaCert.locator('[data-testid=assinatura-senha]').fill('senha123');
    await abaCert.locator('[data-testid=assinatura-assinar]').click();
    await abaCert.waitForSelector('[data-testid=assinatura-concluida]', { timeout: 25000 });
    check(true, `[${view.name}] assinou com o certificado A1`);

    const certTexto = await abaCert.locator('[data-testid=assinatura-cert]').innerText().catch(() => '');
    check(/ADMIN DO SEPTEM/i.test(certTexto),
      `[${view.name}] a lista mostra o TITULAR do certificado ("${certTexto.slice(0, 40)}")`);
    check(/emissor/i.test(certTexto), `[${view.name}] e o emissor`);

    // O servidor gravou como A1, com prova de posse da chave.
    const regCert = await api(token, `/api/v1/workflow/tasks/${task2}/signatures`);
    const docCert = regCert.body.documentos.find((d) => d.fieldKey === 'doc');
    check(docCert.assinaturas[0]?.type === 'a1', `[${view.name}] o registro ficou como certificado A1`);
    check(docCert.assinaturas[0]?.state === 'valid', `[${view.name}] e consta válida`);

    // Senha errada: mensagem acionável, sem erro cru de biblioteca.
    const inst2b = await api(token, '/api/v1/workflow/instances', 'POST', { key: criado.body.key, data: {} });
    const t2b = inst2b.body.tasks[0].id;
    await page.goto(`${BASE}/tasks/${t2b}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=anexo-input]', { timeout: 15000 });
    await page.locator('[data-testid=anexo-input]').first().setInputFiles(pdfOriginal);
    await page.waitForSelector('[data-testid=anexo-assinar]', { timeout: 20000 });
    const [abaErro] = await Promise.all([ctx.waitForEvent('page'), page.locator('[data-testid=anexo-assinar]').first().click()]);
    vigiar(abaErro, `${view.name}/assinatura-erro`);
    await abaErro.waitForSelector('[data-testid=assinatura-card]', { timeout: 20000 });
    await abaErro.locator('[data-testid=assinatura-tipo-a1]').check();
    await abaErro.locator('[data-testid=assinatura-pfx]').setInputFiles(pfxPath);
    await abaErro.locator('[data-testid=assinatura-senha]').fill('senha-errada');
    await abaErro.locator('[data-testid=assinatura-assinar]').click();
    const msgErro = await abaErro.waitForSelector('[data-testid=assinatura-erro]', { timeout: 20000 })
      .then((h) => h.innerText()).catch(() => '');
    check(/certificado|senha/i.test(msgErro),
      `[${view.name}] senha errada explica o que fazer ("${msgErro.slice(0, 50)}")`);
    check(!/Cryptographic|Exception|at Septem/i.test(msgErro),
      `[${view.name}] e não vaza erro de biblioteca para a tela`);
    await abaErro.close();
    const lCert = await layout(abaCert, '[data-testid=pagina-assinatura]');
    check(!lCert.overflow && lCert.clipped === 0,
      `[${view.name}] card do certificado sem overflow nem recorte (${lCert.clipped})`);
    await abaCert.screenshot({ path: `${OUT}/assinatura-cert-${view.name}.png`, fullPage: true });
    await abaCert.close();

    // ── 10) Fase 7c: lote + bloqueio dos botões ───────────────────────────
    const inst3 = await api(token, '/api/v1/workflow/instances', 'POST', { key: keyLote, data: {} });
    const task3 = inst3.body.tasks[0].id;
    // Anexa nos DOIS campos assináveis, para o lote ter o que fazer.
    await page.goto(`${BASE}/tasks/${task3}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=anexo-input]', { timeout: 15000 });
    const entradas = page.locator('[data-testid=anexo-input]');
    await entradas.nth(0).setInputFiles(pdfOriginal);
    await page.waitForSelector('[data-testid=anexo-item]', { timeout: 20000 });
    await entradas.nth(1).setInputFiles(pdfTrocado);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=anexo-item]').length >= 2, null, { timeout: 20000 });

    const abrirBotoes = async () => {
      if (view.name !== 'mobile') return;
      // No mobile os botões de conclusão vivem atrás do sheet.
      await page.locator('button', { hasText: 'Botões de conclusão' }).first().click();
      await page.waitForTimeout(400);
    };
    const botao = (rotulo) => page.locator('dialog[open] button, button').filter({ hasText: rotulo }).last();

    await abrirBotoes();
    await page.waitForFunction(
      () => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Assinar documentos em lote')),
      null, { timeout: 20000 });
    check(true, `[${view.name}] o botão "Assinar documentos em lote" aparece (7c)`);

    // Ordem: o lote vem ANTES de todos os botões de conclusão (requisito literal).
    const ordem = await page.evaluate(() => {
      const alvo = document.querySelector('dialog[open]') ?? document.body;
      return [...alvo.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim()).filter(Boolean);
    });
    const iLote = ordem.findIndex((t) => t.includes('Assinar documentos em lote'));
    const iConcluir = ordem.findIndex((t) => t.includes('Concluir'));
    check(iLote >= 0 && iConcluir >= 0 && iLote < iConcluir,
      `[${view.name}] o lote vem ANTES dos demais botões (lote=${iLote}, concluir=${iConcluir})`);

    check(await botao('Concluir').isDisabled(), `[${view.name}] "Concluir" nasce BLOQUEADO com assinatura pendente`);
    check(!(await botao('Devolver').isDisabled()), `[${view.name}] "Devolver" (sem validação) continua clicável`);

    // O popover que EXPLICA o bloqueio — no mobile só existe por toque.
    if (view.name === 'mobile') {
      await botao('Concluir').locator('xpath=ancestor::span[@data-testid="tooltip-wrap"][1]').dispatchEvent('pointerdown', { pointerType: 'touch' });
    } else {
      await botao('Concluir').hover();
    }
    const popover = await page.waitForSelector('[role=tooltip]', { timeout: 8000 }).then((h) => h.innerText()).catch(() => '');
    check(/assine os documentos/i.test(popover),
      `[${view.name}] o popover explica que só conclui depois de assinar ("${popover.slice(0, 40)}")`);

    // ⭐ "Devolver" não pode estar desabilitado DE MENTIRA: clica e conta a resposta.
    const respostaDevolver = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/complete'), { timeout: 20000 }),
      botao('Devolver').click(),
    ]).then(([r]) => r.status()).catch(() => 0);
    check(respostaDevolver === 200, `[${view.name}] devolver realmente conclui a tarefa (HTTP ${respostaDevolver})`);

    // Lote numa instância nova (a anterior foi devolvida).
    const inst4 = await api(token, '/api/v1/workflow/instances', 'POST', { key: keyLote, data: {} });
    const task4 = inst4.body.tasks[0].id;
    await page.goto(`${BASE}/tasks/${task4}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=anexo-input]', { timeout: 15000 });
    const ent4 = page.locator('[data-testid=anexo-input]');
    await ent4.nth(0).setInputFiles(pdfOriginal);
    await page.waitForSelector('[data-testid=anexo-item]', { timeout: 20000 });
    await ent4.nth(1).setInputFiles(pdfTrocado);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=anexo-item]').length >= 2, null, { timeout: 20000 });

    await abrirBotoes();
    await botao('Assinar documentos em lote').click();
    // Depois do lote: todos os ícones verdes, lote desativado, demais liberados.
    await page.waitForFunction(
      () => [...document.querySelectorAll('[data-testid=anexo-assinar]')].length === 2
        && [...document.querySelectorAll('[data-testid=anexo-assinar]')].every((e) => e.getAttribute('data-estado') === 'assinado'),
      null, { timeout: 25000 });
    check(true, `[${view.name}] o lote assinou TODOS os documentos de uma vez`);

    await abrirBotoes();
    check(await botao('Assinar documentos em lote').isDisabled(),
      `[${view.name}] assinado tudo, o botão de lote fica DESATIVADO`);
    check(!(await botao('Concluir').isDisabled()),
      `[${view.name}] e "Concluir" fica habilitado`);

    const respostaConcluir = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/complete'), { timeout: 20000 }),
      botao('Concluir').click(),
    ]).then(([r]) => r.status()).catch(() => 0);
    check(respostaConcluir === 200, `[${view.name}] e a tarefa conclui de fato (HTTP ${respostaConcluir})`);

    // HTTP 200 não prova que a TELA sobreviveu: a versão anterior desta sonda passava
    // com a página estourando logo depois de concluir.
    const telaFinal = await page.waitForFunction(
      () => /conclu/i.test(document.body.innerText) && !/Unexpected Application Error/i.test(document.body.innerText),
      null, { timeout: 15000 }).then(() => true).catch(() => false);
    check(telaFinal, `[${view.name}] a tela de conclusão renderiza (sem estourar)`);

    const lLote = await layout(page, 'body');
    check(!lLote.overflow, `[${view.name}] tela do lote sem overflow horizontal`);
    await page.screenshot({ path: `${OUT}/assinatura-lote-${view.name}.png`, fullPage: true });

    await ctx.close();
  }
} finally {
  await browser.close();
}

check(erros.length === 0, `sem erro de JavaScript nas telas${erros.length ? ' — ' + erros.join(' | ') : ''}`);

for (const m of ok) console.log('✓', m);
for (const m of bad) console.log('✗ FALHOU', m);
console.log(bad.length ? `\nFALHOU (${bad.length} de ${ok.length + bad.length})` : `\nPASSOU (${ok.length} checks)`);
process.exit(bad.length ? 1 : 0);

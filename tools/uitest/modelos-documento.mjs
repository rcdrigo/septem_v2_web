// Fase 6a — Modelos de documento: cadastro (nome, descrição, unidade, status, tipo de
// saída), upload do .docx (só aceita .docx) e preview somente-leitura.
// Prova o EFEITO: cria pela UI → confere na API; sobe um .docx REAL → confere que o
// arquivo volta pelo endpoint com o mesmo conteúdo; tenta um .txt → rejeitado.
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
const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;

// Gera um .docx de verdade (LibreOffice) com uma chave {{ }} — é o insumo do módulo.
const dir = mkdtempSync(path.join(tmpdir(), 'septem-doc-'));
const txt = path.join(dir, 'modelo.txt');
writeFileSync(txt, 'Contrato de {{nome_cliente}}\nValor: {{valor}}\n');
execFileSync('soffice', ['--headless', '--convert-to', 'docx', '--outdir', dir, txt], { stdio: 'ignore', timeout: 120000 });
const docxPath = path.join(dir, 'modelo.docx');
const docxBytes = readFileSync(docxPath);
check(docxBytes.length > 0, `[setup] .docx de teste gerado (${docxBytes.length} bytes)`);
// Um .txt para provar que a validação de extensão barra.
const txtPath = path.join(dir, 'naoaceito.txt');
writeFileSync(txtPath, 'nao deveria passar');

const rid = Math.floor(Math.random() * 1e9);
const NOME = `Contrato Teste ${rid}`;

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
    await page.goto(BASE + '/admin/document-templates', { waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Modelos de documentos")', { timeout: 15000 });

    // A página real substituiu o stub ("Fase 7" era o placeholder).
    const semStub = !(await page.evaluate(() => document.body.innerText.includes('Fase 7')));
    check(semStub, `[${vp.n}] página real (não é mais o stub "Fase 7")`);

    // Sem overflow horizontal (a tabela rola dentro do próprio container).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!overflow, `[${vp.n}] sem overflow horizontal`);

    // Protocolo: nenhum CONTROLE cortado (fora da viewport) — na lista e no diálogo.
    // Ignora o <aside>: no mobile o menu é um drawer off-canvas (fica em left ≈ -248
    // POR DESIGN, deslizando ao abrir) — contá-lo daria falso-positivo em toda tela.
    const clippedOf = () => page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return [...document.querySelectorAll('button, input, select, textarea, a')]
        .filter((el) => el.offsetParent !== null && !el.closest('aside'))
        .map((el) => { const r = el.getBoundingClientRect(); return { out: r.right > vw + 1 || r.left < -1, w: r.width }; })
        .filter((c) => c.out && c.w > 0).length;
    });
    check((await clippedOf()) === 0, `[${vp.n}] nenhum controle cortado na lista (clipped: ${await clippedOf()})`);

    // Abre o diálogo de cadastro e mede de novo (é onde o mobile costuma cortar).
    await page.locator('header button', { hasText: 'Novo modelo' }).click();
    await page.waitForSelector('[role=dialog]', { timeout: 8000 });
    await page.waitForTimeout(500);
    const clippedDlg = await clippedOf();
    const dlgOverflow = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]');
      return !!d && d.scrollWidth > d.clientWidth + 1;
    });
    check(clippedDlg === 0, `[${vp.n}] nenhum controle cortado no diálogo (clipped: ${clippedDlg})`);
    check(!dlgOverflow, `[${vp.n}] diálogo sem overflow horizontal`);
    await page.screenshot({ path: `${OUT}/modelos-documento-${vp.n}.png`, fullPage: false });
    await page.locator('[role=dialog] button', { hasText: 'Cancelar' }).click();
    await page.waitForTimeout(300);

    // O modal de HISTÓRICO também precisa caber nas duas telas (o payload é um <pre>
    // longo, candidato natural a estourar a largura no celular).
    // O layout troca por breakpoint: linha da tabela no web, card no mobile — e o outro
    // continua no DOM porém oculto (sm:hidden), então escolher pelo viewport evita
    // clicar num botão invisível.
    const comHistorico = page.locator(vp.n === 'mobile' ? '[data-testid=doc-card]' : '[data-testid=doc-linha]')
      .filter({ hasText: 'Contrato Teste' }).first();
    if (await comHistorico.count()) {
      await comHistorico.locator('button[title="Histórico de execuções"], button[title="Histórico"]').first().click();
      await page.waitForSelector('[role=dialog]', { timeout: 8000 });
      await page.waitForTimeout(800);
      // Abre o payload (o conteúdo mais largo do modal) antes de medir.
      const verPayload = page.locator('[role=dialog] button', { hasText: 'Ver payload' }).first();
      if (await verPayload.count()) { await verPayload.click(); await page.waitForTimeout(300); }
      const clippedHist = await clippedOf();
      const histOverflow = await page.evaluate(() => {
        const d = document.querySelector('[role=dialog]');
        if (!d) return { dialog: false, filhos: 0 };
        const culpados = [...d.querySelectorAll('*')]
          .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.tagName !== 'PRE')
          // Só conta quem REALMENTE esconde conteúdo: num elemento com overflow
          // visível o excesso apenas transborda (e aqui vem de pseudo-elemento
          // decorativo — ex.: `before:-inset-2`, que amplia a área de clique do
          // botão de fechar em 8px por lado). Isso não corta nada nem gera barra.
          .filter((e) => {
            const ox = getComputedStyle(e).overflowX;
            return ox === 'hidden' || ox === 'auto' || ox === 'scroll';
          })
          // Reportar QUEM estoura, não só quantos: sem isso a falha vira um número
          // e custa uma sonda separada só para descobrir o elemento.
          .map((e) => `${e.tagName}.${(e.className || '').toString().slice(0, 50)} (${e.scrollWidth}>${e.clientWidth})`);
        return { dialog: d.scrollWidth > d.clientWidth + 1, filhos: culpados.length, culpados };
      });
      check(clippedHist === 0, `[${vp.n}] histórico: nenhum controle cortado (clipped: ${clippedHist})`);
      check(!histOverflow.dialog && histOverflow.filhos === 0,
        `[${vp.n}] histórico sem overflow horizontal (${JSON.stringify(histOverflow)})`);
      await page.screenshot({ path: `${OUT}/modelos-documento-hist-${vp.n}.png`, fullPage: false });
      await page.locator('[role=dialog] button', { hasText: 'Fechar' }).click();
      await page.waitForTimeout(300);
    }

    // O modal "buscar campos" também precisa caber no celular (dropdown + botões).
    await page.locator('[data-testid=doc-buscar-campos]').click();
    await page.waitForSelector('[data-testid=campos-buscar]', { timeout: 8000 });
    await page.waitForTimeout(400);
    const clippedCampos = await clippedOf();
    check(clippedCampos === 0, `[${vp.n}] modal "buscar campos": nenhum controle cortado (${clippedCampos})`);
    await page.locator('[role=dialog] button', { hasText: 'Fechar' }).first().click();
    await page.waitForTimeout(300);

    if (vp.n === 'web') {
      // ── CRIAR pela UI ──
      await page.locator('header button', { hasText: 'Novo modelo' }).click();
      await page.waitForSelector('[role=dialog]', { timeout: 8000 });
      await page.locator('[role=dialog] label:has-text("Nome")').locator('xpath=..').locator('input').first().fill(NOME);
      await page.locator('[role=dialog] label:has-text("Descrição")').locator('xpath=..').locator('textarea').first().fill('modelo de teste e2e');
      // Tipo de saída: PDF — marca o input do radio direto (o label é sibling, não wrapper).
      await page.locator('[role=dialog] input[type=radio][value="pdf"]').check();
      await page.locator('[role=dialog] button', { hasText: 'Salvar' }).click();
      // Espera o diálogo fechar (sinal real de que salvou), não um tempo fixo.
      await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 10000 }).catch(() => {});

      // EFEITO no servidor: o modelo existe com os campos salvos.
      const lista = await api(token, '/api/v1/document-templates/');
      const criado = (lista.body ?? []).find((t) => t.name === NOME);
      check(!!criado, `[web] modelo criado aparece na API ("${NOME}")`);
      check(criado?.outputType === 'pdf', `[web] tipo de saída salvo (${criado?.outputType})`);
      check(criado?.active === true, '[web] status ativo salvo');

      // ── UPLOAD do .docx pela UI ──
      // Recarrega: garante a lista já com o modelo novo (independe do timing do refetch).
      await page.reload({ waitUntil: 'networkidle' });
      const linha = page.locator('[data-testid=doc-linha]', { hasText: NOME });
      await linha.waitFor({ timeout: 15000 });
      await linha.locator('button[title="Editar"]').click();
      await page.waitForSelector('[role=dialog]', { timeout: 8000 });
      await page.waitForTimeout(800);
      await page.locator('[data-testid=doc-file-input]').setInputFiles(docxPath);
      await page.waitForFunction(() => document.body.innerText.includes('enviado') || document.body.innerText.includes('modelo.docx'), { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);

      const det = await api(token, `/api/v1/document-templates/${criado.id}`);
      check(det.body?.hasFile === true, '[web] upload gravou o arquivo no modelo (hasFile)');
      check(det.body?.fileName === 'modelo.docx', `[web] nome do arquivo salvo (${det.body?.fileName})`);

      // EFEITO real: o arquivo VOLTA pelo endpoint, com os mesmos bytes (round-trip).
      const r = await fetch(`${API}/api/v1/document-templates/${criado.id}/file`, {
        headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` },
      });
      const back = Buffer.from(await r.arrayBuffer());
      check(r.status === 200, `[web] preview/download do .docx responde 200 (${r.status})`);
      check(back.length === docxBytes.length && back.equals(docxBytes), `[web] round-trip do arquivo: bytes idênticos (${back.length})`);
      check(r.headers.get('content-type')?.includes('wordprocessingml'), '[web] content-type é .docx');

      // :11 — o PREVIEW tem que ser visualizável, não um download: o servidor devolve
      // o modelo convertido em PDF, que o navegador abre na aba (nenhum navegador
      // renderiza .docx). Sem filename no Content-Disposition = inline.
      const pv = await fetch(`${API}/api/v1/document-templates/${criado.id}/preview`, {
        headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` },
      });
      check(pv.status === 200, `[web] preview responde 200 (${pv.status})`);
      check(pv.headers.get('content-type')?.includes('pdf'),
        `[web] preview é PDF, exibível na aba (${pv.headers.get('content-type')})`);
      const pvBytes = Buffer.from(await pv.arrayBuffer());
      check(pvBytes.subarray(0, 4).toString() === '%PDF', '[web] o preview é um PDF válido');
      check(!/filename/i.test(pv.headers.get('content-disposition') ?? ''),
        '[web] preview abre inline em vez de baixar (:11)');

      // ── 6b: template COM ERRO de sintaxe → a tela mostra os problemas ──
      // Gera um .docx com {{#if}} sem {{/if}} e filtro inexistente.
      const ruimTxt = path.join(dir, 'ruim.txt');
      writeFileSync(ruimTxt, '{{#if ativo}}Sim\n{{itens|soma()}}\n');
      execFileSync('soffice', ['--headless', '--convert-to', 'docx', '--outdir', dir, ruimTxt], { stdio: 'ignore', timeout: 120000 });
      await page.locator('[data-testid=doc-file-input]').setInputFiles(path.join(dir, 'ruim.docx'));
      await page.waitForSelector('[data-testid=doc-issues]', { timeout: 15000 }).catch(() => {});
      const issuesTxt = await page.locator('[data-testid=doc-issues]').innerText().catch(() => '');
      check(/\/if/.test(issuesTxt), `[web] a tela lista o erro do {{#if}} sem {{/if}}`);
      check(/Filtro desconhecido/i.test(issuesTxt), '[web] a tela lista o filtro desconhecido');
      // E o modelo fica marcado como inválido na API (efeito, não só texto na tela).
      const detRuim = await api(token, `/api/v1/document-templates/${criado.id}`);
      check(detRuim.body?.templateValid === false, '[api] modelo com erro de sintaxe fica templateValid=false');

      // Reenvia o .docx BOM → os erros somem e volta a ser válido (o fluxo de correção).
      await page.locator('[data-testid=doc-file-input]').setInputFiles(docxPath);
      await page.waitForTimeout(2500);
      const detBom = await api(token, `/api/v1/document-templates/${criado.id}`);
      check(detBom.body?.templateValid === true, '[api] reenviar o template corrigido volta a validar');

      // ── Só .docx: um .txt é rejeitado pelo servidor ──
      const form = new FormData();
      form.append('file', new Blob([readFileSync(txtPath)], { type: 'text/plain' }), 'naoaceito.txt');
      const up = await fetch(`${API}/api/v1/document-templates/${criado.id}/file`, {
        method: 'POST', headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` }, body: form,
      });
      const upBody = await up.json().catch(() => null);
      check(up.status === 422 && upBody?.error === 'not_docx', `[api] arquivo que não é .docx é recusado (${up.status}/${upBody?.error})`);

      // O arquivo bom continua lá (a recusa não apagou nada).
      const det2 = await api(token, `/api/v1/document-templates/${criado.id}`);
      check(det2.body?.fileName === 'modelo.docx', '[api] a recusa não apagou o arquivo válido');

      await page.screenshot({ path: `${OUT}/modelos-documento.png`, fullPage: true });
      await page.locator('[role=dialog] button', { hasText: 'Cancelar' }).click().catch(() => {});
      await page.waitForTimeout(400);

      // ── AUDITORIA (:7, :8): unidade organizacional e status INATIVO persistem ──
      // Os campos existiam na tela mas nenhum teste provava que salvam (o cadastro
      // acima usou "sem unidade" e status ativo) — clássico check que passa em falso.
      const unidades = (await api(token, '/api/v1/org-units/tree')).body ?? [];
      if (unidades.length > 0) {
        const alvo = unidades[0];
        await page.locator('[data-testid=doc-linha]', { hasText: NOME }).locator('button[title="Editar"]').click();
        await page.waitForSelector('[role=dialog]', { timeout: 8000 });
        await page.waitForSelector('[data-testid=doc-carregando]', { state: 'detached', timeout: 10000 }).catch(() => {});
        // Unidade: combobox pesquisável.
        await page.locator('[role=dialog] label:has-text("Unidade")').locator('xpath=..').locator('button').first().click();
        await page.waitForSelector('input[placeholder="Pesquisar…"]', { timeout: 5000 });
        // Escopa às opções do painel ABERTO (o combobox abre em portal): um
        // `ul li button` global pegaria uma lista atrás do overlay do diálogo.
        await page.locator('input[placeholder="Pesquisar…"]').locator('xpath=../../ul/li/button')
          .nth(1).click(); // 1ª unidade real (após "— sem unidade —")
        await page.waitForTimeout(300);
        // Status: inativo.
        await page.locator('[role=dialog] input[type=radio][value="inativo"]').check();
        await page.locator('[role=dialog] button', { hasText: 'Salvar' }).click();
        await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 10000 }).catch(() => {});

        const dep = await api(token, `/api/v1/document-templates/${criado.id}`);
        check(!!dep.body?.orgUnitId, `[web] unidade organizacional persiste (${dep.body?.orgUnitId ?? 'null'})`);
        check(dep.body?.active === false, `[web] status INATIVO persiste (active=${dep.body?.active})`);
        void alvo;

        // Volta para ativo (os passos seguintes esperam o modelo utilizável).
        await api(token, `/api/v1/document-templates/${criado.id}`, 'PUT',
          { name: NOME, description: 'modelo de teste e2e', orgUnitId: dep.body?.orgUnitId, active: true, outputType: 'pdf' });
        await page.reload({ waitUntil: 'networkidle' });
      }

      // ── 6c: botão TESTAR → modal com o JSON das chaves → gera o documento ──
      // O modelo carregado tem {{nome_cliente}} e {{valor}} (gerado no setup).
      await page.locator('[data-testid=doc-linha]', { hasText: NOME }).locator('button[title="Testar o modelo"]').click();
      await page.waitForSelector('[data-testid=doc-json]', { timeout: 15000 });
      const skeleton = await page.locator('[data-testid=doc-json]').inputValue();
      let parsedSkeleton = null;
      try { parsedSkeleton = JSON.parse(skeleton); } catch { /* segue como null */ }
      check(parsedSkeleton !== null && 'nome_cliente' in parsedSkeleton && 'valor' in parsedSkeleton,
        `[web] o modal monta o JSON com as chaves do modelo (${Object.keys(parsedSkeleton ?? {}).join(', ')})`);

      // JSON inválido não pode gerar nada — tem que avisar.
      await page.locator('[data-testid=doc-json]').fill('{ isso nao e json');
      await page.locator('[data-testid=doc-gerar]').click();
      await page.waitForTimeout(600);
      check(await page.locator('[data-testid=doc-erro]').count() === 1, '[web] JSON inválido mostra erro em vez de gerar');

      // Preenche e gera de verdade: a nova aba recebe o arquivo.
      await page.locator('[data-testid=doc-json]').fill(JSON.stringify({ nome_cliente: 'ACME LTDA', valor: '1.234,56' }, null, 2));
      const [popup] = await Promise.all([
        ctx.waitForEvent('page', { timeout: 20000 }).catch(() => null),
        page.locator('[data-testid=doc-gerar]').click(),
      ]);
      check(!!popup, '[web] "Gerar documento" abre o arquivo em nova aba');
      if (popup) await popup.close();
      await page.locator('[role=dialog] button', { hasText: 'Retornar' }).click();
      await page.waitForTimeout(400);

      // EFEITO real: o documento gerado contém os valores E as marcas de teste.
      const gen = await fetch(`${API}/api/v1/document-templates/${criado.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: { nome_cliente: 'ACME LTDA', valor: '1.234,56' } }),
      });
      check(gen.status === 200, `[api] geração do documento de teste responde 200 (${gen.status})`);
      const genBytes = Buffer.from(await gen.arrayBuffer());
      // Este modelo está com saída PDF (marcada no cadastro) → sai PDF de verdade.
      const ehPdf = genBytes.subarray(0, 4).toString('ascii') === '%PDF';
      check(ehPdf, `[api] modelo com saída PDF gera PDF de verdade (magic="${genBytes.subarray(0, 4).toString('ascii')}")`);
      writeFileSync(path.join(dir, 'gerado.pdf'), genBytes);
      const pdfTexto = execFileSync('pdftotext', [path.join(dir, 'gerado.pdf'), '-'], { timeout: 60000 }).toString();
      check(pdfTexto.includes('ACME LTDA'), '[api] o PDF gerado contém o valor preenchido (ACME LTDA)');
      check(!pdfTexto.includes('{{'), '[api] o PDF não tem chaves sobrando');
      check(/DOCUMENTO DE TESTE/i.test(pdfTexto), '[api] o PDF de teste traz o aviso de marca d\'água');

      // E o mesmo modelo com saída DOCX: confere conteúdo, marca e TRAVA de edição.
      const { body: mDocx } = await api(token, '/api/v1/document-templates/', 'POST',
        { name: `Docx Saida ${rid}`, outputType: 'docx', active: true });
      const fdDocx = new FormData();
      fdDocx.append('file', new Blob([docxBytes]), 'modelo.docx');
      await fetch(`${API}/api/v1/document-templates/${mDocx.id}/file`, {
        method: 'POST', headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` }, body: fdDocx,
      });
      const genD = await fetch(`${API}/api/v1/document-templates/${mDocx.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: { nome_cliente: 'ACME LTDA', valor: '1.234,56' } }),
      });
      // Lê as partes do .docx (zip) direto para stdout com `unzip -p`: extrair para
      // disco dá EACCES, porque as entradas do zip gerado carregam permissão restritiva.
      const docxPathGerado = path.join(dir, 'gerado.docx');
      writeFileSync(docxPathGerado, Buffer.from(await genD.arrayBuffer()));
      const unzipPart = (part) => execFileSync('unzip', ['-p', docxPathGerado, part], { timeout: 60000 }).toString();
      const xml = unzipPart('word/document.xml');
      check(xml.includes('ACME LTDA'), '[api] o .docx gerado contém o valor preenchido');
      check(!xml.includes('{{nome_cliente}}'), '[api] a chave foi substituída (não sobrou {{nome_cliente}})');
      check(/DOCUMENTO DE TESTE/i.test(xml), '[api] documento de teste sai com o aviso de marca d\'água');
      const settingsXml = unzipPart('word/settings.xml');
      check(/documentProtection[^>]*w:edit="readOnly"/.test(settingsXml), '[api] documento de teste sai travado para edição');

      // ── 6e: BUSCAR CAMPOS DISPONÍVEIS (:42-:44) ──
      // Publica um serviço PRÓPRIO com grupo e LISTA DINÂMICA: assim o teste não depende
      // de qual serviço está em 1º lugar (varia conforme as outras suítes) e ainda prova
      // a "chave já agrupada" que a spec pede para listas dinâmicas.
      const FORM_SVC = {
        components: [
          { type: 'group', label: 'Solicitante', components: [{ type: 'textfield', key: 'nome_req', label: 'Nome' }] },
          { type: 'dynamiclist', key: 'itens', label: 'Itens', components: [{ type: 'number', key: 'valor_item', label: 'Valor' }] },
        ],
      };
      const SVC_NOME = `Servico Campos ${rid}`;
      const svcXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="P" name="${SVC_NOME}" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>${JSON.stringify(FORM_SVC)}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;
      const svcSalvo = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: svcXml });
      await api(token, `/api/v1/workflow/process-definitions/${svcSalvo.body.key}/status`, 'PATCH', { status: 'published' });

      await page.locator('[data-testid=doc-buscar-campos]').click();
      await page.waitForSelector('[role=dialog]', { timeout: 8000 });
      await page.locator('[role=dialog] label:has-text("Serviço")').locator('xpath=..').locator('button').first().click();
      await page.waitForSelector('input[placeholder="Pesquisar…"]', { timeout: 5000 });
      const opcoesServico = page.locator('input[placeholder="Pesquisar…"]').locator('xpath=../../ul/li/button');
      const qtdServicos = await opcoesServico.count();
      check(qtdServicos > 0, `[web] o modal lista os serviços disponíveis (${qtdServicos})`);
      // Filtra pelo nome do serviço recém-publicado (o combobox é pesquisável).
      await page.fill('input[placeholder="Pesquisar…"]', SVC_NOME);
      await page.waitForTimeout(400);
      await opcoesServico.first().click();
      await page.waitForTimeout(300);
      const [abaCampos] = await Promise.all([
        ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null),
        page.locator('[data-testid=campos-buscar]').click(),
      ]);
      check(!!abaCampos, '[web] "Buscar" abre os campos do serviço em nova aba');
      if (abaCampos) {
        await abaCampos.waitForLoadState('networkidle').catch(() => {});
        await abaCampos.waitForSelector('[data-testid=campos-tabela], text=Campos disponíveis', { timeout: 15000 }).catch(() => {});
        const txtCampos = await abaCampos.evaluate(() => document.body.innerText);
        check(/Chave/i.test(txtCampos) && /Nome/i.test(txtCampos), '[web] a aba mostra nome e chave dos campos');
        const linhas = await abaCampos.locator('[data-testid=campo-linha]').count();
        check(linhas >= 2, `[web] a aba lista os campos do serviço (${linhas})`);
        // Agrupamento vira seção e a chave do campo simples fica sem prefixo.
        // innerText devolve o texto JÁ em maiúsculas (o título da seção tem `uppercase`
        // no CSS) — comparar sensível a maiúsculas dava falso-negativo.
        check(/solicitante/i.test(txtCampos), '[web] a aba mostra o AGRUPAMENTO do campo');
        check(/\bnome_req\b/.test(txtCampos), '[web] chave do campo simples aparece sem prefixo');
        // O ponto central do :44: campo de LISTA DINÂMICA sai com a chave já agrupada.
        check(/itens\.valor_item/.test(txtCampos), '[web] campo de lista dinâmica sai com a chave AGRUPADA (itens.valor_item)');
        check(/lista dinâmica/i.test(txtCampos), '[web] a aba sinaliza que o campo vem de lista dinâmica');
        await abaCampos.screenshot({ path: `${OUT}/service-fields.png` });
        await abaCampos.close();
      }
      await page.locator('[role=dialog] button', { hasText: 'Fechar' }).click().catch(() => {});
      await page.waitForTimeout(300);

      // ── 6e: MANUAL técnico (:45-:46) ──
      const [abaManual] = await Promise.all([
        ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null),
        page.locator('[data-testid=doc-manual]').click(),
      ]);
      check(!!abaManual, '[web] o helper abre o manual técnico em nova aba');
      if (abaManual) {
        await abaManual.waitForSelector('[data-testid=manual-templates]', { timeout: 15000 }).catch(() => {});
        const txtManual = await abaManual.evaluate(() => document.body.innerText);
        check(/qrcode/i.test(txtManual) && /sum\(\)/i.test(txtManual) && /#if/i.test(txtManual),
          '[web] o manual documenta as chaves do template');
        await abaManual.screenshot({ path: `${OUT}/manual-templates.png` });
        await abaManual.close();
      }

      // ── 6e (:42): o botão precisa estar DENTRO do editor do modelo ──
      await page.locator('[data-testid=doc-linha]', { hasText: NOME }).locator('button[title="Editar"]').click();
      await page.waitForSelector('[role=dialog]', { timeout: 8000 });
      await page.waitForSelector('[data-testid=doc-carregando]', { state: 'detached', timeout: 10000 }).catch(() => {});
      check(await page.locator('[data-testid=dlg-buscar-campos]').count() === 1,
        '[web] "Buscar campos disponíveis" está dentro do editor do modelo');
      await page.locator('[data-testid=dlg-buscar-campos]').click();
      await page.waitForSelector('[data-testid=campos-buscar]', { timeout: 8000 });
      check(true, '[web] o modal de campos abre a partir do editor');
      await page.locator('[role=dialog] button', { hasText: 'Fechar' }).first().click();
      await page.waitForTimeout(300);
      await page.locator('[role=dialog] button', { hasText: 'Cancelar' }).first().click().catch(() => {});
      await page.waitForTimeout(300);

      // ── 6d: HISTÓRICO de execuções (:30-:37) ──
      // As gerações acima já devem estar registradas: abre o histórico e confere os
      // campos da spec (data relativa, requisitante, duração, tipo, status, payload).
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('[data-testid=doc-linha]', { hasText: NOME })
        .locator('button[title="Histórico de execuções"]').click();
      await page.waitForSelector('[data-testid=doc-historico]', { timeout: 15000 });
      const hist = await page.locator('[data-testid=doc-historico]').innerText();
      check(/há .* (segundo|minuto|hora)/i.test(hist) || /agora/i.test(hist),
        `[web] histórico mostra o tempo relativo (${(hist.match(/\((há|em|agora)[^)]*\)?/) ?? ['—'])[0]})`);
      check(/Administrador/.test(hist), '[web] histórico mostra o requisitante');
      check(/Teste/.test(hist), '[web] histórico mostra o tipo (Teste)');
      check(/Sucesso/i.test(hist), '[web] histórico mostra o status');
      check(/\d+\s?(ms|s)\b/.test(hist), '[web] histórico mostra a duração');
      // Payload do que foi enviado.
      await page.locator('[data-testid=doc-historico] button', { hasText: 'Ver payload' }).first().click();
      await page.waitForTimeout(300);
      const comPayload = await page.locator('[data-testid=doc-historico]').innerText();
      check(/ACME LTDA/.test(comPayload), '[web] histórico mostra o payload enviado');
      await page.screenshot({ path: `${OUT}/modelos-documento-historico.png` });
      await page.locator('[role=dialog] button', { hasText: 'Fechar' }).click();
      await page.waitForTimeout(300);

      // Uma geração que FALHA precisa aparecer com o erro visível (:36).
      const fdRuim = new FormData();
      fdRuim.append('file', new Blob([Buffer.from('nao sou docx')]), 'quebrado.docx');
      const mRuim = (await api(token, '/api/v1/document-templates/', 'POST',
        { name: `Falha Hist ${rid}`, outputType: 'docx', active: true })).body;
      await fetch(`${API}/api/v1/document-templates/${mRuim.id}/file`, {
        method: 'POST', headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` }, body: fdRuim,
      });
      const rFalha = await fetch(`${API}/api/v1/document-templates/${mRuim.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: {} }),
      });
      check(rFalha.status === 400, `[api] geração com .docx corrompido não dá 500 (${rFalha.status})`);
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('[data-testid=doc-linha]', { hasText: `Falha Hist ${rid}` })
        .locator('button[title="Histórico de execuções"]').click();
      await page.waitForSelector('[data-testid=doc-historico]', { timeout: 15000 });
      check(/Falhou/i.test(await page.locator('[data-testid=doc-historico]').innerText()),
        '[web] a geração que falhou aparece como "Falhou" no histórico');
      await page.locator('[data-testid=doc-ver-erro]').first().click();
      await page.waitForTimeout(300);
      const erroTxt = await page.locator('[data-testid=doc-erro-detalhe]').innerText();
      check(erroTxt.length > 10, `[web] "Ver erro" mostra o motivo da falha ("${erroTxt.slice(0, 40)}…")`);
      await page.locator('[role=dialog] button', { hasText: 'Fechar' }).click();
      await page.waitForTimeout(300);

      // ── AUDITORIA (rules.md): salvar-antes-de-carregar ──
      // Abrir "Editar" com a API lenta NÃO pode mostrar um form vazio salvável — senão
      // o usuário digita, salva, e o PUT vai com descrição/unidade em branco (perda de
      // dados, a mesma classe de bug da Fase 3).
      // Cache FRIO: recarrega antes (o React Query já tinha o detalhe do open anterior;
      // com cache quente não há requisição para atrasar e o form abre preenchido).
      await page.reload({ waitUntil: 'networkidle' });
      await page.route((u) => new RegExp(`/api/v1/document-templates/${criado.id}$`).test(u.pathname),
        async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); }, { times: 1 });
      await page.locator('[data-testid=doc-linha]', { hasText: NOME }).locator('button[title="Editar"]').click();
      await page.waitForSelector('[role=dialog]', { timeout: 8000 });
      await page.waitForTimeout(400); // ainda dentro do atraso: o dado NÃO chegou
      const carregandoVisivel = await page.locator('[data-testid=doc-carregando]').count();
      // O que prova a guarda é o form NÃO existir enquanto carrega: sem ele o usuário
      // não tem como digitar e disparar um PUT com os outros campos em branco.
      // (Checar só "Salvar desabilitado" passaria em falso — ele já fica disabled por
      // `!name` mesmo com o form vazio renderizado.)
      const camposRenderizados = await page.locator('[role=dialog] input, [role=dialog] textarea').count();
      check(carregandoVisivel === 1, '[web] editar com API lenta mostra "carregando" em vez de form vazio');
      check(camposRenderizados === 0, `[web] nenhum campo editável renderizado antes do dado chegar (${camposRenderizados})`);

      // Depois de carregar, os dados do modelo estão lá (não foram perdidos).
      await page.waitForSelector('[data-testid=doc-carregando]', { state: 'detached', timeout: 10000 });
      const descCarregada = await page.locator('[role=dialog] textarea').first().inputValue();
      check(descCarregada === 'modelo de teste e2e', `[web] descrição carregada no form ("${descCarregada}")`);
      // Salva sem tocar em nada → nada pode ser apagado.
      await page.locator('[role=dialog] button', { hasText: 'Salvar' }).click();
      await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 10000 }).catch(() => {});
      const depois = await api(token, `/api/v1/document-templates/${criado.id}`);
      check(depois.body?.description === 'modelo de teste e2e' && depois.body?.outputType === 'pdf',
        `[web] salvar sem editar NÃO apaga campos (desc="${depois.body?.description}", saída=${depois.body?.outputType})`);

      // ── AUDITORIA: costura — .docx corrompido não pode virar 500 ──
      const fake = new FormData();
      fake.append('file', new Blob([Buffer.from('isto nao e um docx de verdade')]), 'corrompido.docx');
      const rFake = await fetch(`${API}/api/v1/document-templates/${criado.id}/file`, {
        method: 'POST', headers: { 'X-Tenant': 'prefeitura-x', Authorization: `Bearer ${token}` }, body: fake,
      });
      const fakeBody = await rFake.json().catch(() => null);
      check(rFake.status === 200 && fakeBody?.templateValid === false,
        `[api] .docx corrompido responde com erro tratado, não 500 (${rFake.status})`);
      check((fakeBody?.issues ?? []).some((i) => /não foi possível ler|docx/i.test(i.message)),
        '[api] o erro do arquivo ilegível é explicado ao usuário');
    }
  } finally { await ctx.close(); }
}
await browser.close();

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

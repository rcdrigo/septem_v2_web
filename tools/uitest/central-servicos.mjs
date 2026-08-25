// Fase 8 — Central de serviços (área PÚBLICA).
// O ponto da suíte é o "sem login": tudo aqui roda num contexto de navegador SEM
// sessão. Se algum dia a página passar a exigir token, estes checks caem — que é
// exatamente o que se quer proteger. Web 1280 + mobile 375.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));
const erros = [];
const vigiar = (p, rot) => p.on('pageerror', (e) => erros.push(`${rot}: ${e.message.slice(0, 160)}`));

const api = async (t, p, m = 'GET', b) => {
  const r = await fetch(API + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;
const rid = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');

// Uma categoria com cor e ícone, para provar o agrupamento visual.
// ⚠️ O `categoryId` do XML é o SLUG DO NOME da categoria (ProcessDefinitionService
// .ResolveCategoryAsync), não o id numérico. Usar um nome que já é um slug deixa os
// dois lados iguais e evita depender da regra de slugificação.
// Só letras e dígitos: o Slugifier troca qualquer não-alfanumérico por `_`, então
// um nome com hífen viraria `cidadania_123` e não casaria com o `categoryId` do XML.
const nomeCategoria = `cidadania${rid}`;
// A rota é `/api/v1/categories/` COM barra: sem ela o redirect transforma o POST em
// GET, devolve 200 com a lista, e um check de status passa em falso — foi o que
// aconteceu aqui. Por isso a asserção é sobre a categoria EXISTIR, não sobre o status.
const cat = await api(token, '/api/v1/categories/', 'POST', { name: nomeCategoria, color: '#7c3aed', icon: 'Users' });
const listaCat = await api(token, '/api/v1/categories');
check((listaCat.body ?? []).some((c) => c.name === nomeCategoria),
  `[api] categoria "${nomeCategoria}" existe de fato (POST ${cat.status})`);
const catId = nomeCategoria;

const proc = (nome, flags, categoria) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d${nome}" targetNamespace="x">
  <bpmn:process id="P${nome}" name="${nome}" isExecutable="true">
    <bpmn:extensionElements>
      <septem:processConfig status="draft" description="Servico de teste ${rid}" ${flags} ${categoria ? `categoryId="${categoria}"` : ''} />
      <septem:formSchema>${JSON.stringify({ components: [{ type: 'textfield', key: 'nome', label: 'Nome' }] })}</septem:formSchema>
    </bpmn:extensionElements>
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="T" name="Analisar"><bpmn:extensionElements><septem:actionButtons><septem:actionButton id="ok" label="Concluir" /></septem:actionButtons></bpmn:extensionElements><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" /><bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
  <bpmndi:BPMNDiagram xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Di${nome}"><bpmndi:BPMNPlane id="Pl${nome}" bpmnElement="P${nome}" /></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const publicar = async (nome, flags, categoria) => {
  const s = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: proc(nome, flags, categoria) });
  check(s.status === 201, `[api] ${nome} criado (${s.status})`);
  await api(token, `/api/v1/workflow/process-definitions/${s.body.key}/status`, 'PATCH', { status: 'published' });
  return s.body.key;
};

// Chaves oficiais de TESTE da Cloudflare: a pública sempre resolve o widget e a
// secreta sempre aprova no servidor. São determinísticas — é o que permite testar o
// caminho anônimo inteiro sem depender de uma conta real.
const cfg = await api(token, '/api/v1/settings/public', 'PUT', {
  turnstileSiteKey: '1x00000000000000000000AA',
  turnstileSecret: '1x0000000000000000000000000000000AA',
});
check(cfg.status === 200, `[api] chaves de teste do Turnstile configuradas (${cfg.status})`);

const keyExterno = await publicar(`ExternoLogin${rid}`, 'allowExternal="true"', catId);
const keyAnonimo = await publicar(`Anonimo${rid}`, 'allowAnonymous="true"', catId);
const keyInterno = await publicar(`Interno${rid}`, '');

/** CPF válido e aleatório — CPF fixo colide com a execução anterior (o banco não reseta). */
function cpfValido() {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (let pos = 9; pos < 11; pos++) {
    let soma = 0;
    for (let i = 0; i < pos; i++) soma += d[i] * (pos + 1 - i);
    const resto = (soma * 10) % 11;
    d[pos] = resto === 10 ? 0 : resto;
  }
  return d.join('');
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
try {
  for (const view of [{ name: 'web', w: 1280, h: 900 }, { name: 'mobile', w: 375, h: 812 }]) {
    // ⚠️ Contexto NOVO e SEM login — é a condição que a fase existe para garantir.
    // `hasTouch`/`isMobile` não são enfeite: sem eles o Chrome continua dizendo
    // `hover: hover`, e a regra que mantém o "Acessar" visível no celular nunca é
    // exercitada — o teste passaria medindo o comportamento de desktop estreito.
    const ctx = await browser.newContext({
      viewport: { width: view.w, height: view.h }, deviceScaleFactor: 2,
      hasTouch: view.name === 'mobile', isMobile: view.name === 'mobile',
    });
    const page = await ctx.newPage();
    vigiar(page, view.name);

    // ── 1) O card na tela de login ────────────────────────────────────────
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    const card = page.locator('[data-testid=login-central-servicos]');
    await card.waitFor({ timeout: 15000 });
    check(true, `[${view.name}] o card "Central de serviços" aparece na tela de login`);

    // ⭐ Contraste MEDIDO: a suíte já passou uma vez com o card praticamente
    // invisível (texto claro sobre fundo claro), porque só conferia texto e opacidade.
    const contraste = await card.evaluate((el) => {
      // As cores do produto são `oklch(...)`. Em vez de converter na mão — foi assim
      // que a primeira versão deste check leu 1.01:1 num card perfeitamente legível —
      // pinta num canvas e deixa o NAVEGADOR resolver para RGB.
      const ctx = document.createElement('canvas').getContext('2d');
      const paraRgb = (cor) => {
        ctx.fillStyle = '#000';
        ctx.fillStyle = cor;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
      };
      const lum = (cor) => {
        const [r, g, b] = paraRgb(cor).map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const titulo = el.querySelector('.login-services-titulo');
      const [a, b] = [lum(getComputedStyle(titulo).color), lum(getComputedStyle(el).backgroundColor)]
        .sort((x, y) => y - x);
      return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
    });
    check(contraste >= 4.5, `[${view.name}] o título do card tem contraste legível (${contraste}:1)`);

    // Repouso: é o estado em que o card é encontrado. O screenshot do HOVER
    // esconderia justamente o que se quer conferir (o card legível por baixo).
    await page.screenshot({ path: `${OUT}/central-login-card-${view.name}.png`, fullPage: true });

    const textoCard = await card.innerText();
    check(/Central de servi/i.test(textoCard), `[${view.name}] com o título pedido`);
    check(/cidad/i.test(textoCard), `[${view.name}] e o subtítulo descritivo`);

    // O card INTEIRO é clicável — e é um link, não uma div com onClick.
    check(await card.evaluate((el) => el.tagName === 'A'),
      `[${view.name}] o card é um link (funciona por teclado e em nova aba)`);

    // O card fica ABAIXO do card principal, como a spec pede.
    const ordem = await page.evaluate(() => {
      const principal = document.querySelector('.login-card')?.getBoundingClientRect();
      const central = document.querySelector('[data-testid=login-central-servicos]')?.getBoundingClientRect();
      return principal && central ? { principal: principal.bottom, central: central.top } : null;
    });
    check(!!ordem && ordem.central >= ordem.principal - 2,
      `[${view.name}] o card fica ABAIXO do card de login`);

    // O convite "Acessar" é PERMANENTE — vale nos dois tamanhos, sem depender do
    // que o navegador declara sobre hover (o emulador do Chromium mente sobre isso).
    const chip = page.locator('[data-testid=login-central-chip]');
    check(await chip.isVisible() && /Acessar/i.test(await chip.innerText()),
      `[${view.name}] o card mostra "Acessar" de forma permanente`);

    // No desktop, o overlay ainda realça no hover (enfeite, não a única pista).
    if (view.name === 'web') {
      const overlay = page.locator('[data-testid=login-central-overlay]');
      const antes = await overlay.evaluate((el) => getComputedStyle(el).opacity);
      await card.hover();
      await page.waitForTimeout(500);
      const depois = await overlay.evaluate((el) => getComputedStyle(el).opacity);
      check(antes === '0' && depois === '1', `[${view.name}] o overlay realça no hover (${antes} → ${depois})`);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
    }

    // ── 2) Clicar leva à Central, SEM login ───────────────────────────────
    await card.click();
    await page.waitForURL((u) => u.pathname.includes('/external-services'), { timeout: 15000 });
    await page.waitForSelector('[data-testid=central-servicos]', { timeout: 15000 });
    const temToken = await page.evaluate(() => !!localStorage.getItem('septem.access'));
    check(!temToken, `[${view.name}] a Central abre SEM sessão`);

    // ── 3) A vitrine lista o que é público e esconde o resto ──────────────
    await page.waitForSelector('[data-testid=central-servico]', { timeout: 15000 });
    const listados = await page.locator('[data-testid=central-servico]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('data-key')));
    check(listados.includes(keyExterno), `[${view.name}] serviço externo aparece`);
    check(listados.includes(keyAnonimo), `[${view.name}] serviço anônimo aparece`);
    // ⭐ O que a fase existe para impedir.
    check(!listados.includes(keyInterno), `[${view.name}] serviço INTERNO não aparece na vitrine pública`);

    // ── 4) Agrupamento por categoria, com cor ─────────────────────────────
    const grupo = page.locator('[data-testid=central-grupo]', { hasText: nomeCategoria }).first();
    check(await grupo.count() > 0, `[${view.name}] os serviços vêm agrupados pela categoria`);
    const cor = await grupo.locator('span').first().evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => '');
    check(/rgb/.test(cor), `[${view.name}] a categoria mostra a cor configurada (${cor})`);

    // ── 5) O visitante sabe, antes de clicar, se precisa de conta ─────────
    const cardExterno = page.locator(`[data-testid=central-servico][data-key="${keyExterno}"]`);
    const cardAnonimo = page.locator(`[data-testid=central-servico][data-key="${keyAnonimo}"]`);
    check(await cardExterno.locator('[data-testid=central-exige-login]').count() === 1,
      `[${view.name}] serviço com login avisa que exige conta`);
    check(await cardAnonimo.locator('[data-testid=central-sem-login]').count() === 1,
      `[${view.name}] serviço anônimo avisa que dispensa cadastro`);

    // ── 6) A busca FILTRA (asserção da lista, não do campo existir) ───────
    await page.fill('[data-testid=central-busca]', `Anonimo${rid}`);
    await page.waitForTimeout(500);
    const apos = await page.locator('[data-testid=central-servico]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('data-key')));
    check(apos.includes(keyAnonimo) && !apos.includes(keyExterno),
      `[${view.name}] a busca filtra a lista (${apos.length} resultado(s))`);

    await page.fill('[data-testid=central-busca]', 'zzz-nao-existe-zzz');
    await page.waitForTimeout(500);
    check(await page.locator('[data-testid=central-vazio]').count() === 1,
      `[${view.name}] busca sem resultado explica que não achou`);
    await page.fill('[data-testid=central-busca]', '');
    await page.waitForTimeout(400);

    // ── 7) Formulário público do serviço ANÔNIMO ─────────────────────────
    // ⚠️ Nada de `networkidle` aqui: o widget do Turnstile é script externo e mantém
    // conexão aberta com a Cloudflare, então a rede NUNCA fica ociosa. Espera-se a tela.
    await page.goto(`${BASE}/external-services/${keyAnonimo}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid=servico-publico]', { timeout: 15000 });
    check(/Anonimo/.test(await page.locator('[data-testid=servico-titulo]').innerText()),
      `[${view.name}] o formulário público abre pelo nome do serviço`);
    check(await page.evaluate(() => !localStorage.getItem('septem.access')),
      `[${view.name}] o formulário público abre SEM sessão`);

    // O captcha aparece e o envio fica bloqueado até ele responder.
    await page.waitForSelector('[data-testid=turnstile]', { timeout: 15000 });
    const enviar = page.locator('[data-testid=servico-enviar]');
    const bloqueadoNoInicio = await enviar.isDisabled();
    check(bloqueadoNoInicio, `[${view.name}] o envio nasce bloqueado, à espera do captcha`);

    // O widget do Turnstile é script externo: se a rede não permitir, a suíte não pode
    // inventar um token — mede o que dá para medir e diz o que ficou de fora.
    const liberou = await page.waitForFunction(
      () => !document.querySelector('[data-testid=servico-enviar]')?.hasAttribute('disabled'),
      null, { timeout: 20000 }).then(() => true).catch(() => false);

    if (liberou) {
      const resposta = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/submit'), { timeout: 20000 }),
        enviar.click(),
      ]).then(([r]) => r.status()).catch(() => 0);
      check(resposta === 200, `[${view.name}] o envio anônimo é aceito com o captcha resolvido (HTTP ${resposta})`);
      const protocolo = await page.locator('[data-testid=servico-protocolo]').innerText().catch(() => '');
      check(/\d{3,}/.test(protocolo), `[${view.name}] e a tela devolve o número de protocolo`);
    } else {
      check(false, `[${view.name}] o widget do Turnstile não liberou o envio (script externo indisponível?)`);
    }

    // ── 8) Serviço que EXIGE conta não deixa enviar ──────────────────────
    await page.goto(`${BASE}/external-services/${keyExterno}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid=servico-publico]', { timeout: 15000 });
    check(await page.locator('[data-testid=servico-exige-login]').count() === 1,
      `[${view.name}] serviço com login mostra o aviso de conta`);
    check(await page.locator('[data-testid=servico-enviar]').isDisabled(),
      `[${view.name}] e o envio fica bloqueado até haver login`);
    check(await page.locator('[data-testid=turnstile]').count() === 0,
      `[${view.name}] serviço com login não mostra captcha (o login é a barreira)`);
    await page.screenshot({ path: `${OUT}/central-form-publico-${view.name}.png`, fullPage: true });

    await page.goto(`${BASE}/external-services`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid=central-servicos]', { timeout: 15000 });

    // ── 8b) Jornada do CIDADÃO: cadastro → código → envio, sem sair da página ──
    // Reabre o serviço que EXIGE conta: o passo anterior terminou na Central.
    await page.goto(`${BASE}/external-services/${keyExterno}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid=servico-exige-login]', { timeout: 20000 });
    const emailCidadao = `cidadao-${rid}-${Date.now()}-${view.name}@teste.local`;
    check(await page.locator('[data-testid=servico-criar-conta]').count() === 1,
      `[${view.name}] o passo a passo oferece criar conta`);
    // ⚠️ `innerText` NÃO traz os marcadores da lista ("1.", "2."): procurar por eles
    // reprovaria um passo a passo perfeitamente numerado na tela. Conta os itens.
    const passos = await page.locator('[data-testid=servico-exige-login] ol li').allInnerTexts();
    check(passos.length === 3 && /conta/i.test(passos[0]) && /c[óo]digo/i.test(passos[1]),
      `[${view.name}] o aviso traz o passo a passo (${passos.length} passos)`);

    await page.locator('[data-testid=servico-criar-conta]').click();
    await page.waitForSelector('[data-testid=conta-cadastro]', { timeout: 15000 });
    await page.fill('[data-testid=conta-nome]', 'Maria Aparecida de Souza');
    await page.fill('[data-testid=conta-cpf]', cpfValido());
    await page.fill('[data-testid=conta-email]', emailCidadao);
    await page.fill('[data-testid=conta-telefone]', '(11) 99999-0000');
    await page.fill('[data-testid=conta-senha]', 'SenhaForte123');

    // O captcha do cadastro precisa resolver antes de o botão liberar.
    const liberouCadastro = await page.waitForFunction(
      () => !document.querySelector('[data-testid=conta-criar]')?.hasAttribute('disabled'),
      null, { timeout: 25000 }).then(() => true).catch(() => false);
    check(liberouCadastro, `[${view.name}] o cadastro espera o captcha antes de liberar`);

    await page.locator('[data-testid=conta-criar]').click();
    // Espera o DESFECHO — etapa do código OU mensagem de erro. Esperar só pelo sucesso
    // faz a suíte estourar com "timeout" sem dizer o que o servidor respondeu.
    const desfecho = await Promise.race([
      page.waitForSelector('[data-testid=conta-codigo]', { timeout: 25000 }).then(() => 'codigo'),
      page.waitForSelector('[data-testid=conta-erro]', { timeout: 25000 }).then(() => 'erro'),
    ]).catch(() => 'nada');
    const msgConta = await page.locator('[data-testid=conta-erro]').innerText().catch(() => '');
    check(desfecho === 'codigo',
      `[${view.name}] o cadastro pede o código NA PRÓPRIA página (desfecho: ${desfecho}${msgConta ? ' — ' + msgConta.slice(0, 60) : ''})`);
    if (desfecho !== 'codigo') { await ctx.close(); continue; }

    const codigo = await api(token, `/api/v1/auth/dev/last-code?identifier=${encodeURIComponent(emailCidadao)}&purpose=signup`);
    check(!!codigo.body?.code, `[${view.name}] o código foi enviado por e-mail`);
    await page.fill('[data-testid=conta-codigo-campo]', codigo.body.code);
    await page.locator('[data-testid=conta-confirmar]').click();

    // Confirmou → já entra, e o envio libera sem recarregar nada.
    await page.waitForSelector('[data-testid=servico-logado]', { timeout: 20000 });
    check(true, `[${view.name}] confirmar o código já autentica o cidadão`);
    check(!(await page.locator('[data-testid=servico-enviar]').isDisabled()),
      `[${view.name}] e o envio fica liberado`);

    const envioLogado = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/submit'), { timeout: 20000 }),
      page.locator('[data-testid=servico-enviar]').click(),
    ]).then(([r]) => r.status()).catch(() => 0);
    check(envioLogado === 200, `[${view.name}] o cidadão logado envia a requisição (HTTP ${envioLogado})`);
    check(/\d{3,}/.test(await page.locator('[data-testid=servico-protocolo]').innerText().catch(() => '')),
      `[${view.name}] e recebe o protocolo`);
    await page.screenshot({ path: `${OUT}/central-cidadao-${view.name}.png`, fullPage: true });

    // ── 9) Layout ─────────────────────────────────────────────────────────
    const layout = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      let clipped = 0;
      for (const el of document.querySelectorAll('[data-testid=central-servicos] *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) clipped++;
      }
      return { overflow, clipped };
    });
    check(!layout.overflow, `[${view.name}] Central sem overflow horizontal`);
    check(layout.clipped === 0, `[${view.name}] Central sem elemento recortado (${layout.clipped})`);
    await page.screenshot({ path: `${OUT}/central-servicos-${view.name}.png`, fullPage: true });

    await ctx.close();
  }
} finally {
  await browser.close();
}

check(erros.length === 0, `sem erro de JavaScript${erros.length ? ' — ' + erros.join(' | ') : ''}`);
for (const m of ok) console.log('✓', m);
for (const m of bad) console.log('✗ FALHOU', m);
console.log(bad.length ? `\nFALHOU (${bad.length} de ${ok.length + bad.length})` : `\nPASSOU (${ok.length} checks)`);
process.exit(bad.length ? 1 : 0);

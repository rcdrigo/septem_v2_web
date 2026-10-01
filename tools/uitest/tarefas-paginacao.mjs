// Caixa de tarefas PAGINADA NO SERVIDOR (PENDENCIAS 5.7). Antes a lista inteira vinha numa
// resposta só — 7.299 tarefas = 4,75 MB e 3,6 s de thread travada para pintar — e as sondas
// que aterrissavam em /tasks caíam por tempo, no sorteio. O que esta suíte prova:
//  (a) a tela pede UMA página (pageSize=50) e a resposta é pequena;
//  (b) o rodapé diz a faixa e o total do conjunto INTEIRO ("1–50 de N");
//  (c) "Próxima página" traz a fatia seguinte e "Página anterior" volta;
//  (d) filtrar estando na página 2 volta para a 1 — senão a busca que acha 1 tarefa
//      mostraria a página 2 de um conjunto de 1, isto é, nada;
//  (e) 1280 e 375 sem overflow, controles com nome acessível.
import { chromium } from 'playwright-core';
import { checarResponsivo, checarAcessibilidade } from './lib-responsivo.mjs';
import { filtrarBusca, fecharFiltros } from './lib-filtros.mjs';

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

const token = (await api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' })).body.accessToken;
const rid = String(Math.floor(Math.random() * 1e9));
const NOME = `Paginacao ${rid}`;
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dpg" targetNamespace="x">
  <bpmn:process id="Ppg" name="${NOME}" isExecutable="true">
    <bpmn:extensionElements><septem:formSchema>{"components":[{"type":"textfield","key":"assunto","label":"Assunto"}]}</septem:formSchema></bpmn:extensionElements>
    <bpmn:startEvent id="Spg"><bpmn:outgoing>F1pg</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Tpg" name="Analisar paginacao ${rid}"><bpmn:incoming>F1pg</bpmn:incoming><bpmn:outgoing>F2pg</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="Epg"><bpmn:incoming>F2pg</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1pg" sourceRef="Spg" targetRef="Tpg" />
    <bpmn:sequenceFlow id="F2pg" sourceRef="Tpg" targetRef="Epg" />
  </bpmn:process>
</bpmn:definitions>`;
const salvo = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: XML });
await api(token, `/api/v1/workflow/process-definitions/${salvo.body.key}/status`, 'PATCH', { status: 'published' });
await api(token, '/api/v1/workflow/instances', 'POST', { key: salvo.body.key, data: { assunto: `assunto ${rid}` } });

// Pré-condição: a caixa do admin tem MAIS de uma página — sem isso a suíte não provaria nada.
const inteira = await api(token, '/api/v1/workflow/tasks?assignee=me&page=1&pageSize=50');
const TOTAL = inteira.body.total;
check(TOTAL > 100, `pré-condição: o admin tem mais de duas páginas de tarefas (${TOTAL})`);

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true });
const faixa = (page) => page.locator('[data-testid=tarefas-faixa]').innerText();
const esperarFaixa = (page, re) => page.waitForFunction((src) => {
  const el = document.querySelector('[data-testid=tarefas-faixa]');
  return !!el && new RegExp(src).test(el.textContent);
}, re.source, { timeout: 20000 });

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const respostas = [];
    page.on('response', (r) => {
      if (!/\/api\/v1\/workflow\/tasks\?/.test(r.url())) return;
      const item = { url: r.url(), corpo: r.body().then((b) => b.length).catch(() => 0) };
      respostas.push(item);
    });

    await page.goto(BASE + '/login?returnUrl=/tasks', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => u.pathname === '/tasks', { timeout: 20000 });
    await esperarFaixa(page, /^1–50 de \d+/);

    // (a) uma página, resposta pequena
    const primeira = respostas.find((r) => r.url.includes('assignee=me'));
    if (primeira) primeira.bytes = await primeira.corpo;
    check(!!primeira && /[?&]page=1(&|$)/.test(primeira.url) && /[?&]pageSize=50(&|$)/.test(primeira.url),
      `[${vp.n}] a tela pede page=1&pageSize=50 (${primeira?.url.split('?')[1]})`);
    check(!!primeira && primeira.bytes < 1_000_000, `[${vp.n}] a resposta da lista tem menos de 1 MB (${primeira?.bytes} bytes)`);

    // (b) faixa e total do conjunto inteiro
    const t1 = await faixa(page);
    const totalTela = Number(t1.match(/de (\d+)/)?.[1]);
    check(totalTela >= TOTAL, `[${vp.n}] o rodapé mostra o total do conjunto inteiro: "${t1}" (API: ${TOTAL})`);
    check(await page.getByText(`Analisar paginacao ${rid}`).first().isVisible(), `[${vp.n}] a tarefa recém-criada está na página 1 (mais novas primeiro)`);

    // (c) próxima e anterior
    await page.getByRole('button', { name: 'Próxima página' }).click();
    await esperarFaixa(page, /^51–100 de \d+/);
    check(new URL(page.url()).searchParams.get('page') === '2', `[${vp.n}] "Próxima página" leva à página 2 (URL ?page=2, faixa 51–100)`);
    check(await page.getByText(`Analisar paginacao ${rid}`).count() === 0, `[${vp.n}] e a página 2 não repete a tarefa da página 1`);
    await checarResponsivo(page, check, `[${vp.n}] tarefas página 2`);
    await checarAcessibilidade(page, check, `[${vp.n}] tarefas página 2`);
    await page.screenshot({ path: `${OUT}/tarefas-paginacao-${vp.n}.png`, fullPage: false });
    await page.getByRole('button', { name: 'Página anterior' }).click();
    await esperarFaixa(page, /^1–50 de \d+/);
    check(true, `[${vp.n}] "Página anterior" volta à 1`);

    // (d) filtrar na página 2 volta para a 1
    await page.getByRole('button', { name: 'Próxima página' }).click();
    await esperarFaixa(page, /^51–100 de \d+/);
    await filtrarBusca(page, rid, 'Palavra-chave');
    await fecharFiltros(page);
    await esperarFaixa(page, /^1–1 de 1 tarefa$/);
    check(new URL(page.url()).searchParams.get('page') === '1', `[${vp.n}] filtrar na página 2 volta para a página 1`);
    check(await page.getByText(`Analisar paginacao ${rid}`).first().isVisible(), `[${vp.n}] e a busca mostra a única tarefa que casa`);
    check(await page.getByRole('button', { name: 'Próxima página' }).count() === 0, `[${vp.n}] com uma página só, os botões de página somem`);
    await ctx.close();
  }
} finally { await browser.close(); }

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

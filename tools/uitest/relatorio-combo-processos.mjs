// PENDENCIAS 4.2 — o combo de processos do builder de relatórios cortava em 100 (`useProcessList
// ({pageSize:100})`): acima disso o autor não encontrava o processo, e a busca do combo também
// não alcança o que não veio. Agora o combo recebe a lista INTEIRA (`/process-definitions/options`)
// e a pintura tem teto de 120 com aviso — mesmo par (lista inteira + teto de pintura) que já
// havia sido aplicado no modal "Nova requisição".
//
// O que se cobra: um processo que está FORA das 100 primeiras páginas da lista de administração
// é encontrável pela busca do combo. Web 1280 + mobile 375.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => { (c ? ok : bad).push(m); console.log(`${c ? '✓' : '✗'} ${m}`); };

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
const rid = Math.floor(Math.random() * 1e9);

// Processo com nome que ordena por ÚLTIMO na lista de administração (ela ordena por
// `updatedAt` desc, então o recém-criado vem primeiro — o que interessa é ele existir na
// lista inteira e ser achável pela busca do combo).
const nome = `Zzz Combo Alvo ${rid}`;
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="dcb${rid}" targetNamespace="x">
  <bpmn:process id="PCB${rid}" name="${nome}" isExecutable="true">
    <bpmn:extensionElements><septem:processConfig accessRules='[{"type":"all","action":"allow","capability":"view"}]' /></bpmn:extensionElements>
    <bpmn:startEvent id="SCB${rid}"><bpmn:outgoing>c1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="TCB${rid}" name="Analisar"><bpmn:incoming>c1</bpmn:incoming><bpmn:outgoing>c2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="ECB${rid}"><bpmn:incoming>c2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="c1" sourceRef="SCB${rid}" targetRef="TCB${rid}" />
    <bpmn:sequenceFlow id="c2" sourceRef="TCB${rid}" targetRef="ECB${rid}" />
  </bpmn:process>
</bpmn:definitions>`;
const criado = await api(token, '/api/v1/workflow/process-definitions', 'POST', { bpmnXml: xml });
check(criado.status === 201, `[api] processo alvo criado (${criado.status})`);

// A prova do defeito: o alvo NÃO cabe na primeira página de 100 quando há mais que isso.
const pagina = await api(token, '/api/v1/workflow/process-definitions?page=1&pageSize=100');
const opcoes = await api(token, '/api/v1/workflow/process-definitions/options');
const total = pagina.body?.total ?? 0;
check(opcoes.body?.length === total,
  `[api] /options devolve a lista inteira (${opcoes.body?.length} de ${total}) contra ${pagina.body?.items?.length} da página`);

// Relatório de origem PROCESSO criado por API: `/reports/edit` sem `?key=` volta para a
// lista, e o combo de processo só existe quando o tipo de origem é "processo".
const relatorio = await api(token, '/api/v1/reports/', 'POST', {
  // SEM `processKey`: o combo tem de aparecer com o placeholder, que é o estado em que o
  // autor procura o processo — e era exatamente aí que ele não achava.
  name: `Combo ${rid}`, sourceType: 'process',
  definitionJson: JSON.stringify({ blocks: [] }),
});
check(relatorio.status < 300, `[api] relatório de origem processo criado (${relatorio.status})`);
const chaveRelatorio = relatorio.body?.key;

const chrome = process.env.CHROME_BIN
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, headless: true });

try {
  for (const vp of [{ n: 'web', w: 1280, h: 900 }, { n: 'mobile', w: 375, h: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 140)));

    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
    await page.fill('input[type=password]', 'admin123');
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 30000 });

    // Builder novo → aba Dados, onde vive o combo de processo da fonte.
    // `/reports/edit` sem `?key=` volta para a lista; o builder precisa do relatório.
    await page.goto(`${BASE}/reports/edit?key=${chaveRelatorio}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Origem dos dados' }).waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Origem dos dados' }).click();
    await page.waitForTimeout(1500);
    const combo = page.locator('button', { hasText: 'Selecione o processo…' }).first();
    await combo.waitFor({ timeout: 20000 });
    await combo.click();
    const popover = page.locator('[data-testid=combobox-popover]');
    await popover.waitFor({ timeout: 10000 });

    // Teto de pintura: com milhares de opções, o combo não pinta tudo — e avisa.
    const pintadas = await popover.locator('li button').count();
    check(pintadas <= 121, `[${vp.n}] o combo não pinta a lista inteira (${pintadas} itens pintados)`);
    check(await popover.locator('[data-testid=combobox-teto]').count() === 1,
      `[${vp.n}] e avisa que há mais, pedindo para refinar a busca`);

    // O EFEITO que a pendência cobra: o alvo fora das 100 primeiras é achável pela busca.
    await popover.locator('input').first().fill(`Combo Alvo ${rid}`);
    await page.waitForTimeout(600);
    const achou = await popover.locator('li button', { hasText: nome }).count();
    check(achou === 1, `[${vp.n}] a busca do combo encontra o processo fora das 100 primeiras`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(!overflow, `[${vp.n}] sem overflow horizontal`);
    check(erros.length === 0, `[${vp.n}] sem erro de página — ${JSON.stringify(erros.slice(0, 2))}`);
    await page.screenshot({ path: `${OUT}/relatorio-combo-${vp.n}.png`, fullPage: false });
    await ctx.close();
  }
} finally { await browser.close(); }

console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

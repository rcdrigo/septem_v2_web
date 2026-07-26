// Fase 1 — o expediente configurado em Parâmetros valendo de fato no PRAZO da
// tarefa (flag "respeitar horas úteis" do modelador). Publica dois processos
// iguais — um com o flag, outro sem —, inicia os dois e compara o prazo que
// APARECE NA TELA de Tarefas. Roda em web (1280) e mobile (375).
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (cond, msg) => (cond ? ok.push(msg) : bad.push(msg));

// Prazo longo o bastante para atravessar noites e um fim de semana: 100h úteis
// (10 dias de expediente) contra 100h corridas (pouco mais de 4 dias).
const HORAS = 100;

const api = async (token, path, method, body) => {
  const r = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant': 'prefeitura-x',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const xml = (procId, nome, respeita) => `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:septem="http://septem.app/schema/1.0/bpmn" id="d_${procId}" targetNamespace="x"><bpmn:process id="${procId}" name="${nome}" isExecutable="true"><bpmn:extensionElements><septem:processConfig status="published" /></bpmn:extensionElements><bpmn:startEvent id="S_${procId}"><bpmn:outgoing>F1_${procId}</bpmn:outgoing></bpmn:startEvent><bpmn:userTask id="T_${procId}" name="${nome}"><bpmn:extensionElements><septem:deadlineConfig expiresIn="${HORAS}" respectWorkHours="${respeita}" /></bpmn:extensionElements><bpmn:incoming>F1_${procId}</bpmn:incoming><bpmn:outgoing>F2_${procId}</bpmn:outgoing></bpmn:userTask><bpmn:endEvent id="E_${procId}"><bpmn:incoming>F2_${procId}</bpmn:incoming></bpmn:endEvent><bpmn:sequenceFlow id="F1_${procId}" sourceRef="S_${procId}" targetRef="T_${procId}" /><bpmn:sequenceFlow id="F2_${procId}" sourceRef="T_${procId}" targetRef="E_${procId}" /></bpmn:process></bpmn:definitions>`;

// ── Preparo: expediente conhecido (08–18, seg–sex) + 2 processos publicados ──
const { body: auth } = await api(null, '/api/v1/auth/login', 'POST', {
  email: 'admin@prefeitura-x.local',
  password: 'admin123',
});
const token = auth.accessToken;

await api(token, '/api/v1/settings/general', 'PUT', {
  clienteNome: 'Prefeitura X',
  ambienteNome: 'Septem',
  primaryColor: '#0ea5e9',
  businessHourStart: 8,
  businessHourEnd: 18,
  businessDays: '1,2,3,4,5',
});

const CASOS = [
  { key: 'prazo_horas_uteis', nome: 'Prazo Horas Uteis', respeita: true },
  { key: 'prazo_corrido', nome: 'Prazo Corrido', respeita: false },
];

for (const c of CASOS) {
  const pub = await api(token, '/api/v1/workflow/process-definitions/', 'POST', {
    key: c.key,
    bpmnXml: xml(c.key.toUpperCase(), c.nome, c.respeita),
  });
  check(pub.status === 200 || pub.status === 201, `publicou o processo "${c.nome}" (HTTP ${pub.status})`);
  const inst = await api(token, '/api/v1/workflow/instances', 'POST', { key: c.key, data: {} });
  check(inst.status === 200 || inst.status === 201, `iniciou uma solicitação de "${c.nome}" (HTTP ${inst.status})`);
}

/** "17/07/2026 11:00" (pt-BR, exibido no popover do prazo) → Date. */
function parsePill(txt) {
  const m = txt.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

for (const view of [
  { name: 'web', width: 1280, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });

  // O usuário vai em Tarefas e lê o prazo das duas tarefas.
  await page.goto(BASE + '/tarefas', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/prazo-horas-uteis-${view.name}.png`, fullPage: true });

  // O rótulo é relativo; a data exata permanece disponível no popover acessível.
  const prazoDe = async (nome) => {
    const card = page.locator('article').filter({ hasText: nome }).first();
    const pill = card.locator('button').filter({ hasText: /Prazo:|Em atraso:/ }).first();
    await pill.scrollIntoViewIfNeeded();
    // O popover de prazos agora é renderizado em PORTAL (document.body) sob demanda:
    // focar o pill o abre na hora. A data exata fica no texto acessível do popover.
    await pill.focus();
    const tip = page.locator('[data-testid=due-popover]');
    await tip.waitFor({ state: 'visible', timeout: 5000 });
    const texto = await tip.evaluate((el) => el.textContent ?? '');
    await pill.evaluate((el) => el.blur());
    await page.waitForTimeout(150);
    return texto.match(/Conclusão estimada:\s*([^\n]+)/)?.[1]?.trim() ?? '';
  };

  const txtUteis = await prazoDe('Prazo Horas Uteis');
  const txtCorrido = await prazoDe('Prazo Corrido');
  const dUteis = parsePill(txtUteis);
  const dCorrido = parsePill(txtCorrido);

  check(!!dUteis, `[${view.name}] tarefa com horas úteis mostra o prazo na tela ("${txtUteis}")`);
  check(!!dCorrido, `[${view.name}] tarefa com prazo corrido mostra o prazo na tela ("${txtCorrido}")`);

  if (dUteis && dCorrido) {
    // 1) 100h úteis (10 dias de expediente) caem MUITO depois de 100h corridas (~4 dias).
    check(
      dUteis.getTime() > dCorrido.getTime(),
      `[${view.name}] ${HORAS}h úteis vencem depois de ${HORAS}h corridas (${dUteis.toLocaleString('pt-BR')} > ${dCorrido.toLocaleString('pt-BR')})`,
    );

    // 2) O prazo com horas úteis cai DENTRO do expediente: dia útil, entre 08h e 18h.
    const diaUtil = dUteis.getDay() >= 1 && dUteis.getDay() <= 5;
    const noExpediente = dUteis.getHours() >= 8 && dUteis.getHours() <= 18;
    check(diaUtil, `[${view.name}] o vencimento cai em dia útil (seg–sex)`);
    check(noExpediente, `[${view.name}] o vencimento cai dentro do expediente (08h–18h)`);

    // 3) Prazo corrido é literalmente agora + 100h (não sofre o calendário).
    const esperado = Date.now() + HORAS * 3600 * 1000;
    check(
      Math.abs(dCorrido.getTime() - esperado) < 30 * 60 * 1000,
      `[${view.name}] sem o flag, o prazo continua corrido (agora + ${HORAS}h)`,
    );
  }

  await ctx.close();
}

await browser.close();

// Limpeza: remove os processos descartáveis (não poluem a tela de Processos).
for (const c of CASOS) {
  await api(token, `/api/v1/workflow/process-definitions/${c.key}/permanent`, 'DELETE');
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

// Fase 3 do PLANO_PROJECAO_FORMULARIO — BACKFILL do legado.
//
// O backfill não tem rota (é de propósito: roda no bootstrap, em segundo plano —
// decisão D2). Então o que esta sonda prova é o EFEITO dele sobre dado legado de
// verdade: as execuções que já existiam no banco de dev antes da Fase 2 — criadas
// nas rodadas anteriores, com formulário preenchido pela tela — ficam projetadas
// sozinhas depois que a API sobe, com os MESMOS valores do `FormData`.
//
//   1. espera a fila de pendentes zerar (a API acabou de subir);
//   2. confere paridade campo a campo em execuções ANTIGAS (>1 dia), que ninguém
//      tocou nesta sessão — é o legado que o backfill tinha de alcançar;
//   3. invariante: nenhuma linha projetada pertence a execução ainda pendente;
//   4. abre a solicitação legada na TELA (web e mobile) e confere que o valor
//      exibido é o mesmo que está na projeção.
//
// A projeção ainda não tem API (o leitor é a Fase 4), então a leitura é por `psql`
// — SELECT apenas.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const DB = process.env.SEPTEM_TENANT_DB || 'db_prefeitura_x';
const OUT = process.env.OUT_DIR || '.';
const ok = [], bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const api = async (t, p) => {
  const r = await fetch(API + p, {
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const post = async (t, p, b) => {
  const r = await fetch(API + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant': 'prefeitura-x', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify(b ?? {}),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const sql = (q) => execFileSync('psql', ['-h', 'localhost', '-U', 'postgres', '-d', DB, '-tAc', q],
  { env: { ...process.env, PGPASSWORD: 'postgres' }, encoding: 'utf8' }).trim();

try {
  sql('SELECT 1;');
} catch (e) {
  console.log('✗ [setup] não consegui ler a projeção no banco de dev: ' + e.message.split('\n')[0]);
  console.log('\nFALHOU (1 de 1)');
  process.exit(1);
}

const { body: auth } = await post(null, '/api/v1/auth/login', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
const token = auth.accessToken;

// ── 1. a fila de pendentes zera sozinha depois do boot ──────────────────────
const pendentes = () => Number(sql(`SELECT count(*) FROM flow_executions WHERE "FormDataProjectionVersion" <> 1;`));
const total = Number(sql('SELECT count(*) FROM flow_executions;'));
const inicial = pendentes();
let restantes = inicial;
for (let i = 0; i < 60 && restantes > 0; i++) { await espera(3000); restantes = pendentes(); }
check(restantes === 0,
  `[backfill] a fila de pendentes zerou sozinha após o boot (${inicial} → ${restantes}, de ${total} execuções)`);
check(total > 0 && Number(sql('SELECT count(*) FROM flow_execution_form_values;')) > 0,
  '[backfill] a projeção do tenant tem linhas');

// "0 pendentes" sozinho passaria até num banco vazio. Isto aqui prova que quem
// projetou o legado foi o BACKFILL: execução antiga cujo carimbo de projeção é
// MUITO posterior ao início dela — ninguém escreveu nesse formulário, o backfill é
// que a alcançou.
check(Number(sql(`
  SELECT count(*) FROM flow_executions
   WHERE "StartedAt" < now() - interval '1 day'
     AND "FormDataProjectedAt" > "StartedAt" + interval '1 hour';`)) > 0,
  '[backfill] execuções antigas foram projetadas DEPOIS, pelo backfill (carimbo posterior ao início)');

// E nenhuma execução com campos ficou sem linha — a cobertura é total, não amostral.
check(Number(sql(`
  SELECT count(*) FROM flow_executions e
   WHERE jsonb_typeof(e."FormData"::jsonb) = 'object' AND e."FormData"::jsonb <> '{}'::jsonb
     AND NOT EXISTS (SELECT 1 FROM flow_execution_form_values v WHERE v."ExecutionId" = e."Id");`)) === 0,
  '[backfill] nenhuma execução com campos ficou sem projeção');

// ── 3. invariante: nada projetado pendurado em execução pendente ────────────
check(Number(sql(`
  SELECT count(*) FROM flow_execution_form_values v
    JOIN flow_executions e ON e."Id" = v."ExecutionId"
   WHERE e."FormDataProjectionVersion" <> 1;`)) === 0,
  '[backfill] nenhuma linha projetada pertence a execução ainda pendente');

// ── 2. paridade em execuções ANTIGAS (o legado de verdade) ──────────────────
const antigas = sql(`
  SELECT e."PublicId"
    FROM flow_executions e
   WHERE e."StartedAt" < now() - interval '1 day'
     AND e."FormData" IS NOT NULL
     AND jsonb_typeof(e."FormData"::jsonb) = 'object'
     AND e."FormData"::jsonb <> '{}'::jsonb
     AND e."DeletedAt" IS NULL
   ORDER BY e."Id" DESC
   LIMIT 3;`).split('\n').filter(Boolean);
check(antigas.length > 0, `[backfill] há execução LEGADA (anterior a esta sessão) para conferir (${antigas.length})`);

const projecao = (execId) => {
  const linhas = sql(`
    SELECT v."FieldPath" || '@' || v."OccurrencePath" || '~~~' || v."Value"
      FROM flow_execution_form_values v
      JOIN flow_executions e ON e."Id" = v."ExecutionId"
     WHERE e."PublicId" = '${execId}' ORDER BY 1;`);
  const mapa = {};
  for (const l of linhas ? linhas.split('\n') : []) {
    const i = l.indexOf('~~~');
    if (i > 0) mapa[l.slice(0, i)] = l.slice(i + 3);
  }
  return mapa;
};

let escolhida = null, escolhidaValores = [];
for (const execId of antigas) {
  const det = await api(token, `/api/v1/workflow/instances/${execId}`);
  const data = det.body?.data ?? {};
  const p = projecao(execId);
  const divergencias = [];
  let comparados = 0;
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item === null || typeof item !== 'object') return;
        for (const [ck, cv] of Object.entries(item)) {
          if (cv === null || cv === undefined || typeof cv === 'object') continue;
          comparados++;
          const chave = `${k}[].${ck}@${i}`;
          if (p[chave] !== String(cv)) divergencias.push(`${chave}: projeção="${p[chave]}" json="${cv}"`);
        }
      });
    } else if (typeof v !== 'object') {
      comparados++;
      if (p[`${k}@`] !== String(v)) divergencias.push(`${k}: projeção="${p[`${k}@`]}" json="${v}"`);
    }
  }
  // Guarda contra check que passa em falso: sem campo comparado não há paridade.
  check(comparados > 0 && divergencias.length === 0,
    `[backfill] legada ${execId.slice(0, 8)} projetada igual ao FormData (${comparados} campos)` +
    (divergencias.length ? ': ' + divergencias.slice(0, 3).join(' | ') : ''));

  // Candidatos a aparecer na tela: valores de texto curtos, sem ocorrência de lista.
  const valores = Object.entries(p)
    .filter(([k, v]) => k.endsWith('@') && typeof v === 'string' && v.length >= 3 && v.length <= 40 && !/^\d+([.,]\d+)?$/.test(v))
    .map(([, v]) => v);
  if (!escolhida && valores.length > 0) { escolhida = execId; escolhidaValores = valores.slice(0, 10); }
}
check(!!escolhida, '[backfill] achei uma legada com valor de texto para conferir na tela');

// ── 4. a solicitação legada na TELA, com o valor que está na projeção ───────
const medir = (page) => page.evaluate(() => {
  const doc = document.documentElement;
  const emScroller = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  const fora = [...document.querySelectorAll('button, input, select, textarea, a[href]')].filter((el) => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1) && !emScroller(el);
  });
  return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped: fora.length };
});

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const login = async (page) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=identifier]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
};

const conferirTela = async (page, view) => {
  await page.goto(`${BASE}/solicitacao/${escolhida}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1', { timeout: 20000 });
  await page.waitForTimeout(1200);
  const texto = await page.innerText('body');
  const achados = escolhidaValores.filter((v) => texto.includes(v));
  check(achados.length > 0,
    `[${view}] a tela da solicitação legada mostra o valor que está na projeção ("${achados[0] ?? escolhidaValores[0]}")`);
  const m = await medir(page);
  check(!m.overflows, `[${view}] solicitação legada sem overflow horizontal`);
  check(m.clipped === 0, `[${view}] solicitação legada sem controle recortado (${m.clipped})`);
  await page.screenshot({ path: `${OUT}/projecao-backfill-${view}.png`, fullPage: false });
};

try {
  if (escolhida) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
    await login(page);
    await conferirTela(page, 'web');
    await ctx.close();

    const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const m = await mctx.newPage();
    m.on('pageerror', (e) => console.log('pageerror(mobile):', e.message.slice(0, 160)));
    await login(m);
    await conferirTela(m, 'mobile');
  }
} finally {
  await browser.close();
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

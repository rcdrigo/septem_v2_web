// Fase 1.3 — Parâmetros › Arquivos (S3/MinIO + limites de upload).
// Salva a configuração, confere que a secret key é write-only, que a validade da
// URL só aparece com URLs assinadas e que o "Testar conexão" reporta a falha real.
// Roda em web (1280) e mobile (375).
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || '.';
const ok = [];
const bad = [];
const check = (cond, msg) => (cond ? ok.push(msg) : bad.push(msg));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', 'admin@prefeitura-x.local');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
}

async function abrirAba(page) {
  await page.goto(BASE + '/admin/parametros', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Arquivos' }).click();
  await page.waitForSelector('[data-testid=form-arquivos]', { timeout: 10000 });
}

for (const view of [
  { name: 'web', width: 1280, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await login(page);
  await abrirAba(page);
  check(true, `[${view.name}] aba Arquivos abre o formulário de armazenamento`);

  // Layout.
  const L = await page.evaluate(() => {
    const doc = document.documentElement;
    const form = document.querySelector('[data-testid=form-arquivos]');
    const clipped = [...(form?.querySelectorAll('input, select, button') ?? [])].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
    }).length;
    return { overflows: doc.scrollWidth > doc.clientWidth + 1, clipped };
  });
  check(!L.overflows, `[${view.name}] sem overflow horizontal`);
  check(L.clipped === 0, `[${view.name}] nenhum campo recortado (${L.clipped})`);

  // Defaults do backend: extensões perigosas já bloqueadas.
  const bloqueadas = await page.locator('input[name=blockedExtensions]').inputValue();
  check(bloqueadas.includes('exe'), `[${view.name}] extensões perigosas bloqueadas por padrão ("${bloqueadas}")`);

  // Validade da URL só faz sentido com URLs assinadas.
  await page.uncheck('input[name=useSignedUrls]');
  check(
    (await page.locator('input[name=urlExpirationMinutes]').count()) === 0,
    `[${view.name}] sem URLs assinadas, o campo de validade some`,
  );
  await page.check('input[name=useSignedUrls]');
  check(
    (await page.locator('input[name=urlExpirationMinutes]').count()) === 1,
    `[${view.name}] com URLs assinadas, o campo de validade volta`,
  );

  // Salvar (MinIO local — porta morta de propósito para o teste de conexão falhar rápido).
  await page.fill('input[name=bucketName]', 'septem-anexos');
  await page.fill('input[name=region]', 'us-east-1');
  await page.fill('input[name=endpoint]', 'http://localhost:9');
  await page.fill('input[name=accessKey]', 'minioadmin');
  await page.fill('input[name=secretKey]', 'minioadmin');
  await page.fill('input[name=baseFolder]', 'prefeitura-x');
  await page.fill('input[name=maxUploadMb]', '25');
  await page.fill('input[name=blockedExtensions]', 'EXE, .bat ,cmd');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForSelector('text=Configuração de arquivos salva.', { timeout: 10000 });
  check(true, `[${view.name}] salvou a configuração de arquivos`);
  await page.screenshot({ path: `${OUT}/parametros-arquivos-${view.name}.png`, fullPage: true });

  // Persistência + normalização das extensões + secret write-only.
  await abrirAba(page);
  check(
    (await page.locator('input[name=bucketName]').inputValue()) === 'septem-anexos' &&
      (await page.locator('input[name=maxUploadMb]').inputValue()) === '25',
    `[${view.name}] bucket e limite de upload persistidos`,
  );
  check(
    (await page.locator('input[name=blockedExtensions]').inputValue()) === 'exe,bat,cmd',
    `[${view.name}] extensões normalizadas (minúsculas, sem ponto/espaço)`,
  );
  check(
    (await page.locator('input[name=secretKey]').inputValue()) === '' &&
      (await page.getByText('Secret key (configurada)').count()) > 0,
    `[${view.name}] secret key é write-only (não volta preenchida)`,
  );

  // Testar conexão: bucket inacessível → erro com o motivo, nunca "ok" falso.
  await page.getByRole('button', { name: 'Testar conexão' }).click();
  await page.waitForTimeout(6000);
  const texto = await page.evaluate(() => document.body.innerText);
  check(!texto.includes('Conexão com o bucket ok.'), `[${view.name}] não reporta sucesso com bucket inacessível`);
  check(/Falha ao conectar|conex|refus|connect/i.test(texto), `[${view.name}] mostra o motivo da falha de conexão`);

  // Validação: tamanho máximo fora do range nem chega a salvar (o campo é inválido
  // pelo max=1024 e o navegador barra o submit) — e o backend também recusa (400).
  await abrirAba(page);
  await page.fill('input[name=maxUploadMb]', '5000');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(1000);
  const invalido = await page.evaluate(
    () => !document.querySelector('input[name=maxUploadMb]').checkValidity(),
  );
  const salvou = (await page.getByText('Configuração de arquivos salva.').count()) > 0;
  check(invalido && !salvou, `[${view.name}] tamanho máximo fora do range é barrado (não salva)`);

  const status = await page.evaluate(async () => {
    const r = await fetch('/api/v1/settings/storage', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': 'prefeitura-x',   // em dev o tenant vem por header (o client do app injeta)
        Authorization: 'Bearer ' + localStorage.getItem('septem.accessToken'),
      },
      body: JSON.stringify({
        bucketName: 'b', useSignedUrls: true, urlExpirationMinutes: 60,
        maxUploadMb: 5000, blockedExtensions: 'exe',
      }),
    });
    return r.status;
  });
  check(status === 400, `[${view.name}] backend também recusa maxUploadMb=5000 (HTTP ${status})`);

  await ctx.close();
}

// Limpa o armazenamento para não afetar outras suítes.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await abrirAba(page);
  await page.fill('input[name=bucketName]', '');
  await page.fill('input[name=endpoint]', '');
  await page.fill('input[name=maxUploadMb]', '25');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForSelector('text=Configuração de arquivos salva.', { timeout: 10000 });
  await abrirAba(page);
  check((await page.locator('input[name=bucketName]').inputValue()) === '', '[cleanup] armazenamento limpo');
  await ctx.close();
}

await browser.close();

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

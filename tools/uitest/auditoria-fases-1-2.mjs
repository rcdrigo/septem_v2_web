// Auditoria pós-Fase-3 das Fases 1 e 2: prova os EFEITOS que as suítes existentes
// podem não cobrir, mirando as classes de bug que morderam a Fase 3 (salvar apaga
// campo intocado; efeito não fiado; check que passa em falso). Só API + login real.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:5000';
const ok = [];
const bad = [];
const check = (c, m) => (c ? ok.push(m) : bad.push(m));

const api = async (token, path, method = 'GET', body) => {
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

const login = async (extra) => {
  const { body } = await api(null, '/api/v1/auth/login', 'POST', {
    identifier: 'admin@prefeitura-x.local',
    password: 'admin123',
    ...extra,
  });
  return body;
};

const admin = await login();
const token = admin.accessToken;

// A suíte MUTA parâmetros (branding, SMTP, 2FA). Guarda o "geral" original (é tudo
// texto, sem segredo) para devolver ao fim e não poluir as demais suítes. E-mail/S3/
// segurança são restaurados para o default de dev (sem SMTP/S3, 2FA off).
const geralOriginal = (await api(token, '/api/v1/settings')).body.general;
async function restaurar() {
  await api(token, '/api/v1/settings/general', 'PUT', {
    clienteNome: geralOriginal.clienteNome, ambienteNome: geralOriginal.ambienteNome,
    logoUrl: geralOriginal.logoUrl, primaryColor: geralOriginal.primaryColor,
    heroImageUrl: geralOriginal.heroImageUrl, systemDescription: geralOriginal.systemDescription,
    businessHourStart: geralOriginal.businessHourStart, businessHourEnd: geralOriginal.businessHourEnd,
    businessDays: geralOriginal.businessDays,
  });
  await api(token, '/api/v1/settings/security', 'PUT', { twoFactorMode: 'off', maxLoginAttempts: 5, lockoutMinutes: 15 });
  await api(token, '/api/v1/settings/email', 'PUT', {
    host: null, port: 587, useSsl: false, authMode: 'none', user: null,
    fromName: 'Teste', fromAddress: 'no-reply@teste.local', password: '',
  });
}

try {

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 · A1/A2 — salvar E-mail/Arquivos SEM redigitar o segredo o PRESERVA
// (é a classe de bug da Fase 3: salvar apaga um campo que o usuário não tocou).
// ─────────────────────────────────────────────────────────────────────────────
{
  const email = (extra) => ({
    host: 'smtp.teste.local', port: 587, useSsl: true, authMode: 'login',
    user: 'u@teste.local', fromName: 'Teste', fromAddress: 'no-reply@teste.local', ...extra,
  });
  // grava um SMTP com senha
  let put = await api(token, '/api/v1/settings/email', 'PUT', email({ password: 'senha-secreta-123' }));
  check(put.status === 200, 'F1 SMTP: PUT com senha responde 200');
  let s = (await api(token, '/api/v1/settings')).body;
  check(s.email.passwordSet === true, 'F1 SMTP: senha marcada como definida após salvar com senha');

  // salva DE NOVO sem senha (password: null) — mudando só o remetente
  await api(token, '/api/v1/settings/email', 'PUT', email({ fromName: 'Outro Nome', password: null }));
  s = (await api(token, '/api/v1/settings')).body;
  check(s.email.passwordSet === true, 'F1 SMTP: salvar sem redigitar a senha NÃO apaga a senha');
  check(s.email.fromName === 'Outro Nome', 'F1 SMTP: o campo alterado foi de fato salvo');

  // password: "" limpa de propósito
  await api(token, '/api/v1/settings/email', 'PUT', email({ fromName: 'Outro Nome', password: '' }));
  s = (await api(token, '/api/v1/settings')).body;
  check(s.email.passwordSet === false, 'F1 SMTP: senha vazia ("") limpa a senha de propósito');
}
{
  await api(token, '/api/v1/settings/storage', 'PUT', {
    bucketName: 'meu-bucket', region: 'us-east-1', endpoint: 'http://localhost:9000',
    accessKey: 'AKIA', baseFolder: 'x', cdnUrl: null, useSignedUrls: true,
    urlExpirationMinutes: 60, storageClass: null, encryption: null,
    maxUploadMb: 25, blockedExtensions: 'exe,bat', secretKey: 'super-secreta',
  });
  let s = (await api(token, '/api/v1/settings')).body;
  check(s.storage.secretKeySet === true, 'F1 S3: secret marcada como definida após salvar');

  await api(token, '/api/v1/settings/storage', 'PUT', {
    bucketName: 'meu-bucket', region: 'us-east-1', endpoint: 'http://localhost:9000',
    accessKey: 'AKIA', baseFolder: 'x', cdnUrl: null, useSignedUrls: true,
    urlExpirationMinutes: 60, storageClass: null, encryption: null,
    maxUploadMb: 50, blockedExtensions: 'exe,bat,cmd', secretKey: null,
  });
  s = (await api(token, '/api/v1/settings')).body;
  check(s.storage.secretKeySet === true, 'F1 S3: salvar sem redigitar a secret NÃO apaga a secret');
  check(s.storage.maxUploadMb === 50, 'F1 S3: o limite alterado foi salvo');
  check((s.storage.blockedExtensions || '').includes('cmd'), 'F1 S3: extensões proibidas atualizadas');
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 · A3 — validações do backend de fato barram entrada inválida (efeito)
// ─────────────────────────────────────────────────────────────────────────────
{
  const r1 = await api(token, '/api/v1/settings/storage', 'PUT', {
    bucketName: 'b', region: 'r', endpoint: 'nao-e-url', accessKey: 'a', baseFolder: '',
    useSignedUrls: false, urlExpirationMinutes: 60, maxUploadMb: 10, blockedExtensions: '', secretKey: null,
  });
  check(r1.status === 400 && r1.body.error === 'invalid_endpoint', 'F1: endpoint inválido é rejeitado (400)');
  const r2 = await api(token, '/api/v1/settings/storage', 'PUT', {
    bucketName: 'b', region: 'r', endpoint: null, accessKey: 'a', baseFolder: '',
    useSignedUrls: false, urlExpirationMinutes: 60, maxUploadMb: 9000, blockedExtensions: '', secretKey: null,
  });
  check(r2.status === 400 && r2.body.error === 'invalid_max_upload', 'F1: tamanho de upload fora da faixa é rejeitado (400)');
  const r3 = await api(token, '/api/v1/settings/security', 'PUT', {
    twoFactorMode: 'xpto', maxLoginAttempts: 5, lockoutMinutes: 15,
  });
  check(r3.status === 400 && r3.body.error === 'invalid_2fa_mode', 'F1: modo de 2FA inválido é rejeitado (400)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 · A4 — mudar branding reflete em /api/tenant/config (invalidação de cache;
// já foi bug uma vez). E hero background + descrição chegam no config público.
// ─────────────────────────────────────────────────────────────────────────────
{
  const marca = 'AUD' + Math.floor(Math.random() * 1e6);
  const g = await api(token, '/api/v1/settings/general', 'PUT', {
    clienteNome: 'Prefeitura X', ambienteNome: 'Septem', logoUrl: null,
    primaryColor: '#123456', heroImageUrl: 'https://picsum.photos/id/1/1200/800',
    systemDescription: `hero-${marca}`,
    businessHourStart: 8, businessHourEnd: 18, businessDays: '1,2,3,4,5',
  });
  check(g.status === 200, 'F1: PUT /general responde 200');
  const cfg = (await api(null, '/api/tenant/config')).body;
  check(cfg.primaryColor === '#123456', 'F1: cor primária nova aparece no /api/tenant/config (cache invalidado)');
  check(cfg.heroImageUrl === 'https://picsum.photos/id/1/1200/800', 'F1: imagem do hero chega no config público');
  check((cfg.systemDescription || '').includes(marca), 'F1: descrição do sistema chega no config público');
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 · B1 — login por CPF COM e SEM pontuação (efeito, não tela)
// ─────────────────────────────────────────────────────────────────────────────
{
  const comPonto = await login({ identifier: '529.982.247-25' });
  check(!!comPonto?.accessToken, 'F2: login por CPF COM pontuação funciona');
  const semPonto = await login({ identifier: '52998224725' });
  check(!!semPonto?.accessToken, 'F2: login por CPF SEM pontuação funciona');
  const errado = await api(null, '/api/v1/auth/login', 'POST', { identifier: '52998224725', password: 'errada' });
  check(errado.status === 401, 'F2: CPF certo + senha errada = 401 (não vaza que o CPF existe por outro código)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 · B2 — requisitos de senha: a MESMA regra no back e no que o front consome
// ─────────────────────────────────────────────────────────────────────────────
{
  const rules = (await api(null, '/api/v1/auth/password-rules')).body;
  const keys = new Set((rules?.rules ?? []).map((r) => r.key));
  check(rules?.minLength >= 8 && ['length', 'upper', 'lower', 'digit', 'special'].every((k) => keys.has(k)),
    'F2: /auth/password-rules expõe as 5 regras (fonte única do checklist)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 · B3 — o interruptor do 2FA em Parâmetros de fato GOVERNA o login.
// off → entra direto; all → login exige 2FA (twoFactorRequired) e /2fa completa.
// Restaura para 'off' ao fim (default de produção, não quebrar as outras suítes).
// ─────────────────────────────────────────────────────────────────────────────
{
  const login2fa = () => api(null, '/api/v1/auth/login', 'POST', { identifier: 'admin@prefeitura-x.local', password: 'admin123' });
  const setMode = (m) => api(token, '/api/v1/settings/security', 'PUT', { twoFactorMode: m, maxLoginAttempts: 5, lockoutMinutes: 15 });
  // E-mail SEM host: o envio cai no logger e nunca estoura (caminho feliz do 2FA).
  const emailOk = () => api(token, '/api/v1/settings/email', 'PUT', {
    host: null, port: 587, useSsl: false, authMode: 'none', user: null, fromName: 'Teste', fromAddress: 'no-reply@teste.local', password: null,
  });
  // E-mail com host inacessível: o envio do código FALHA (era o gatilho do 500).
  const emailQuebrado = () => api(token, '/api/v1/settings/email', 'PUT', {
    host: 'smtp.invalido.local', port: 587, useSsl: true, authMode: 'login', user: 'u@x', fromName: 'T', fromAddress: 'no-reply@teste.local', password: 'x',
  });

  // ── off: entra direto ──
  await setMode('off');
  const semDesafio = await login2fa();
  check(semDesafio.body?.accessToken && !semDesafio.body?.twoFactorRequired,
    'F2 2FA=off: login entra direto, sem desafio');

  // ── all + e-mail OK: exige desafio e o código conclui ──
  await emailOk();
  await setMode('all');
  const comDesafio = await login2fa();
  const gated = comDesafio.body?.twoFactorRequired === true && !comDesafio.body?.accessToken;
  check(gated, 'F2 2FA=all: o interruptor de fato EXIGE o desafio no login (não entra direto)');

  let completou = false;
  if (gated) {
    const id = 'admin@prefeitura-x.local';
    const code = (await api(null, `/api/v1/auth/dev/last-code?identifier=${encodeURIComponent(id)}&purpose=2fa`)).body?.code;
    const r = await api(null, '/api/v1/auth/2fa', 'POST', { identifier: id, code, trustDevice: false });
    completou = !!r.body?.accessToken;
  }
  check(completou, 'F2 2FA=all: informar o código conclui o login e devolve o token');

  // ── all + e-mail QUEBRADO: login devolve erro TIPADO, nunca 500 (bug achado na auditoria) ──
  await emailQuebrado();
  const falhaEnvio = await login2fa();
  check(falhaEnvio.status === 502 && falhaEnvio.body?.error === 'twofactor_send_failed',
    `F2 2FA: SMTP fora no envio do código = 502 tipado, NÃO 500 (status ${falhaEnvio.status})`);

  // RESTAURA: off + e-mail limpo (default de produção, não quebra outras suítes)
  await setMode('off');
  await emailOk();
  const voltou = (await api(token, '/api/v1/settings')).body?.security?.twoFactorMode;
  check(voltou === 'off', 'F2 2FA: restaurado para off (default de produção)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 · B4 — "esqueci a senha" não revela se a conta existe (200 para inexistente)
// ─────────────────────────────────────────────────────────────────────────────
{
  const inexistente = await api(null, '/api/v1/auth/forgot-password', 'POST', { identifier: 'ninguem-aqui@nada.local' });
  check(inexistente.status === 200, 'F2 reset: e-mail inexistente responde 200 (não revela ausência da conta)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 · B5 — o hero do login (background + descrição da Fase 1) renderiza mesmo
// ─────────────────────────────────────────────────────────────────────────────
{
  const marca = 'HERO' + Math.floor(Math.random() * 1e6);
  const g = await api(token, '/api/v1/settings/general', 'PUT', {
    clienteNome: 'Prefeitura X', ambienteNome: 'Septem', logoUrl: null,
    primaryColor: '#123456', heroImageUrl: 'https://picsum.photos/id/1/1200/800',
    systemDescription: `Bem-vindo ${marca}`,
    businessHourStart: 8, businessHourEnd: 18, businessDays: '1,2,3,4,5',
  });
  check(g.status === 200, 'F2/F1: PUT /general (hero) responde 200');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  try {
    for (const vp of [{ w: 1280, h: 900, n: 'web' }, { w: 375, h: 812, n: 'mobile' }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const page = await ctx.newPage();
      await page.addInitScript(() => localStorage.clear());
      await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
      // Espera o elemento da descrição (config é assíncrono; medir num instante fixo
      // dá falso-negativo — foi o que aconteceu na 1ª passada desta auditoria).
      if (vp.n === 'web') {
        const apareceu = await page
          .waitForFunction((m) => document.querySelector('[data-testid=login-descricao]')?.textContent?.includes(m), marca, { timeout: 8000 })
          .then(() => true)
          .catch(() => false);
        check(apareceu, `F2/F1 [${vp.n}]: a descrição do hero aparece na tela de login`);
        const temBg = await page.evaluate(() =>
          [...document.querySelectorAll('*')].some((el) => {
            const b = getComputedStyle(el).backgroundImage;
            return b && b.includes('picsum');
          }));
        check(temBg, `F2/F1 [${vp.n}]: a imagem de background do hero é aplicada`);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      check(!overflow, `F2/F1 [${vp.n}]: login sem overflow horizontal`);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

} finally {
  await restaurar();   // devolve os parâmetros ao estado original (não polui outras suítes)
}

ok.forEach((m) => console.log('✓ ' + m));
bad.forEach((m) => console.log('✗ ' + m));
console.log(bad.length === 0 ? `\nPASSOU (${ok.length} checks)` : `\nFALHOU (${bad.length} de ${ok.length + bad.length})`);
process.exit(bad.length === 0 ? 0 : 1);

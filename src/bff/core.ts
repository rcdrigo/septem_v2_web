/**
 * Núcleo do BFF (Backend-for-Frontend) — Fase 11.
 *
 * Roda em DOIS ambientes com o mesmo código (só APIs Web-standard: fetch/Request/
 * Response/Headers/URL): o adapter da Cloudflare Pages Functions (produção) e o
 * plugin do Vite dev (desenvolvimento). Isso garante que a lógica de sessão não
 * "desvie" entre dev e prod.
 *
 * Responsabilidades:
 *  - Proxy de `/api/*` para o backend (.NET no Render), injetando `X-Tenant`
 *    resolvido pelo HOST (o cliente nunca manda esse header) e `Authorization:
 *    Bearer` a partir do cookie httpOnly (o token nunca aparece no JavaScript).
 *  - Interceptar os endpoints de auth (login/2fa/refresh/logout/impersonate):
 *    move os tokens do corpo da resposta para cookies httpOnly e os retira do
 *    JSON devolvido ao cliente.
 *  - Auto-refresh transparente em 401 (usa o refresh cookie, rotaciona, repete).
 *  - SSR de bootstrap: injeta `window.__BOOTSTRAP__` (tenant + me) e as meta tags
 *    Open Graph no HTML servido, de modo que `/tenant/config` e `/me` NUNCA saem
 *    do navegador.
 */

export type BffEnv = {
  /** Base do backend .NET (ex.: https://septem-api.onrender.com). Sem barra final. */
  backendUrl: string;
  /** Resolve o tenant a partir do host da request (subdomínio por cliente). */
  tenantFor: (host: string) => string | undefined;
  /** Adiciona o atributo `Secure` nos cookies (só em https). */
  secureCookies: boolean;
};

// Cookies da sessão (httpOnly — inacessíveis ao JS do cliente).
const ACCESS_COOKIE = 'septem_at';
const REFRESH_COOKIE = 'septem_rt';
const DEVICE_COOKIE = 'septem_dt'; // 2FA: dispositivo confiável (sobrevive ao logout)
const KEEP_COOKIE = 'septem_keep'; // "manter-me conectado" (1/0)

/** Endpoints cuja RESPOSTA carrega tokens que devem virar cookie. */
function isTokenIssuingPath(path: string): boolean {
  return (
    path === '/api/v1/auth/login' ||
    path === '/api/v1/auth/2fa' ||
    path === '/api/v1/auth/refresh' ||
    path.startsWith('/api/v1/impersonate/')
  );
}

/** Endpoints anônimos: não injeta Authorization. */
function isAnonymousAuthPath(path: string): boolean {
  return (
    path === '/api/v1/auth/login' ||
    path === '/api/v1/auth/2fa' ||
    path === '/api/v1/auth/refresh' ||
    path === '/api/v1/auth/logout' ||
    path === '/api/tenant/config'
  );
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

type CookieOpts = { maxAge?: number; secure: boolean; httpOnly?: boolean };

function serializeCookie(name: string, value: string, opts: CookieOpts): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`);
  return parts.join('; ');
}

function expireCookie(name: string, secure: boolean): string {
  return serializeCookie(name, '', { maxAge: 0, secure });
}

/** Segundos de agora até o instante ISO (mínimo 0). */
function secondsUntil(iso?: string | null): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return Math.max(0, Math.floor((t - Date.now()) / 1000));
}

// ---------------------------------------------------------------------------
// Tokens ↔ cookies
// ---------------------------------------------------------------------------

type TokenBody = {
  accessToken?: string;
  refreshToken?: string;
  accessExpiresAt?: string;
  refreshExpiresAt?: string;
  deviceToken?: string | null;
  [k: string]: unknown;
};

/**
 * Recebe o JSON de uma resposta de auth. Se contiver tokens, devolve os
 * `Set-Cookie` a aplicar e o corpo já sem os campos sensíveis. Se não contiver
 * (ex.: desafio 2FA, erro), devolve o corpo intacto e nenhum cookie.
 */
function tokensToCookies(
  body: TokenBody,
  env: BffEnv,
  keepConnected: boolean,
): { setCookies: string[]; publicBody: unknown } {
  if (!body || typeof body !== 'object' || !body.accessToken) {
    return { setCookies: [], publicBody: body };
  }
  const secure = env.secureCookies;
  const setCookies: string[] = [];

  // Access: vida = expiração do access (se "manter conectado"); senão cookie de sessão.
  const accessMaxAge = keepConnected ? secondsUntil(body.accessExpiresAt) : undefined;
  setCookies.push(serializeCookie(ACCESS_COOKIE, body.accessToken, { maxAge: accessMaxAge, secure }));

  if (body.refreshToken) {
    const refreshMaxAge = keepConnected ? secondsUntil(body.refreshExpiresAt) : undefined;
    setCookies.push(serializeCookie(REFRESH_COOKIE, body.refreshToken, { maxAge: refreshMaxAge, secure }));
  }
  // Lembra a preferência p/ os refreshes seguintes (que não recebem o corpo do login).
  setCookies.push(serializeCookie(KEEP_COOKIE, keepConnected ? '1' : '0', { maxAge: keepConnected ? 60 * 60 * 24 * 365 : undefined, secure }));

  if (body.deviceToken) {
    // Dispositivo confiável do 2FA: longo, sobrevive ao logout.
    setCookies.push(serializeCookie(DEVICE_COOKIE, body.deviceToken, { maxAge: 60 * 60 * 24 * 180, secure }));
  }

  const publicBody = { ...body };
  delete publicBody.accessToken;
  delete publicBody.refreshToken;
  delete publicBody.deviceToken;
  return { setCookies, publicBody };
}

// ---------------------------------------------------------------------------
// Proxy /api
// ---------------------------------------------------------------------------

/** Monta os headers de saída para o backend. */
function buildBackendHeaders(req: Request, tenant: string | undefined, accessToken?: string): Headers {
  const h = new Headers(req.headers);
  h.delete('cookie');
  h.delete('authorization');
  h.delete('x-tenant');
  h.delete('host');
  h.delete('content-length'); // recomputado pelo fetch
  if (tenant) h.set('X-Tenant', tenant);
  if (accessToken) h.set('Authorization', `Bearer ${accessToken}`);
  return h;
}

/** Remove headers que não devem ser repassados ao cliente. */
function forwardResponseHeaders(resp: Response): Headers {
  const h = new Headers(resp.headers);
  h.delete('content-encoding');
  h.delete('content-length');
  h.delete('transfer-encoding');
  // O backend não deve ditar cookies do cliente — o BFF é o dono da sessão.
  h.delete('set-cookie');
  return h;
}

/**
 * Faz o proxy de uma request `/api/*` para o backend, cuidando de sessão.
 */
export async function proxyApi(request: Request, env: BffEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const tenant = env.tenantFor(url.host);
  const cookies = parseCookies(request.headers.get('cookie'));
  const bodyBuf = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

  const backendBase = env.backendUrl;
  const target = `${backendBase}${path}${url.search}`;

  // --- Endpoints que emitem/consomem tokens ---
  if (isTokenIssuingPath(path) && request.method === 'POST') {
    return handleTokenEndpoint(request, env, { path, target, tenant, cookies, bodyBuf });
  }
  if (path === '/api/v1/auth/logout' && request.method === 'POST') {
    return handleLogout({ env, target, tenant, cookies, bodyBuf, reqHeaders: request.headers });
  }

  // --- Demais chamadas: Bearer do cookie + auto-refresh em 401 ---
  const anonymous = isAnonymousAuthPath(path);
  const access = anonymous ? undefined : cookies[ACCESS_COOKIE];
  const headers = buildBackendHeaders(request, tenant, access);

  let resp = await fetch(target, { method: request.method, headers, body: bodyBuf, redirect: 'manual' });

  if (resp.status === 401 && !anonymous && cookies[REFRESH_COOKIE]) {
    const refreshed = await tryRefresh(env, backendBase, tenant, cookies);
    if (refreshed) {
      const retryHeaders = buildBackendHeaders(request, tenant, refreshed.accessToken);
      const retry = await fetch(target, { method: request.method, headers: retryHeaders, body: bodyBuf, redirect: 'manual' });
      const out = new Response(retry.body, { status: retry.status, headers: forwardResponseHeaders(retry) });
      for (const c of refreshed.setCookies) out.headers.append('Set-Cookie', c);
      return out;
    }
    // Refresh falhou → limpa a sessão e devolve 401.
    const out = new Response(resp.body, { status: 401, headers: forwardResponseHeaders(resp) });
    for (const c of clearSessionCookies(env)) out.headers.append('Set-Cookie', c);
    return out;
  }

  return new Response(resp.body, { status: resp.status, headers: forwardResponseHeaders(resp) });
}

/** Trata login/2fa/refresh/impersonate: injeta deviceToken/refresh e move tokens p/ cookie. */
async function handleTokenEndpoint(
  request: Request,
  env: BffEnv,
  ctx: { path: string; target: string; tenant?: string; cookies: Record<string, string>; bodyBuf?: ArrayBuffer },
): Promise<Response> {
  const { path, target, tenant, cookies, bodyBuf } = ctx;

  // Monta o corpo a enviar ao backend (injeta o que estava em cookie).
  let outBody: ArrayBuffer | string | undefined = bodyBuf;
  let keepConnected = cookies[KEEP_COOKIE] !== '0';

  if (path === '/api/v1/auth/login' || path === '/api/v1/auth/2fa') {
    const parsed = safeJson(bodyBuf) ?? {};
    if (typeof parsed.keepConnected === 'boolean') keepConnected = parsed.keepConnected;
    // O cliente não conhece o deviceToken (está em cookie httpOnly) — o BFF injeta.
    if (path === '/api/v1/auth/login' && cookies[DEVICE_COOKIE]) parsed.deviceToken = cookies[DEVICE_COOKIE];
    outBody = JSON.stringify(parsed);
  } else if (path === '/api/v1/auth/refresh') {
    // O refresh token está em cookie — o cliente manda corpo vazio.
    outBody = JSON.stringify({ refreshToken: cookies[REFRESH_COOKIE] ?? '' });
  }
  // impersonate/* não tem corpo relevante — repassa como veio.

  const headers = buildBackendHeaders(request, tenant, needsAuth(path) ? cookies[ACCESS_COOKIE] : undefined);
  headers.set('content-type', 'application/json');

  const resp = await fetch(target, { method: 'POST', headers, body: outBody, redirect: 'manual' });
  const text = await resp.text();
  const json = text ? safeParse(text) : undefined;

  if (!resp.ok || json == null) {
    // Erro ou 2FA sem tokens — devolve como veio.
    const out = new Response(text, { status: resp.status, headers: passthroughJsonHeaders(resp) });
    return out;
  }

  const { setCookies, publicBody } = tokensToCookies(json as TokenBody, env, keepConnected);
  // Já devolve o /me junto (buscado no servidor) para o cliente NÃO precisar
  // chamar /me depois do login — assim /me nunca sai do browser. (refresh não precisa.)
  if (setCookies.length && path !== '/api/v1/auth/refresh' && publicBody && typeof publicBody === 'object') {
    const me = await fetchMe(env, tenant, (json as TokenBody).accessToken!);
    if (me) (publicBody as Record<string, unknown>).user = me;
  }
  const out = new Response(JSON.stringify(publicBody ?? {}), {
    status: resp.status,
    headers: passthroughJsonHeaders(resp),
  });
  out.headers.set('content-type', 'application/json');
  for (const c of setCookies) out.headers.append('Set-Cookie', c);
  return out;
}

/** impersonate exige o Bearer atual; login/2fa/refresh são anônimos. */
function needsAuth(path: string): boolean {
  return path.startsWith('/api/v1/impersonate/');
}

async function handleLogout(ctx: {
  env: BffEnv;
  target: string;
  tenant?: string;
  cookies: Record<string, string>;
  bodyBuf?: ArrayBuffer;
  reqHeaders: Headers;
}): Promise<Response> {
  const { env, target, tenant, cookies } = ctx;
  const headers = new Headers({ 'content-type': 'application/json' });
  if (tenant) headers.set('X-Tenant', tenant);
  try {
    await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken: cookies[REFRESH_COOKIE] ?? '' }),
      redirect: 'manual',
    });
  } catch {
    // best-effort — a limpeza dos cookies é o que importa.
  }
  const out = new Response(null, { status: 204 });
  for (const c of clearSessionCookies(env)) out.headers.append('Set-Cookie', c);
  return out;
}

function clearSessionCookies(env: BffEnv): string[] {
  return [
    expireCookie(ACCESS_COOKIE, env.secureCookies),
    expireCookie(REFRESH_COOKIE, env.secureCookies),
    expireCookie(KEEP_COOKIE, env.secureCookies),
    // O device cookie (dispositivo confiável) NÃO é apagado no logout de propósito.
  ];
}

/** Tenta rotacionar a sessão via /auth/refresh. */
async function tryRefresh(
  env: BffEnv,
  backendBase: string,
  tenant: string | undefined,
  cookies: Record<string, string>,
): Promise<{ accessToken: string; setCookies: string[] } | null> {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (tenant) headers.set('X-Tenant', tenant);
  try {
    const resp = await fetch(`${backendBase}/api/v1/auth/refresh`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken: cookies[REFRESH_COOKIE] ?? '' }),
      redirect: 'manual',
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as TokenBody;
    if (!json.accessToken) return null;
    const keep = cookies[KEEP_COOKIE] !== '0';
    const { setCookies } = tokensToCookies(json, env, keep);
    return { accessToken: json.accessToken, setCookies };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SSR de bootstrap + Open Graph
// ---------------------------------------------------------------------------

type TenantConfig = {
  tenantId: string;
  clienteNome: string;
  ambienteNome: string;
  logoUrl?: string;
  primaryColor?: string;
  heroImageUrl?: string | null;
  systemDescription?: string | null;
  modulos?: string[];
};

/**
 * Resolve o estado inicial no servidor (tenant + me), fazendo refresh se o access
 * cookie tiver expirado, e devolve o HTML final com `window.__BOOTSTRAP__` e as
 * meta tags Open Graph injetadas. `getHtml` fornece o index.html base.
 */
export async function renderDocument(
  request: Request,
  env: BffEnv,
  getHtml: () => Promise<string>,
): Promise<Response> {
  const url = new URL(request.url);
  const tenant = env.tenantFor(url.host);
  const cookies = parseCookies(request.headers.get('cookie'));
  const rotated: string[] = [];

  // 1) tenant/config (anônimo)
  let tenantConfig: TenantConfig | null = null;
  try {
    const h = new Headers();
    if (tenant) h.set('X-Tenant', tenant);
    const r = await fetch(`${env.backendUrl}/api/tenant/config`, { headers: h });
    if (r.ok) tenantConfig = (await r.json()) as TenantConfig;
  } catch {
    /* segue sem branding — o cliente tenta de novo */
  }

  // 2) me (se houver sessão), com refresh transparente
  let me: unknown = null;
  let access = cookies[ACCESS_COOKIE];
  if (access) {
    me = await fetchMe(env, tenant, access);
    if (me == null && cookies[REFRESH_COOKIE]) {
      const refreshed = await tryRefresh(env, env.backendUrl, tenant, cookies);
      if (refreshed) {
        access = refreshed.accessToken;
        rotated.push(...refreshed.setCookies);
        me = await fetchMe(env, tenant, access);
      }
    }
  }

  const html = injectBootstrap(await getHtml(), { tenant: tenantConfig, me });
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  applySecurityHeaders(headers);
  for (const c of rotated) headers.append('Set-Cookie', c);
  return new Response(html, { status: 200, headers });
}

async function fetchMe(env: BffEnv, tenant: string | undefined, access: string): Promise<unknown> {
  try {
    const h = new Headers({ Authorization: `Bearer ${access}` });
    if (tenant) h.set('X-Tenant', tenant);
    const r = await fetch(`${env.backendUrl}/api/v1/me`, { headers: h });
    if (r.ok) return await r.json();
  } catch {
    /* ignora */
  }
  return null;
}

/** Escapa `<` para não fechar a tag <script> a partir de dados. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value ?? null).replace(/</g, '\\u003c');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function injectBootstrap(html: string, data: { tenant: TenantConfig | null; me: unknown }): string {
  const t = data.tenant;
  const title = t ? `${t.clienteNome} — ${t.ambienteNome}` : 'Septem';
  const description = t?.systemDescription || 'Portal de serviços e processos.';
  const image = t?.heroImageUrl || t?.logoUrl || '';

  const meta: string[] = [
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
  ];
  if (image) meta.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);

  const boot = `<script>window.__SEPTEM_BFF__=true;window.__BOOTSTRAP__=${jsonForScript({ tenant: t, me: data.me })};</script>`;

  let out = html;
  // Título server-side (o cliente refina por página depois).
  out = out.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  // Injeta meta + bootstrap antes do </head>.
  out = out.replace(/<\/head>/i, `${meta.join('\n    ')}\n    ${boot}\n  </head>`);
  return out;
}

// ---------------------------------------------------------------------------
// Segurança (CSP básica) — aplicada só ao HTML servido pelo BFF.
// ---------------------------------------------------------------------------

export function applySecurityHeaders(headers: Headers): void {
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Vite/bpmn injetam estilos inline; o bootstrap é um <script> inline.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      // Vídeos incorporados nos Manuais (YouTube/Vimeo/Dailymotion).
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.dailymotion.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  );
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function passthroughJsonHeaders(resp: Response): Headers {
  const h = new Headers();
  const ct = resp.headers.get('content-type');
  if (ct) h.set('content-type', ct);
  return h;
}

function safeJson(buf?: ArrayBuffer): Record<string, unknown> | null {
  if (!buf || buf.byteLength === 0) return {};
  return safeParse(new TextDecoder().decode(buf));
}

function safeParse(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Deriva o tenant do host (primeiro rótulo do subdomínio). */
export function tenantFromHost(host: string, forced?: string): string | undefined {
  if (forced) return forced;
  const label = host.split(':')[0].split('.')[0];
  if (!label || label === 'www' || label === 'localhost') return undefined;
  return label;
}

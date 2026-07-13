import { toast } from '@/stores/toast';

/**
 * Cliente HTTP único do app. Toda chamada ao backend passa por aqui:
 *  - Bearer token automático (tira do session store).
 *  - Header `X-Tenant` em dev (decide o tenant sem mexer em /etc/hosts).
 *  - Parse de `application/problem+json` → `ApiError` + toast de erro.
 *  - 1 retry transparente em 401 via `/auth/refresh` (rotacionando).
 *
 * Importações tardias para quebrar o ciclo `session ↔ api`.
 */

/**
 * Base das chamadas. Em dev fica vazia (Vite faz proxy de `/api` → backend).
 * Em prod com o backend publicado numa origem separada, defina `VITE_API_URL`
 * (ex.: `https://septem-api.onrender.com`); se vazio, assume mesma origem.
 */
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/**
 * Tenant enviado no header `X-Tenant`. Em dev é fixo (VITE_TENANT ou prefeitura-x).
 * Em prod, com o front publicado em `{tenant}.dominio.com`, derivamos do primeiro
 * rótulo do hostname (VITE_TENANT força um valor fixo, útil para preview). Hosts
 * sem subdomínio de tenant (`www`, apex) → sem header (resolução por host no back).
 */
const TENANT_HEADER: string | undefined = resolveTenantHeader();

function resolveTenantHeader(): string | undefined {
  const forced = import.meta.env.VITE_TENANT as string | undefined;
  if (import.meta.env.DEV) return forced ?? 'prefeitura-x';
  if (forced) return forced;
  if (typeof window === 'undefined') return undefined;
  const label = window.location.hostname.split('.')[0];
  if (!label || label === 'www' || label === 'localhost') return undefined;
  return label;
}

export class ApiError extends Error {
  status: number;
  type?: string;
  detail?: string;
  issues?: unknown;
  /**
   * Corpo bruto da resposta de erro. Os endpoints devolvem informação que a tela
   * PRECISA mostrar — quantas tentativas restam antes do bloqueio, quais regras de
   * senha faltam, o motivo real da falha do SMTP. Sem isso, tudo virava uma
   * mensagem genérica e o usuário ficava sem saber o que corrigir.
   */
  body?: Record<string, unknown>;

  constructor(status: number, body?: { title?: string; type?: string; detail?: string; issues?: unknown }) {
    super(body?.title ?? body?.detail ?? `HTTP ${status}`);
    this.status = status;
    this.type = body?.type;
    this.detail = body?.detail;
    this.issues = body?.issues;
    this.body = body as Record<string, unknown> | undefined;
  }
}

type ApiOptions = RequestInit & {
  /** Se true, NÃO injeta Authorization (usado por login/refresh/logout iniciais). */
  anonymous?: boolean;
  /** Se true, evita o retry em 401 (usado pelo próprio refresh para não loopar). */
  skipRefresh?: boolean;
};

/** Hooks para o session store; setados pelo store no boot. Evita ciclo de import. */
let tokenProvider: () => string | null = () => null;
let refreshHandler: () => Promise<string | null> = async () => null;
let logoutHandler: () => Promise<void> = async () => {};

export function configureApi(opts: {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  logout: () => Promise<void>;
}) {
  tokenProvider = opts.getAccessToken;
  refreshHandler = opts.refresh;
  logoutHandler = opts.logout;
}

async function buildResponse(resp: Response): Promise<unknown> {
  if (resp.status === 204) return undefined;
  const ct = resp.headers.get('content-type') ?? '';
  if (ct.includes('application/json') || ct.includes('application/problem+json'))
    return resp.json();
  return resp.text();
}

async function readError(resp: Response): Promise<ApiError> {
  try {
    const body = await resp.json();
    return new ApiError(resp.status, body);
  } catch {
    return new ApiError(resp.status);
  }
}

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { anonymous, skipRefresh, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  if (!finalHeaders.has('Content-Type') && rest.body && typeof rest.body === 'string')
    finalHeaders.set('Content-Type', 'application/json');
  if (!anonymous) {
    const token = tokenProvider();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }
  if (TENANT_HEADER && !finalHeaders.has('X-Tenant'))
    finalHeaders.set('X-Tenant', TENANT_HEADER);

  const resp = await fetch(`${BASE_URL}${path}`, { ...rest, headers: finalHeaders });

  if (resp.status === 401 && !anonymous && !skipRefresh) {
    const newToken = await refreshHandler();
    if (newToken) {
      finalHeaders.set('Authorization', `Bearer ${newToken}`);
      const retry = await fetch(`${BASE_URL}${path}`, { ...rest, headers: finalHeaders });
      if (!retry.ok) throw await readError(retry);
      return (await buildResponse(retry)) as T;
    }
    // refresh falhou → desloga e sobe erro original
    await logoutHandler();
    throw await readError(resp);
  }

  if (!resp.ok) {
    const err = await readError(resp);
    if (resp.status >= 500) toast.error(err.detail ?? err.message);
    throw err;
  }

  return (await buildResponse(resp)) as T;
}

/** Açúcares mais comuns. */
export const api = {
  get: <T = unknown>(path: string, opts?: ApiOptions) => apiFetch<T>(path, { method: 'GET', ...opts }),
  post: <T = unknown>(path: string, body?: unknown, opts?: ApiOptions) =>
    apiFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined, ...opts }),
  put: <T = unknown>(path: string, body?: unknown, opts?: ApiOptions) =>
    apiFetch<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined, ...opts }),
  patch: <T = unknown>(path: string, body?: unknown, opts?: ApiOptions) =>
    apiFetch<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined, ...opts }),
  del: <T = unknown>(path: string, opts?: ApiOptions) => apiFetch<T>(path, { method: 'DELETE', ...opts }),
  /** POST que devolve o corpo cru (Blob) — downloads (export CSV/XLSX). */
  postBlob: async (path: string, body?: unknown): Promise<Blob> => {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const token = tokenProvider();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (TENANT_HEADER) headers.set('X-Tenant', TENANT_HEADER);
    const resp = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
    if (!resp.ok) throw await readError(resp);
    return resp.blob();
  },
};

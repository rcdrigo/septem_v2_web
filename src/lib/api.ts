import { toast } from '@/stores/toast';

/**
 * Cliente HTTP único do app. Toda chamada ao backend passa por aqui.
 *
 * Fase 11: o app roda atrás de um BFF (Cloudflare em prod, plugin do Vite em dev)
 * na MESMA origem. Quem injeta `X-Tenant` (resolvido pelo host) e o `Authorization:
 * Bearer` (a partir do cookie httpOnly) é o BFF — o navegador nunca vê o token.
 * Por isso aqui só mandamos `credentials: 'include'` (o cookie de sessão vai junto)
 * e tratamos erros/refresh de forma transparente.
 */

/** Mesma origem do BFF — ele faz o proxy de `/api` para o backend. */
const BASE_URL = '';

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
  /** Se true, um 401 NÃO desloga (usado por login/refresh: 401 ali é credencial ruim). */
  anonymous?: boolean;
  /** Reservado p/ compatibilidade — o refresh hoje é feito pelo BFF. */
  skipRefresh?: boolean;
};

/** Hook para o session store deslogar quando a sessão morre de vez. */
let logoutHandler: () => Promise<void> = async () => {};
let refreshHandler: () => Promise<string | null> = async () => null;

export function configureApi(opts: {
  getAccessToken?: () => string | null;
  refresh?: () => Promise<string | null>;
  logout: () => Promise<void>;
}) {
  logoutHandler = opts.logout;
  if (opts.refresh) refreshHandler = opts.refresh;
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
  void skipRefresh;
  const finalHeaders = new Headers(headers);
  if (!finalHeaders.has('Content-Type') && rest.body && typeof rest.body === 'string')
    finalHeaders.set('Content-Type', 'application/json');

  const resp = await fetch(`${BASE_URL}${path}`, { ...rest, headers: finalHeaders, credentials: 'include' });

  if (resp.status === 401 && !anonymous) {
    // O BFF já tentou o refresh (cookie). Um 401 aqui = sessão realmente encerrada.
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
    const resp = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      credentials: 'include',
    });
    if (!resp.ok) throw await readError(resp);
    return resp.blob();
  },

  /** GET que devolve o corpo cru (Blob) — downloads (modelo XLSX, anexos). */
  getBlob: async (path: string): Promise<Blob> => {
    const resp = await fetch(`${BASE_URL}${path}`, { credentials: 'include' });
    if (!resp.ok) throw await readError(resp);
    return resp.blob();
  },

  /** POST multipart (upload de arquivo) — não define Content-Type (o browser põe o boundary). */
  postForm: async <T = unknown>(path: string, form: FormData): Promise<T> => {
    const resp = await fetch(`${BASE_URL}${path}`, { method: 'POST', body: form, credentials: 'include' });
    if (!resp.ok) throw await readError(resp);
    return (await buildResponse(resp)) as T;
  },
};

/** Exposto p/ o session store: força um refresh (delega ao BFF). */
export function requestRefresh(): Promise<string | null> {
  return refreshHandler();
}

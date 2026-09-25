import { ApiError } from '@/lib/api';

/**
 * Cliente HTTP da ÁREA CENTRAL (`/api/v1/platform/*`) — separado do `api.ts` de
 * propósito, não por comodidade.
 *
 * O cliente dos ambientes injeta o token do tenant e o header `X-Tenant`. Se a área
 * central usasse aquele cliente, toda requisição central sairia carregando a
 * identidade de um ambiente — e um 401 dispararia o refresh do ambiente errado. A
 * segregação que o backend garante (chave, issuer e audiência próprios) precisa ter
 * um correspondente aqui: daqui **nunca** sai token de ambiente, e nunca sai
 * `X-Tenant`.
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const PLATFORM_PREFIX = '/api/v1/platform';

type Options = RequestInit & {
  /** Não injeta Authorization (login, 2fa, refresh, logout). */
  anonymous?: boolean;
  /** Evita o retry em 401 — usado pelo próprio refresh, para não entrar em laço. */
  skipRefresh?: boolean;
};

let tokenProvider: () => string | null = () => null;
let refreshHandler: () => Promise<string | null> = async () => null;
let logoutHandler: () => Promise<void> = async () => {};

export function configurePlatformApi(opts: {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  logout: () => Promise<void>;
}) {
  tokenProvider = opts.getAccessToken;
  refreshHandler = opts.refresh;
  logoutHandler = opts.logout;
}

async function readBody(resp: Response): Promise<unknown> {
  if (resp.status === 204) return undefined;
  const ct = resp.headers.get('content-type') ?? '';
  if (ct.includes('json')) return resp.json();
  return resp.text();
}

async function readError(resp: Response): Promise<ApiError> {
  try {
    return new ApiError(resp.status, await resp.json());
  } catch {
    return new ApiError(resp.status);
  }
}

export async function platformFetch<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { anonymous, skipRefresh, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  if (!finalHeaders.has('Content-Type') && rest.body && typeof rest.body === 'string')
    finalHeaders.set('Content-Type', 'application/json');
  if (!anonymous) {
    const token = tokenProvider();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  const resp = await fetch(`${BASE_URL}${PLATFORM_PREFIX}${path}`, { ...rest, headers: finalHeaders });

  if (resp.status === 401 && !anonymous && !skipRefresh) {
    const novo = await refreshHandler();
    if (novo) {
      finalHeaders.set('Authorization', `Bearer ${novo}`);
      const retry = await fetch(`${BASE_URL}${PLATFORM_PREFIX}${path}`, { ...rest, headers: finalHeaders });
      if (!retry.ok) throw await readError(retry);
      return (await readBody(retry)) as T;
    }
    await logoutHandler();
    throw await readError(resp);
  }

  if (!resp.ok) throw await readError(resp);
  return (await readBody(resp)) as T;
}

export const platformApi = {
  get: <T = unknown>(path: string, opts?: Options) => platformFetch<T>(path, { method: 'GET', ...opts }),
  patch: <T = unknown>(path: string, body?: unknown, opts?: Options) =>
    platformFetch<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    }),
  put: <T = unknown>(path: string, body?: unknown, opts?: Options) =>
    platformFetch<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    }),
  post: <T = unknown>(path: string, body?: unknown, opts?: Options) =>
    platformFetch<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    }),
};

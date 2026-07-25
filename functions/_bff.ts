import { tenantFromHost, type BffEnv } from '../src/bff/core';

/**
 * Variáveis de ambiente da Cloudflare Pages (configuradas no painel do projeto):
 *  - BACKEND_URL: base do backend .NET (ex.: https://septem-api.onrender.com).
 *  - FORCED_TENANT (opcional): fixa o tenant em previews de branch (sem subdomínio).
 */
export type PagesEnv = {
  BACKEND_URL?: string;
  FORCED_TENANT?: string;
  ASSETS?: { fetch: (input: Request | string | URL) => Promise<Response> };
};

export type PagesContext = {
  request: Request;
  env: PagesEnv;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
};

/** Monta o BffEnv a partir do ambiente da Pages e da request atual. */
export function bffEnv(request: Request, env: PagesEnv): BffEnv {
  const url = new URL(request.url);
  return {
    backendUrl: (env.BACKEND_URL || '').replace(/\/$/, ''),
    tenantFor: (host) => tenantFromHost(host, env.FORCED_TENANT),
    secureCookies: url.protocol === 'https:',
  };
}

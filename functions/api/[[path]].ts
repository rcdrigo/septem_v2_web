import { proxyApi } from '../../src/bff/core';
import { bffEnv, type PagesContext } from '../_bff';

/**
 * Cloudflare Pages Function: captura TODAS as chamadas `/api/*` e faz o proxy
 * para o backend, injetando `X-Tenant` (host) e `Authorization` (cookie httpOnly)
 * e movendo os tokens de login para cookie. O cliente nunca vê o token.
 */
export async function onRequest(context: PagesContext): Promise<Response> {
  return proxyApi(context.request, bffEnv(context.request, context.env));
}

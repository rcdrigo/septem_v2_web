import { renderDocument } from '../src/bff/core';
import { bffEnv, type PagesContext } from './_bff';

/**
 * Cloudflare Pages middleware (roda em toda request). Para navegações de
 * DOCUMENTO (rotas SPA), injeta `window.__BOOTSTRAP__` (tenant + me) e as meta
 * tags Open Graph no index.html servido — assim `/tenant/config` e `/me` nunca
 * saem do navegador na carga da página. `/api/*` e assets seguem o fluxo normal.
 */
export async function onRequest(context: PagesContext): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api')) return context.next();
  if (!isDocumentRequest(request, url)) return context.next();

  return renderDocument(request, bffEnv(request, context.env), () => getIndexHtml(context));
}

function isDocumentRequest(request: Request, url: URL): boolean {
  if (request.method !== 'GET') return false;
  if (!(request.headers.get('accept') || '').includes('text/html')) return false;
  const last = url.pathname.split('/').pop() || '';
  if (last.includes('.')) return false; // asset com extensão
  return true;
}

async function getIndexHtml(context: PagesContext): Promise<string> {
  const origin = new URL(context.request.url).origin;
  if (context.env.ASSETS) {
    const r = await context.env.ASSETS.fetch(`${origin}/index.html`);
    if (r.ok) return r.text();
  }
  const r = await context.next('/index.html');
  return r.text();
}

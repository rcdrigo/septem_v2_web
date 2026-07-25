import type { Plugin, ViteDevServer, Connect } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { proxyApi, renderDocument, tenantFromHost, type BffEnv } from './core';

/**
 * Plugin do Vite que roda o MESMO núcleo do BFF em desenvolvimento — assim
 * `npm run dev` já opera em modo cookie (sessão httpOnly + bootstrap SSR), sem
 * precisar do wrangler, e a lógica não desvia entre dev e produção (Cloudflare).
 *
 * - `/api/*` → proxy para o backend (.NET em VITE_API_PROXY_TARGET, default :5000).
 * - Requests de documento (SPA) → HTML do Vite com `window.__BOOTSTRAP__` + OG.
 */
export function bffDev(): Plugin {
  const backendUrl = (process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000').replace(/\/$/, '');
  const forcedTenant = process.env.VITE_TENANT || 'prefeitura-x';

  const env: BffEnv = {
    backendUrl,
    tenantFor: (host) => tenantFromHost(host, forcedTenant),
    secureCookies: false, // dev é http
  };

  return {
    name: 'septem-bff-dev',
    configureServer(server: ViteDevServer) {
      // Um único middleware, na posição PRÉ (antes dos internos do Vite). Sem
      // prefixo de montagem — assim `req.url` chega inteiro (montar com '/api'
      // faz o connect remover o prefixo e o backend receberia o path errado).
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '/';
        try {
          // 1) Proxy /api → backend (X-Tenant + Bearer do cookie).
          if (url.startsWith('/api')) {
            const request = await toWebRequest(req);
            const response = await proxyApi(request, env);
            return await writeWebResponse(res, response);
          }
          // 2) Documento SPA → HTML do Vite com bootstrap SSR + OG injetados.
          if (isDocumentRequest(req)) {
            const templatePath = resolve(server.config.root, 'index.html');
            const raw = await readFile(templatePath, 'utf-8');
            const template = await server.transformIndexHtml(url, raw, req.originalUrl);
            const request = await toWebRequest(req);
            const response = await renderDocument(request, env, async () => template);
            return await writeWebResponse(res, response);
          }
          next();
        } catch (err) {
          res.statusCode = 502;
          res.end(`BFF dev error: ${(err as Error).message}`);
        }
      });
    },
  };
}

function isDocumentRequest(req: Connect.IncomingMessage): boolean {
  if (req.method !== 'GET') return false;
  const accept = req.headers.accept || '';
  if (!accept.includes('text/html')) return false;
  const path = (req.url || '/').split('?')[0];
  if (path.startsWith('/api') || path.startsWith('/@') || path.startsWith('/src') || path.startsWith('/node_modules')) return false;
  // Tem extensão de arquivo no último segmento → asset, não é rota SPA.
  const last = path.split('/').pop() || '';
  if (last.includes('.')) return false;
  return true;
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host || 'localhost';
  const url = `http://${host}${req.url || '/'}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
    else headers.set(k, v);
  }
  let body: Buffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise<Buffer>((res, rej) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c as Buffer));
      req.on('end', () => res(Buffer.concat(chunks)));
      req.on('error', rej);
    });
  }
  return new Request(url, { method: req.method, headers, body: body && body.length ? body : undefined });
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  // Set-Cookie precisa de tratamento especial (múltiplos valores).
  const setCookies = typeof (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function'
    ? (response.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
    : [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return; // tratado abaixo
    res.setHeader(key, value);
  });
  if (setCookies.length) res.setHeader('set-cookie', setCookies);

  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

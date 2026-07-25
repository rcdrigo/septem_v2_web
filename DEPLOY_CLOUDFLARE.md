# Deploy — Fase 11 (Cloudflare Pages + BFF)

A partir da Fase 11 o **front + BFF** vivem na **Cloudflare Pages** (saímos do
GitHub Pages). O **backend (.NET)** continua no **Render** e o **banco** no
**Neon** — nada muda neles além de 2 variáveis de configuração.

```
Navegador ──► Cloudflare Pages (SPA estática + BFF em functions/)
                     │  injeta X-Tenant (pelo host) e Authorization (cookie httpOnly)
                     ▼
              Render (Septem.Api .NET) ──► Neon (Postgres)
```

## 1. O que o dono precisa prover (fica tudo no nome dele)

| Item | Onde | Custo |
|------|------|-------|
| Conta **Cloudflare** | dash.cloudflare.com | grátis |
| Um **domínio** na conta Cloudflare (reusar `seaway.com.br` ou comprar) | Cloudflare → Websites | grátis (reuso) / ~R$40/ano |
| **Subdomínio-curinga** `*.<dominio>` apontando para o Pages | DNS da Cloudflare | grátis (1 nível) |

> Cada **cliente/tenant** vira um subdomínio (`clienteA.app.seaway.com.br`). O
> backend já resolve o tenant pelo host — o BFF só repassa isso.

## 2. Criar o projeto na Cloudflare Pages

1. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** →
   repositório `septem_v2_web`, branch `main`.
2. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Framework preset:** None
3. **Settings → Environment variables** (Production):
   - `BACKEND_URL` = `https://septem-api.onrender.com` (a URL do backend no Render)
   - `FORCED_TENANT` = *(deixe vazio em produção — o tenant vem do subdomínio; só use em previews de branch sem subdomínio)*
4. **Custom domains:** adicione o domínio/subdomínio-curinga (`*.app.seaway.com.br`).

Alternativa por CLI (na máquina do dono, logado com `wrangler login`):
```
npm run build
npx wrangler pages deploy dist --project-name=septem
```

### Deploy automático por push
O workflow `.github/workflows/deploy-cloudflare.yml` publica a cada push em `main`.
Configure os segredos no GitHub (repo → Settings → Secrets and variables → Actions):
- `CLOUDFLARE_API_TOKEN` (permissão *Cloudflare Pages: Edit*)
- `CLOUDFLARE_ACCOUNT_ID`

> O antigo `deploy.yml` (GitHub Pages) foi **desativado** (só manual) — não publique
> por lá: o Pages é estático e não tem o BFF, o app quebraria.

## 3. Ajustes no backend (Render) — 2 variáveis

No serviço do Render (Environment):

- `Tenancy__AllowHeaderResolution` = `true`
  O BFF é quem resolve o tenant (pelo host) e envia `X-Tenant` ao backend. Sem
  isso, em produção o backend ignoraria o header. (O cliente **não** manda mais
  esse header — só o BFF, que é origem confiável.)
- `Cors__Origins` = *(vazio ou o domínio do BFF)*
  Com o BFF, o navegador fala **só** com o próprio domínio (same-origin) — não há
  mais CORS de navegador. Pode esvaziar `Cors:Origins` (o backend passa a
  same-origin) ou restringir ao domínio do BFF por segurança.

## 4. Cadastro do tenant (banco)

Cada tenant precisa ter seu **host** (o subdomínio) registrado no master, para o
`FindByHostAsync` resolver. Ex.: tenant `prefeitura-x` com host
`prefeitura-x.app.seaway.com.br`.

## 5. Checklist pós-deploy

- [ ] `https://<tenant>.<dominio>/` abre o app com o branding do tenant.
- [ ] View-source mostra `<meta property="og:title">` com o nome do cliente (SSR).
- [ ] DevTools → Network: recarregar **não** dispara `/api/tenant/config` nem `/me`.
- [ ] DevTools → Application → Cookies: `septem_at`/`septem_rt` com **HttpOnly** e **Secure**.
- [ ] `document.cookie` no console **não** mostra os tokens.
- [ ] Login, refresh (deixar a aba aberta) e logout funcionam.

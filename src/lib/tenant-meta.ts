import type { Tenant } from '@/stores/session';

/**
 * Aplica as meta tags de compartilhamento (Open Graph) a partir dos Parâmetros do
 * sistema: quem cola a URL do portal no WhatsApp/Teams vê o nome do cliente, a
 * descrição e a imagem de destaque do tenant — não "Septem".
 *
 * Nota: crawlers que não executam JS (WhatsApp, Slack) só leem meta tags do HTML
 * servido. Isso passa a valer de fato quando o BFF/SSR entrar (Fase 11); aqui já
 * deixamos a fonte da verdade certa e o título/preview corretos no navegador.
 */
export function applyTenantMeta(tenant: Tenant): void {
  const title = `${tenant.clienteNome} — ${tenant.ambienteNome}`;
  const description = tenant.systemDescription ?? 'Portal de serviços e processos.';
  const image = tenant.heroImageUrl ?? tenant.logoUrl ?? '';

  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:url', window.location.origin + import.meta.env.BASE_URL);
  setMeta('name', 'description', description);
  setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');

  if (image) {
    setMeta('property', 'og:image', image);
  } else {
    document.head.querySelector('meta[property="og:image"]')?.remove();
  }
}

function setMeta(attr: 'name' | 'property', key: string, value: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

import { useEffect } from 'react';
import { useSessionStore } from '@/stores/session';
import { tenantSystemName } from '@/lib/tenant-meta';

/**
 * Define o título da aba conforme o conteúdo (tarefa, processo, página). Restaura
 * o título padrão ao desmontar.
 */
export function useDocumentTitle(title: string | null | undefined) {
  const tenant = useSessionStore((s) => s.tenant);
  const systemName = window.location.pathname.includes('/platform') ? 'Septem' : tenantSystemName(tenant);
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${systemName}` : systemName;
    return () => { document.title = previous; };
  }, [title, systemName]);
}

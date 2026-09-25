import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-api';

/**
 * Catálogo de processos da Septem (ADM-05, Fase 12).
 *
 * A modelagem NÃO acontece aqui: ela usa o modelador do ambiente interno de catálogo, que
 * já tem parser, validador e simulador. Desta tela saem o cadastro da chave e a
 * **publicação de versões** — e o link para o modelador desse ambiente.
 */

export type CatalogVersionRow = {
  id: string;
  version: number;
  publishedAt: string;
  pendingCount: number;
  releaseNotes: string | null;
};

export type CatalogProcessRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  active: boolean;
  versions: CatalogVersionRow[];
};

export type CatalogList = {
  items: CatalogProcessRow[];
  total: number;
  catalogTenantId: string;
};

export type PublishedVersion = {
  id: string;
  version: number;
  publishedAt: string;
  artifacts: number;
  pendings: { type: string; logicalId: string; reason: string; detail: string }[];
};

export const platformCatalogKeys = {
  all: ['platform', 'process-catalog'] as const,
};

export function usePlatformCatalog() {
  return useQuery({
    queryKey: platformCatalogKeys.all,
    queryFn: () => platformApi.get<CatalogList>('/process-catalog/'),
  });
}

export function useCreateCatalogProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; name: string; description?: string }) =>
      platformApi.post<{ id: string }>('/process-catalog/', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: platformCatalogKeys.all }),
  });
}

export function usePublishCatalogVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, releaseNotes }: { id: string; releaseNotes?: string }) =>
      platformApi.post<PublishedVersion>(`/process-catalog/${id}/versions`, { releaseNotes }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: platformCatalogKeys.all }),
  });
}

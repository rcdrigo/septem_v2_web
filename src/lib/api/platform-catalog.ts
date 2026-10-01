import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  sourceEnvironmentId?: string | null;
};

export type CatalogList = {
  items: CatalogProcessRow[];
  total: number;
  catalogTenantId: string | null;
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
    mutationFn: (body: { key: string; name: string; description?: string; sourceTenantId?: string }) =>
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

export type CatalogInventoryItem = {
  id: string;
  processId?: string;
  clientName: string;
  host?: string | null;
  tenantId: string;
  environmentName: string;
  purpose: string;
  key: string;
  name: string;
  version: number;
  status: string;
  importable: boolean;
};
export type CatalogInventoryResponse = {
  items: CatalogInventoryItem[];
  total: number;
  page: number;
  pageSize: number;
};
export type CatalogImportPlan = {
  id: string;
  source: string;
  destination: string;
  status: string;
  planVersion: number;
  requiresConfirmation: boolean;
  items: { type: string; logicalId: string; name: string; action: string; sourceVersion: number | null; targetVersion: number | null; dependency: boolean }[];
  blockers: { reason: string; detail: string }[];
};
export function useCatalogInventory(options?: {
  search?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}) {
  // The existing catalog inventory screen uses the complete result set. Keep that
  // behavior for no-argument calls; callers opt into server pagination explicitly.
  const paginated = options?.page !== undefined || options?.pageSize !== undefined;
  const search = options?.search ?? '';
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const params = new URLSearchParams();
  if (paginated) {
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
  }
  if (search) params.set('search', search);
  const suffix = params.size ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: [...platformCatalogKeys.all, 'inventory', paginated ? search : '', paginated ? page : 'all', paginated ? pageSize : 'all'],
    queryFn: () => platformApi.get<CatalogInventoryResponse>(`/process-catalog/inventory${suffix}`),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}
export function useCompareCatalogImport() {
  return useMutation({
    mutationFn: (body: { source: string; destination: string; keys: string[] }) =>
      platformApi.post<CatalogImportPlan>('/process-catalog/imports/compare', body),
  });
}
export function useApplyCatalogImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; confirmUpdate: boolean; expectedPlanVersion: number }) =>
      platformApi.post<{ ok: boolean; drafts: { key: string; version: number }[]; details: string[] }>(`/process-catalog/imports/${id}/apply`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: platformCatalogKeys.all }),
  });
}

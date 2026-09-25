import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Transferências entre ambientes do cliente (ADM-06, Fase 13).
 *
 * As rotas são de AMBIENTE (`/api/v1/client/...`): quem chama está logado em um ambiente e é
 * administrador do cliente. A decisão é dele — a central não aprova nada.
 */

export type ClientEnvironment = {
  tenantId: string;
  clientName: string;
  displayName: string;
  host: string;
  /** production | staging | demo */
  purpose: string;
  operatingMode: string;
  provisioningState: string;
};

export type TransferKind = 'catalog_update' | 'promote' | 'sync_to_staging';

export type TransferItem = {
  type: string;
  logicalId: string;
  name: string;
  /** new | unchanged | update | conflict */
  action: string;
  sourceVersion: number | null;
  targetVersion: number | null;
  targetFingerprint: string;
  /** Entrou como dependência resolvida, não por escolha direta. */
  dependency: boolean;
  /** Outros processos do destino que também usam este artefato. */
  sharedWith: string[];
};

export type TransferPlan = {
  id: string;
  kind: TransferKind;
  source: string;
  destination: string;
  status: string;
  planVersion: number;
  createdAt: string;
  appliedAt: string | null;
  safeError: string | null;
  items: TransferItem[];
  conflicts: TransferItem[];
  blockers: { reason: string; detail: string }[];
  requiresConfirmation: boolean;
  canApply: boolean;
};

export const transferKeys = {
  environments: ['client', 'environments'] as const,
  plan: (id: string) => ['client', 'transfers', id] as const,
};

/** "Meus ambientes" — o que o admin do cliente alcança (Fase 2b). */
export function useClientEnvironments() {
  return useQuery({
    queryKey: transferKeys.environments,
    queryFn: () => api.get<{ items: ClientEnvironment[]; total: number }>('/api/v1/client/environments'),
  });
}

/** Um processo de um ambiente, como a listagem de artefatos devolve (Fase 12). */
export type EnvironmentProcess = {
  id: string;
  key: string;
  name: string;
  currentVersion: number;
  status: string;
  /** Versão publicada (é a que viaja); nulo = nunca foi publicado. */
  publishedVersion: number | null;
  catalogKey: string | null;
  catalogVersion: number | null;
  customized: boolean;
};

/**
 * Artefatos de UM ambiente do cliente.
 *
 * ⚠️ É daqui que sai a lista de serviços a transferir — e não do ambiente em que a pessoa
 * está logada. Era o bug da primeira versão desta tela: logado em produção, ela oferecia os
 * serviços DE PRODUÇÃO para promover da homologação, e a comparação não achava nada.
 */
export function useEnvironmentArtifacts(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['client', 'environments', tenantId, 'artifacts'],
    queryFn: () => api.get<{ tenantId: string; processes: EnvironmentProcess[] }>(
      `/api/v1/environments/${tenantId}/artifacts`),
    enabled: !!tenantId,
  });
}

export function useCompareTransfer() {
  return useMutation({
    mutationFn: (body: {
      kind: TransferKind;
      source?: string | null;
      destination: string;
      artifactKeys: string[];
    }) => api.post<TransferPlan>('/api/v1/client/transfers/compare', body),
  });
}

export function useApplyTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, confirmOverwriteConflicts, expectedPlanVersion }: {
      planId: string;
      confirmOverwriteConflicts: boolean;
      expectedPlanVersion: number;
    }) => api.post<{ ok: boolean; activated: { key: string; version: number }[]; details: string[] }>(
      `/api/v1/client/transfers/${planId}/apply`,
      { confirmOverwriteConflicts, expectedPlanVersion }),
    onSuccess: () => {
      // O destino mudou: a lista de processos do ambiente atual pode estar velha.
      void qc.invalidateQueries({ queryKey: ['process-definitions'] });
    },
  });
}

/** Volta o artefato para a versão anterior (M-A24). */
export function useRestoreArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, artifactId, version }: { tenantId: string; artifactId: string; version?: number }) =>
      api.post<{ key: string; version: number; status: string }>(
        `/api/v1/environments/${tenantId}/artifacts/${artifactId}/restore`, { version }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['process-definitions'] }),
  });
}

export const TRANSFER_KIND_LABEL: Record<TransferKind, string> = {
  // "Serviços" é o nome amigável do catálogo de processos (pedido da Fase 13).
  catalog_update: 'Atualizar serviços do catálogo da Septem',
  promote: 'Promover para produção',
  sync_to_staging: 'Copiar produção para homologação',
};

export const TRANSFER_ACTION_LABEL: Record<string, string> = {
  new: 'Novo no destino',
  unchanged: 'Já está igual',
  update: 'Atualiza',
  conflict: 'Sobrescreve alteração local',
};

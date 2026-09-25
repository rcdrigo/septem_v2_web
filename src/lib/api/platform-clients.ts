import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-api';

/** Leitura do catálogo central (Fase 2a). Só super admin enxerga. */

export type PlatformClientRow = {
  id: string;
  name: string;
  createdAt: string;
  environments: number;
};

export type PlatformEnvironment = {
  tenantId: string;
  displayName: string;
  host: string;
  /** production | staging | demo — a finalidade aparece em todo detalhe (ADM-01). */
  purpose: string;
  operatingMode: string;
  provisioningState: string;
  clientCanEditCredentials: boolean;
  /** Operação que provisionou este ambiente — o cartão de progresso acompanha por ela. */
  operationId?: string | null;
};

export type PlatformClientDetail = {
  id: string;
  name: string;
  createdAt: string;
  environments: PlatformEnvironment[];
  /** Operações que ainda não viraram ambiente — os primeiros segundos do provisionamento. */
  pendingOperations?: { operationId: string; target: string; status: string; currentStep: string | null }[];
};

export const platformClientKeys = {
  all: ['platform', 'clients'] as const,
  detail: (id: string) => ['platform', 'clients', id] as const,
};

export function usePlatformClients() {
  return useQuery({
    queryKey: platformClientKeys.all,
    queryFn: () => platformApi.get<{ items: PlatformClientRow[]; total: number }>('/clients/'),
  });
}

export function usePlatformClient(id: string | undefined) {
  return useQuery({
    queryKey: platformClientKeys.detail(id ?? ''),
    queryFn: () => platformApi.get<PlatformClientDetail>(`/clients/${id}`),
    enabled: !!id,
    // Provisionamento em curso: reconsulta sozinho até tudo ficar pronto. Mandar a
    // pessoa recarregar a página seria passar a ela um problema nosso.
    refetchInterval: (q) => {
      const d = q.state.data as PlatformClientDetail | undefined;
      if (!d) return false;
      const andando = (d.pendingOperations?.length ?? 0) > 0
        || d.environments.some((a) => a.provisioningState !== 'ready');
      return andando ? 3000 : false;
    },
  });
}

/** Rótulos em português para os valores que a API devolve em inglês. */
/** Detalhe de um ambiente na área central, com a versão para o expectedVersion. */
export type PlatformEnvironmentDetail = PlatformEnvironment & {
  clientName: string | null;
  version: number;
};

export function usePlatformEnvironment(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['platform', 'environments', tenantId ?? ''] as const,
    queryFn: () => platformApi.get<PlatformEnvironmentDetail>(`/environments/${tenantId}`),
    enabled: !!tenantId,
  });
}

/** Ocorrências que venceram durante a inativação e esperam decisão (Q20). */
export type OverdueSchedule = {
  id: number;
  alertId: string;
  taskName: string;
  dueAt: string | null;
  executionNumber: number;
};

export function useOverdueSchedules(tenantId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['platform', 'environments', tenantId ?? '', 'overdue'] as const,
    queryFn: () => platformApi.get<{ items: OverdueSchedule[]; total: number }>(`/environments/${tenantId}/overdue-schedules`),
    enabled: !!tenantId && enabled,
  });
}

/** Edição do que é editável DEPOIS de criado: nome exibido e logo (o banco é imutável). */
export function useUpdateEnvironment(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { displayName?: string; clientCanEditCredentials?: boolean; expectedVersion?: number }) =>
      platformApi.patch<{ displayName: string; version: number }>(`/environments/${tenantId}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform', 'environments', tenantId] });
      void qc.invalidateQueries({ queryKey: platformClientKeys.all });
    },
  });
}

/** Integrações do ambiente vistas da central — alimenta a pendência do M-A14. */
export function useEnvironmentIntegrations(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['platform', 'environments', tenantId ?? '', 'integrations'] as const,
    queryFn: () => platformApi.get<{ items: { kind: string; name: string; owner: string; status: string }[] }>(
      `/environments/${tenantId}/integrations`),
    enabled: !!tenantId,
  });
}

export function useChangeMode(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { mode: string; expectedVersion?: number }) =>
      platformApi.post<{ operatingMode: string; version: number; overdueSchedules: number }>(
        `/environments/${tenantId}/mode`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform', 'environments', tenantId] });
      void qc.invalidateQueries({ queryKey: platformClientKeys.all });
    },
  });
}

export function useDecideSchedule(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'execute' | 'discard' }) =>
      platformApi.post(`/environments/${tenantId}/overdue-schedules/${id}`, { decision }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'environments', tenantId, 'overdue'] }),
  });
}

/** Catálogo de funcionalidades contratáveis (ADM-04). */
export type FeatureDefinition = {
  key: string;
  name: string;
  description: string | null;
  /** false = existe no catálogo mas ainda não no produto (Q17). */
  implemented: boolean;
  requiredIntegrations: string | null;
};

export function useFeatureCatalog() {
  return useQuery({
    queryKey: ['platform', 'features'] as const,
    queryFn: () => platformApi.get<{ items: FeatureDefinition[] }>('/features'),
  });
}

export function useEnvironmentFeatures(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['platform', 'environments', tenantId ?? '', 'features'] as const,
    queryFn: () => platformApi.get<{ enabled: string[]; version: number }>(`/environments/${tenantId}/features`),
    enabled: !!tenantId,
  });
}

export function useSaveFeatures(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { enabled: string[]; expectedVersion?: number }) =>
      platformApi.put<{ enabled: string[]; version: number }>(`/environments/${tenantId}/features`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'environments', tenantId] }),
  });
}

/**
 * Finalidade do AMBIENTE. O rótulo diz "ambiente" por decisão do dono (Q18): existe também
 * a "versão em homologação" dentro de um ambiente, e os dois conceitos eram confundidos na
 * mesma palavra. A versão será aposentada na fase seguinte; o ambiente, não.
 */
export const PURPOSE_LABEL: Record<string, string> = {
  production: 'Produção',
  staging: 'Ambiente de homologação',
  demo: 'Demonstração',
};

export const MODE_LABEL: Record<string, string> = {
  active: 'Ativo',
  new_requests_blocked: 'Novas requisições bloqueadas',
  inactive: 'Inativado',
};

export const STATE_LABEL: Record<string, string> = {
  queued: 'Na fila',
  running: 'Provisionando',
  failed: 'Falhou',
  ready: 'Pronto',
};

// ── Provisionamento (Fase 11a) ───────────────────────────────────────────────

/** Uma operação de provisionamento em andamento. */
export type ProvisioningOperation = {
  purpose: string;
  tenantId: string;
  host: string;
  operationId: string;
  status: string;
  statusUrl: string;
};

export type NovoAmbienteInput = {
  tenantId?: string;
  dbName?: string;
  host?: string;
  displayName?: string;
  seedDummyData: boolean;
};

export type NovoClienteInput = {
  name: string;
  primaryColor?: string;
  adminName?: string;
  adminEmail?: string;
  features?: string[];
  production?: NovoAmbienteInput;
  staging?: NovoAmbienteInput | null;
  /** Processos do catálogo a instalar nos dois ambientes (Fase 12). */
  catalogProcessKeys?: string[];
};

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NovoClienteInput) =>
      platformApi.post<{ clientId: string; name: string; operations: ProvisioningOperation[] }>(
        '/clients/', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformClientKeys.all }),
  });
}

/** Etapas de uma operação — é o que o cartão de progresso mostra. */
export type OperationStep = {
  name: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  safeError: string | null;
};

export type OperationDetail = {
  operationId: string;
  type: string;
  target: string;
  status: string;
  currentStep: string | null;
  attempts: number;
  safeError: string | null;
  nextAttemptAt: string | null;
  steps: OperationStep[];
};

export function useOperation(operationId: string | undefined, acompanhar: boolean) {
  return useQuery({
    queryKey: ['platform', 'operations', operationId ?? ''] as const,
    queryFn: () => platformApi.get<OperationDetail>(`/operations/${operationId}`),
    enabled: !!operationId,
    // Enquanto não termina, reconsulta: o provisionamento leva minutos e o cartão precisa
    // andar sozinho. Parado o trabalho, para de perguntar.
    refetchInterval: acompanhar ? 3000 : false,
  });
}

export function useRetryOperation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (operationId: string) => platformApi.post(`/operations/${operationId}/retry`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'operations'] }),
  });
}

/** Convites do cliente — alimenta o cartão "Convite não entregue". */
export type AdminInviteRow = {
  inviteId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  lastSendError: string | null;
};

export function useAdminInvites(clientId: string | undefined) {
  return useQuery({
    queryKey: ['platform', 'clients', clientId ?? '', 'invites'] as const,
    queryFn: () => platformApi.get<{ items: AdminInviteRow[] }>(`/clients/${clientId}/admin-invites`),
    enabled: !!clientId,
    // O convite só nasce no ÚLTIMO passo do provisionamento (depois da prontidão).
    // Enquanto não houver nenhum, a tela continua perguntando — senão quem acabou de
    // cadastrar o cliente precisaria recarregar a página para ver o convite aparecer.
    refetchInterval: (q) => {
      const d = q.state.data as { items: AdminInviteRow[] } | undefined;
      return (d?.items.length ?? 0) === 0 ? 4000 : false;
    },
  });
}

export function useResendInvite(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => platformApi.post<{ inviteId: string; sent: boolean; pendingReason: string | null }>(
      `/clients/${clientId}/admin-invites/resend`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'clients', clientId, 'invites'] }),
  });
}

// ── Domínios (Fase 11b) ──────────────────────────────────────────────────────

export type EnvironmentDomainRow = {
  id: string;
  host: string;
  kind: string;
  status: 'pending' | 'verified' | 'broken';
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  certificateExpiresAt: string | null;
  certificateExpiringSoon: boolean;
  lastError: string | null;
};

export function useEnvironmentDomains(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['platform', 'environments', tenantId ?? '', 'domains'] as const,
    queryFn: () => platformApi.get<{ platformHost: string; items: EnvironmentDomainRow[] }>(
      `/environments/${tenantId}/domains`),
    enabled: !!tenantId,
  });
}

export function useAddDomain(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (host: string) => platformApi.post<{
      id: string; host: string; status: string;
      dns: { type: string; name: string; value: string; note: string };
    }>(`/environments/${tenantId}/domains`, { host }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'environments', tenantId, 'domains'] }),
  });
}

export function useVerifyDomain(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domainId: string) => platformApi.post<EnvironmentDomainRow>(
      `/environments/${tenantId}/domains/${domainId}/verify`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'environments', tenantId, 'domains'] }),
  });
}

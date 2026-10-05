import type { BusinessHoursWeek } from '@/lib/business-calendar';
import type { CalendarLocation } from '@/lib/business-calendar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-api';

/** Leitura do catálogo central (Fase 2a). Só super admin enxerga. */

export type PlatformClientRow = {
  id: string;
  name: string;
  createdAt: string;
  environments: number;
  status: string;
};

export type PlatformEnvironment = {
  tenantId: string;
  displayName: string;
  host: string;
  url?: string | null;
  databaseName?: string | null;
  /** production | staging | demo — a finalidade aparece em todo detalhe (ADM-01). */
  purpose: string;
  operatingMode: string;
  provisioningState: string;
  clientCanEditCredentials: boolean;
  /** Operação que provisionou este ambiente — o cartão de progresso acompanha por ela. */
  operationId?: string | null;
};

export type PlatformClientDetail = CalendarLocation & {
  businessHours?: BusinessHoursWeek | null;
  id: string;
  name: string;
  createdAt: string;
  status: string;
  canManageClient: boolean;
  removalOperationId?: string | null;
  environments: PlatformEnvironment[];
  /** Operações que ainda não viraram ambiente — os primeiros segundos do provisionamento. */
  pendingOperations?: { operationId: string; target: string; status: string; currentStep: string | null; purpose?: string; host?: string }[];
};

export const platformClientKeys = {
  all: ['platform', 'clients'] as const,
  detail: (id: string) => ['platform', 'clients', id] as const,
};

export function usePlatformClients() {
  return useQuery({
    queryKey: platformClientKeys.all,
    queryFn: () => platformApi.get<{ items: PlatformClientRow[]; total: number }>('/clients/'),
    refetchInterval: (query) => query.state.data?.items.some(client => client.status === 'removing') ? 3000 : false,
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
      const andando = d.status === 'removing' || (d.pendingOperations?.length ?? 0) > 0
        || d.environments.some((a) => a.provisioningState !== 'ready');
      return andando ? 3000 : false;
    },
  });
}

/** Rótulos em português para os valores que a API devolve em inglês. */
/** Detalhe de um ambiente na área central, com a versão para o expectedVersion. */
export type PlatformEnvironmentDetail = PlatformEnvironment & {
  clientName: string | null;
  clientId?: string | null;
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
  /** Id PÚBLICO (Guid) — o sequencial do banco não sai da API. */
  id: string;
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
    mutationFn: ({ id, decision }: { id: string; decision: 'execute' | 'discard' }) =>
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
  seedDummyData?: boolean;
};

export type NovoClienteInput = {
  initialSettings?: {
    logoUrl?: string | null;
    heroImageUrl?: string | null;
    systemDescription?: string | null;
    policies?: Record<string, { visible: boolean; editable: boolean }>;
  };
  name: string;
  primaryColor?: string;
  managedBySeptem?: boolean;
  adminName?: string;
  adminEmail?: string;
  features?: string[];
  production: NovoAmbienteInput;
  staging: NovoAmbienteInput;
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
      refetchInterval: acompanhar ? (query) => {
        const status = query.state.data?.status;
        return !status || status === 'queued' || status === 'running' ? 3000 : false;
      } : false,
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

/** Resposta 202 de um comando que virou job: acompanhar pelo `statusUrl`. */
export type OperacaoAceita = { operationId: string; status: string; statusUrl: string };

/**
 * Espera uma operação (job) terminar, perguntando ao servidor. Concluída → resolve; falhou ou
 * parou para reconciliação → rejeita com o erro seguro que o servidor mandou.
 */
export async function aguardarOperacao(operationId: string, limiteMs = 120_000): Promise<OperationDetail> {
  const fim = Date.now() + limiteMs;
  for (;;) {
    const op = await platformApi.get<OperationDetail>(`/operations/${operationId}`);
    if (op.status === 'completed') return op;
    if (op.status === 'failed' || op.status === 'needs_reconciliation')
      throw new Error(op.safeError ?? 'A operação não terminou.');
    if (Date.now() > fim) throw new Error('A operação ainda está em andamento. Acompanhe pela lista em instantes.');
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/**
 * Verificar domínio é um JOB (202): o botão fica "verificando" até a operação terminar, e só
 * então a lista mostra o resultado — verificado ou o motivo de não ter verificado.
 */
export function useVerifyDomain(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (domainId: string) => {
      const aceito = await platformApi.post<OperacaoAceita>(`/environments/${tenantId}/domains/${domainId}/verify`, {});
      return aguardarOperacao(aceito.operationId);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['platform', 'environments', tenantId, 'domains'] }),
  });
}


export type PlatformClientMetrics = {
  internalUsers: number;
  externalUsers: number;
  productionEnvironments: number;
};

export type PlatformClientHistoryItem = {
  id: string;
  actorName: string | null;
  occurredAt: string;
  type: string;
  environmentId: string | null;
  result: string | null;
  metadataJson: string | null;
};

export type SuperAdminRow = {
  id: string;
  version: number;
  name: string;
  email: string;
  status: string;
  globalAccess: boolean;
  clients: string[];
  environments: string[];
};

export type SuperAdminInput = Omit<SuperAdminRow, 'id' | 'version'> & { expectedVersion?: number };

export function usePlatformClientMetrics(clientId: string | undefined) {
  return useQuery({
    queryKey: ['platform', 'clients', clientId ?? '', 'metrics'] as const,
    queryFn: () => platformApi.get<PlatformClientMetrics>(`/clients/${clientId}/metrics`),
    enabled: !!clientId,
  });
}

export function usePlatformClientHistory(clientId: string | undefined) {
  return useQuery({
    queryKey: ['platform', 'clients', clientId ?? '', 'history'] as const,
    queryFn: () => platformApi.get<{ items: PlatformClientHistoryItem[] }>(`/clients/${clientId}/history`),
    enabled: !!clientId,
  });
}

export function useSetPlatformClientStatus(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: 'active' | 'inactive') =>
      platformApi.post(`/clients/${clientId}/status`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformClientKeys.all });
      void qc.invalidateQueries({ queryKey: platformClientKeys.detail(clientId) });
      void qc.invalidateQueries({ queryKey: ['platform', 'clients', clientId, 'metrics'] });
    },
  });
}

export function useSuperAdmins() {
  return useQuery({
    queryKey: ['platform', 'super-admins'] as const,
    queryFn: () => platformApi.get<{ items: SuperAdminRow[] }>('/super-admins'),
  });
}

export function useSaveSuperAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: SuperAdminInput & { id: string }) =>
      platformApi.put<{ id: string; created: boolean; invitationSent: boolean }>(`/super-admins/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'super-admins'] }),
  });
}

export function useResendSuperAdminInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => platformApi.post<{ invitationSent: boolean }>('/super-admins/' + id + '/invite', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'super-admins'] }),
  });
}

export function useCompleteSuperAdminSetup() {
  return useMutation({
    mutationFn: (body: { email: string; code: string; password: string }) =>
      platformApi.post('/auth/setup', body, { anonymous: true }),
  });
}

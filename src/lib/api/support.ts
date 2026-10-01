import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { platformApi } from '@/lib/platform-api';
import { useSessionStore } from '@/stores/session';
import { usePlatformSession } from '@/stores/platform-session';
import { novoId } from '@/lib/uuid';

/**
 * Suporte (Fase 3 do plano 26_09) — equipes.
 *
 * As MESMAS rotas servem os dois lados: o cliente em `/api/v1/support/*` (token do ambiente) e a
 * Septem em `/api/v1/platform/support/*` (token central). Aqui isso aparece como um `escopo`, e
 * quem escolhe o cliente HTTP é uma função só — a tela não repete essa decisão.
 */
export type SupportScope = 'cliente' | 'septem';

export type SupportTeamMember = {
  /** Id PÚBLICO do usuário (identidade central ou usuário do ambiente) — é por ele que se remove. */
  userId: string;
  name: string;
  email: string | null;
  /** Verdadeiro quando é identidade da Septem. */
  platform: boolean;
  tenantId: string | null;
};

export type SupportTeam = {
  id: string;
  /** septem | client */
  scope: string;
  /** Id PÚBLICO do cliente (equipe de cliente); nulo na equipe da Septem. */
  clientId: string | null;
  name: string;
  description: string | null;
  active: boolean;
  /** Versão (xmin) — devolvida em `expectedVersion` ao editar. */
  version: number;
  members: SupportTeamMember[];
};

export type SupportTeamWrite = {
  name?: string;
  description?: string | null;
  active?: boolean;
  /** Obrigatória ao EDITAR: a versão que a tela leu (409 `stale_version` se alguém mudou antes). */
  expectedVersion?: number;
};

/** Permissão do ambiente que autoriza administrar as equipes do cliente (Q13). */
export const SUPPORT_TEAM_ADMIN = 'support:admin';

const cliente = (escopo: SupportScope) => (escopo === 'septem' ? platformApi : api);
const caminho = (escopo: SupportScope, resto = '') =>
  escopo === 'septem' ? `/support/teams${resto}` : `/api/v1/support/teams${resto}`;

/**
 * Chave de cache com **tenant + usuário + escopo**.
 *
 * Não é zelo: a mesma aba troca de identidade em três situações reais — personificação, logout
 * e login de outra conta, e o tráfego entre a área central e o ambiente. Uma chave só por
 * "equipes" faria a lista de quem entrou depois aparecer com os dados de quem saiu antes, e
 * equipe de suporte carrega nome e e-mail de gente.
 */
export function useSupportKeys(escopo: SupportScope) {
  const quem = useQuemEsta(escopo);
  return { teams: ['support', escopo, quem, 'teams'] as const };
}

/** Quem está na sessão deste lado — a parte de identidade de toda chave de cache por usuário. */
export function useQuemEsta(escopo: SupportScope) {
  const tenantId = useSessionStore((s) => s.tenant?.tenantId ?? 'sem-tenant');
  const usuarioId = useSessionStore((s) => s.user?.id ?? 'anonimo');
  const identidadeId = usePlatformSession((s) => s.identity?.id ?? 'anonimo');
  return escopo === 'septem' ? `central:${identidadeId}` : `${tenantId}:${usuarioId}`;
}

export function useSupportTeams(escopo: SupportScope) {
  const keys = useSupportKeys(escopo);
  return useQuery({
    queryKey: keys.teams,
    queryFn: () => cliente(escopo).get<SupportTeam[]>(caminho(escopo, '/')),
  });
}

export function useCreateSupportTeam(escopo: SupportScope) {
  const qc = useQueryClient();
  const keys = useSupportKeys(escopo);
  return useMutation({
    mutationFn: (body: SupportTeamWrite) => cliente(escopo).post<SupportTeam>(caminho(escopo, '/'), body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.teams }),
  });
}

export function useUpdateSupportTeam(escopo: SupportScope) {
  const qc = useQueryClient();
  const keys = useSupportKeys(escopo);
  return useMutation({
    mutationFn: ({ id, ...body }: SupportTeamWrite & { id: string }) =>
      cliente(escopo).patch<SupportTeam>(caminho(escopo, `/${id}`), body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.teams }),
  });
}

/** Inclui membro pelo id público do usuário. Repetir é inofensivo — o backend é idempotente. */
export function useAddSupportMember(escopo: SupportScope) {
  const qc = useQueryClient();
  const keys = useSupportKeys(escopo);
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      cliente(escopo).put<void>(caminho(escopo, `/${teamId}/members/${userId}`)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.teams }),
  });
}

export function useRemoveSupportMember(escopo: SupportScope) {
  const qc = useQueryClient();
  const keys = useSupportKeys(escopo);
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      cliente(escopo).del<void>(caminho(escopo, `/${teamId}/members/${userId}`)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.teams }),
  });
}

/** Pessoa que pode entrar numa equipe — mesma forma nos dois lados, para a tela não ramificar. */
export type SupportCandidate = { userId: string; name: string; email: string | null };

/**
 * Candidatos a membro. No lado da Septem são as identidades centrais; no lado do cliente, os
 * usuários do próprio ambiente (a lista que a tela de usuários já usa).
 */
export function useSupportCandidates(escopo: SupportScope, busca: string) {
  const keys = useSupportKeys(escopo);
  return useQuery({
    queryKey: [...keys.teams, 'candidatos', busca],
    queryFn: async () => {
      if (escopo === 'septem') {
        const termo = busca.trim();
        return platformApi.get<SupportCandidate[]>(`/support/identities${termo ? `?q=${encodeURIComponent(termo)}` : ''}`);
      }
      const qs = new URLSearchParams({ page: '1', pageSize: '20', status: 'active' });
      if (busca.trim()) qs.set('q', busca.trim());
      const pagina = await api.get<{ items: { id: string; name: string; email: string }[] }>(
        `/api/v1/users?${qs.toString()}`,
      );
      return pagina.items.map((u) => ({ userId: u.id, name: u.name, email: u.email }));
    },
  });
}

// ── Papéis centrais (Fase 3) ────────────────────────────────────────────────────
/**
 * Papéis da equipe da Septem. `super_admin` NÃO entra aqui: a rota não o concede, porque virar
 * super admin não é rotina de tela.
 */
export const PAPEIS_DE_SUPORTE = [
  { role: 'support_triage', label: 'Triagem', help: 'Recebe e encaminha os chamados de todos os clientes.' },
  { role: 'support_agent', label: 'Atendimento', help: 'Atende em equipes da Septem.' },
] as const;

export type PlatformIdentityRow = {
  userId: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
};

const identityKeys = ['support', 'septem', 'identities'] as const;

/** Só o super admin lê esta lista — o backend devolve 403 para os demais. */
export function usePlatformIdentities(habilitado: boolean) {
  return useQuery({
    queryKey: identityKeys,
    queryFn: () => platformApi.get<PlatformIdentityRow[]>('/identities/'),
    enabled: habilitado,
  });
}

/**
 * Concede ou revoga UM papel. É um verbo por pedido, não o estado final da lista: mandar a lista
 * inteira apagaria em silêncio um papel que outra pessoa concedeu entre a leitura e o envio.
 */
export function useSetPlatformRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role, conceder }: { userId: string; role: string; conceder: boolean }) =>
      conceder
        ? platformApi.put<void>(`/identities/${userId}/roles/${role}`)
        : platformApi.del<void>(`/identities/${userId}/roles/${role}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: identityKeys }),
  });
}

// ── Chamados (Fase 4) ───────────────────────────────────────────────────────────

/** Natureza do chamado — obrigatória na abertura (SUP-01). */
export const NATUREZAS = [
  { value: 'bug', label: 'Erro', help: 'Algo que funcionava, ou deveria funcionar, e não funciona.' },
  { value: 'improvement', label: 'Melhoria', help: 'Funciona, mas pode ficar melhor.' },
  { value: 'feature', label: 'Nova funcionalidade', help: 'Algo que ainda não existe.' },
  { value: 'question', label: 'Dúvida', help: 'Precisa de orientação, não de mudança.' },
] as const;

/** Rótulos dos estados. O vocabulário é do servidor; aqui só a tradução para a tela. */
export const ESTADOS: Record<string, string> = {
  open: 'Aberto',
  in_analysis: 'Em análise',
  in_execution: 'Em execução',
  waiting_requester: 'Aguardando você',
  resolved: 'Resolvido',
  closed: 'Encerrado',
  cancelled: 'Cancelado',
};

export const PRIORIDADES: Record<string, string> = {
  low: 'Baixa', normal: 'Normal', high: 'Alta', critical: 'Crítica',
};

export type SupportAttachment = { id: string; name: string; size: number; type: string };

export type SupportTicketRow = {
  id: string;
  protocol: string;
  /** Nome do cliente — a fila de triagem mistura clientes e precisa ser inequívoca. */
  client?: string | null;
  requester?: string;
  subject: string;
  nature: string;
  state: string;
  priority: string;
  team: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportCapabilities = {
  canView: boolean;
  isRequester: boolean;
  isTriage: boolean;
  isTeamMember: boolean;
  isAssignee: boolean;
  canReadInternal: boolean;
  canManageTeams: boolean;
};

export type SupportTotals = {
  /** `null` = sem proposta ("Sem estimativa"), nunca zero. */
  estimatedMinutes: number | null;
  executedMinutes: number;
  billableMinutes: number;
};

export type SupportTicketDetail = SupportTicketRow & {
  /** Versão (xmin) — devolvida em `expectedVersion` nas mutações. */
  version: number;
  totals: SupportTotals;
  /** Responsável pelo chamado. */
  owner: string | null;
  /** Transições que ESTE usuário pode pedir agora (calculadas no servidor pela tabela SUP-03). */
  actions: string[];
  description: string;
  impact: string | null;
  requester: string;
  attachments: SupportAttachment[];
  capabilities: SupportCapabilities | null;
  resolvedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  /** Quando o encerramento automático vai acontecer (só em Resolvido) — calculado no servidor. */
  autoCloseAt: string | null;
  /** Verdadeiro quando a resposta DESTE usuário reabre o chamado (requisitante, em Resolvido/Encerrado). */
  replyReopens: boolean;
  /** Arquivos que o servidor recusou vincular — a tela precisa dizer quais. */
  rejectedFiles?: string[];
};

export type SupportMessageItem = {
  id: string;
  visibility: 'public' | 'internal';
  organization: string;
  author: string;
  body: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  attachments: SupportAttachment[];
};

export type SupportEventItem = {
  id: string;
  type: string;
  visibility: string;
  organization: string;
  author: string;
  summary: string | null;
  reason: string | null;
  fromState: string | null;
  toState: string | null;
  at: string;
};

export type SupportTicketFilters = {
  state?: string;
  nature?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  /** Recorte: mine | team | triage. Só estreita o que o servidor já deixa ver. */
  scope?: 'mine' | 'team' | 'triage';
  priority?: string;
  ownerId?: string;
};

const caminhoChamados = (escopo: SupportScope, resto = '') =>
  escopo === 'septem' ? `/support/tickets${resto}` : `/api/v1/support/tickets${resto}`;

function chavesDeChamado(base: readonly unknown[]) {
  return {
    lista: (f: SupportTicketFilters) => [...base, 'tickets', f] as const,
    detalhe: (id: string) => [...base, 'ticket', id] as const,
    mensagens: (id: string) => [...base, 'ticket', id, 'messages'] as const,
    historico: (id: string) => [...base, 'ticket', id, 'timeline'] as const,
  };
}

/** As chaves de chamado herdam tenant + usuário + escopo das chaves de equipe. */
export function useTicketKeys(escopo: SupportScope) {
  const { teams } = useSupportKeys(escopo);
  return chavesDeChamado(teams.slice(0, -1));
}

export function useSupportTickets(escopo: SupportScope, filtros: SupportTicketFilters) {
  const keys = useTicketKeys(escopo);
  return useQuery({
    queryKey: keys.lista(filtros),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filtros.state) qs.set('state', filtros.state);
      if (filtros.nature) qs.set('nature', filtros.nature);
      if (filtros.q?.trim()) qs.set('q', filtros.q.trim());
      if (filtros.scope) qs.set('scope', filtros.scope);
      if (filtros.priority) qs.set('priority', filtros.priority);
      if (filtros.ownerId) qs.set('ownerId', filtros.ownerId);
      qs.set('page', String(filtros.page ?? 1));
      qs.set('pageSize', String(filtros.pageSize ?? 25));
      return cliente(escopo).get<{ items: SupportTicketRow[]; total: number; page: number; pageSize: number }>(
        `${caminhoChamados(escopo)}?${qs.toString()}`,
      );
    },
  });
}

export function useSupportTicket(escopo: SupportScope, id: string | undefined) {
  const keys = useTicketKeys(escopo);
  return useQuery({
    queryKey: keys.detalhe(id ?? ''),
    queryFn: () => cliente(escopo).get<SupportTicketDetail>(caminhoChamados(escopo, `/${id}`)),
    enabled: !!id,
  });
}

export function useSupportMessages(escopo: SupportScope, id: string | undefined) {
  const keys = useTicketKeys(escopo);
  return useQuery({
    queryKey: keys.mensagens(id ?? ''),
    queryFn: () => cliente(escopo).get<{ items: SupportMessageItem[]; total: number }>(
      caminhoChamados(escopo, `/${id}/messages?pageSize=100`),
    ),
    enabled: !!id,
  });
}

export function useSupportTimeline(escopo: SupportScope, id: string | undefined) {
  const keys = useTicketKeys(escopo);
  return useQuery({
    queryKey: keys.historico(id ?? ''),
    queryFn: () => cliente(escopo).get<{ items: SupportEventItem[]; total: number }>(
      caminhoChamados(escopo, `/${id}/timeline?pageSize=100`),
    ),
    enabled: !!id,
  });
}

/**
 * Sobe UM arquivo e devolve o id temporário. Um por chamada de propósito: é assim que a tela
 * mostra progresso e falha **por arquivo**, em vez de perder o lote inteiro por causa de um.
 */
export async function subirArquivoDeSuporte(escopo: SupportScope, file: File): Promise<SupportAttachment> {
  const form = new FormData();
  form.append('file', file);
  const path = escopo === 'septem' ? '/support/uploads' : '/api/v1/support/uploads';
  return escopo === 'septem'
    ? platformApi.postForm<SupportAttachment>(path, form)
    : api.postForm<SupportAttachment>(path, form);
}

/**
 * Chave de idempotência **do conteúdo**, não da tentativa.
 *
 * <p>
 * É a segunda camada contra duplicata, independente da trava da tela. A semântica importa: uma
 * chave nova por requisição não protege nada — dois envios do MESMO conteúdo levariam chaves
 * diferentes e o servidor abriria dois chamados (foi o que a sabotagem mostrou aqui). A chave é
 * amarrada ao conteúdo: mesmo conteúdo reenviado → mesma chave → o servidor devolve o mesmo
 * chamado; conteúdo editado → chave nova → envio aceito, em vez do 409 que o reúso cego causaria.
 * </p>
 */
function criarChaveador() {
  let assinatura: string | null = null;
  let chave = novoId();
  return (conteudo: unknown) => {
    const atual = JSON.stringify(conteudo ?? null);
    if (atual !== assinatura) {
      assinatura = atual;
      chave = novoId();
    }
    return chave;
  };
}

export function useAbrirChamado(escopo: SupportScope) {
  const qc = useQueryClient();
  const keys = useTicketKeys(escopo);
  const chaveDe = useMemo(criarChaveador, []);
  return useMutation({
    mutationFn: (body: { subject: string; description: string; nature: string; impact?: string; fileIds?: string[] }) =>
      cliente(escopo).post<SupportTicketDetail>(caminhoChamados(escopo), body,
        { headers: { 'Idempotency-Key': chaveDe(body) } }),
    // Abrir muda a LISTA; o detalhe nasce da resposta. Invalidar por prefixo evita esquecer
    // um filtro qualquer que esteja em cache.
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.lista({}).slice(0, -1) }),
  });
}

export function useEnviarMensagem(escopo: SupportScope, ticketId: string) {
  const qc = useQueryClient();
  const keys = useTicketKeys(escopo);
  const chaveDe = useMemo(criarChaveador, []);
  return useMutation({
    mutationFn: (body: { body?: string; internal?: boolean; fileIds?: string[] }) =>
      cliente(escopo).post<SupportMessageItem>(caminhoChamados(escopo, `/${ticketId}/messages`), body,
        { headers: { 'Idempotency-Key': chaveDe(body) } }),
    // Depois de cada comando: detalhe, mensagens, histórico e listas. A lista importa porque a
    // ordenação é por última movimentação — sem invalidar, o chamado fica no lugar antigo.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.detalhe(ticketId) });
      void qc.invalidateQueries({ queryKey: keys.mensagens(ticketId) });
      void qc.invalidateQueries({ queryKey: keys.historico(ticketId) });
      void qc.invalidateQueries({ queryKey: keys.lista({}).slice(0, -1) });
    },
  });
}

export function useEditarMensagem(escopo: SupportScope, ticketId: string) {
  const qc = useQueryClient();
  const keys = useTicketKeys(escopo);
  return useMutation({
    mutationFn: ({ messageId, body, expectedRevision }: { messageId: string; body: string; expectedRevision: number }) =>
      cliente(escopo).patch<SupportMessageItem>(
        caminhoChamados(escopo, `/${ticketId}/messages/${messageId}`), { body, expectedRevision }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.mensagens(ticketId) });
      void qc.invalidateQueries({ queryKey: keys.historico(ticketId) });
    },
  });
}

export function useRevisoesDaMensagem(escopo: SupportScope, ticketId: string, messageId: string | null) {
  const keys = useTicketKeys(escopo);
  return useQuery({
    queryKey: [...keys.mensagens(ticketId), messageId, 'revisions'],
    queryFn: () => cliente(escopo).get<{ revision: number; body: string; editedBy: string; editedAt: string }[]>(
      caminhoChamados(escopo, `/${ticketId}/messages/${messageId}/revisions`)),
    enabled: !!messageId,
  });
}

export function useRemoverAnexo(escopo: SupportScope, ticketId: string) {
  const qc = useQueryClient();
  const keys = useTicketKeys(escopo);
  const prefixo = escopo === 'septem' ? '/support/attachments' : '/api/v1/support/attachments';
  return useMutation({
    mutationFn: (fileId: string) => cliente(escopo).del<void>(`${prefixo}/${fileId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.detalhe(ticketId) });
      void qc.invalidateQueries({ queryKey: keys.mensagens(ticketId) });
    },
  });
}

/** URL de download do anexo — o backend autoriza pelo chamado, não pelo arquivo. */
export function urlDoAnexo(escopo: SupportScope, fileId: string) {
  return escopo === 'septem' ? `/support/attachments/${fileId}` : `/api/v1/support/attachments/${fileId}`;
}


// ── Atendimento (Fase 5) ────────────────────────────────────────────────────────

export const CATEGORIAS = [
  { value: 'triage', label: 'Triagem' },
  { value: 'requirements', label: 'Requisitos' },
  { value: 'development', label: 'Desenvolvimento' },
  { value: 'other', label: 'Outra' },
] as const;

export const STATUS_TAREFA: Record<string, string> = {
  pending: 'Pendente', in_progress: 'Em execução', completed: 'Concluída', cancelled: 'Cancelada',
};

export type SupportTask = {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  assignee: string | null;
  organization: string;
  category: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  cancelReason: string | null;
  pendingWorkLog: boolean;
  version: number;
  /** O que ESTE usuário pode fazer nesta tarefa — decidido pelo servidor. */
  canStart: boolean;
  canComplete: boolean;
  canCancel: boolean;
  canEdit: boolean;
  /** Registrar o trabalho feito antes do cancelamento (SUP-06) — só o responsável, só com pendência. */
  canLogResidual: boolean;
  /** Solicitação de aprovação que trava esta tarefa (SUP-05: "bloqueio com link à solicitação"). */
  blockedBy: { approvalId: string; kind: string; status: string; revision: number } | null;
};

export type SupportWorkLog = {
  id: string;
  /** Só o autor corrige — o servidor diz quem é. */
  canCorrect: boolean;
  author: string;
  organization: string;
  category: string;
  durationMinutes: number;
  duration: string;
  activityDescription: string;
  zeroReason: string | null;
  performedAt: string;
  billable: boolean;
  billingReason: string;
  revision: number;
  correctionReason: string | null;
};

/** Duração em horas e minutos — guardada em minutos inteiros (SUP-06). */
export function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Tudo o que muda o chamado invalida o mesmo conjunto: detalhe, histórico, tarefas, apontamentos e listas. */
function useInvalidarChamado(escopo: SupportScope, ticketId: string) {
  const qc = useQueryClient();
  const keys = useTicketKeys(escopo);
  return () => {
    void qc.invalidateQueries({ queryKey: keys.detalhe(ticketId) });
    void qc.invalidateQueries({ queryKey: keys.historico(ticketId) });
    void qc.invalidateQueries({ queryKey: keys.mensagens(ticketId) });
    void qc.invalidateQueries({ queryKey: [...keys.detalhe(ticketId), 'tasks'] });
    void qc.invalidateQueries({ queryKey: [...keys.detalhe(ticketId), 'work-logs'] });
    void qc.invalidateQueries({ queryKey: [...keys.detalhe(ticketId), 'approvals'] });
    void qc.invalidateQueries({ queryKey: keys.lista({}).slice(0, -1) });
  };
}

export function useTarefas(escopo: SupportScope, ticketId: string, habilitado: boolean) {
  const keys = useTicketKeys(escopo);
  return useQuery({
    queryKey: [...keys.detalhe(ticketId), 'tasks'],
    queryFn: () => cliente(escopo).get<SupportTask[]>(caminhoChamados(escopo, `/${ticketId}/tasks`)),
    enabled: habilitado,
  });
}

export function useApontamentos(escopo: SupportScope, ticketId: string) {
  const keys = useTicketKeys(escopo);
  return useQuery({
    queryKey: [...keys.detalhe(ticketId), 'work-logs'],
    queryFn: () => cliente(escopo).get<{ items: SupportWorkLog[]; totals: SupportTotals }>(
      caminhoChamados(escopo, `/${ticketId}/work-logs`)),
    enabled: !!ticketId,
  });
}

/** Comando de atendimento genérico: POST/PATCH num sub-caminho do chamado, invalidando tudo. */
export function useComandoDoChamado<TBody>(
  escopo: SupportScope, ticketId: string, metodo: 'post' | 'patch', sub: string | ((b: TBody) => string),
) {
  const invalidar = useInvalidarChamado(escopo, ticketId);
  return useMutation({
    mutationFn: (body: TBody) => {
      const caminho = caminhoChamados(escopo, `/${ticketId}${typeof sub === 'function' ? sub(body) : sub}`);
      return metodo === 'post' ? cliente(escopo).post<unknown>(caminho, body) : cliente(escopo).patch<unknown>(caminho, body);
    },
    onSuccess: invalidar,
  });
}

/** Membros elegíveis de uma equipe, para escolher responsável (lista de equipes já traz os membros). */
export function useEquipesElegiveis(escopo: SupportScope) {
  return useSupportTeams(escopo);
}


// ── Aprovações (Fase 6) ─────────────────────────────────────────────────────────

export type SupportApprovalVersion = {
  id: string;
  groupId: string;
  kind: 'proposal' | 'solution';
  revision: number;
  description: string;
  estimatedMinutes: number | null;
  scope: 'ticket' | 'tasks';
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'superseded';
  blocksWork: boolean;
  author: string;
  createdAt: string;
  submittedBy: string | null;
  submittedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  attachments: SupportAttachment[];
  version: number;
};

export const STATUS_APROVACAO: Record<string, string> = {
  draft: 'Rascunho', pending: 'Aguardando aprovação', approved: 'Aprovada', rejected: 'Rejeitada', superseded: 'Substituída',
};

export function useAprovacoes(escopo: SupportScope, ticketId: string) {
  const keys = useTicketKeys(escopo);
  return useQuery({
    queryKey: [...keys.detalhe(ticketId), 'approvals'],
    queryFn: () => cliente(escopo).get<SupportApprovalVersion[]>(caminhoChamados(escopo, `/${ticketId}/approvals`)),
    enabled: !!ticketId,
  });
}

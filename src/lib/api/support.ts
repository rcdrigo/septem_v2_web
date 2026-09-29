import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { platformApi } from '@/lib/platform-api';
import { useSessionStore } from '@/stores/session';
import { usePlatformSession } from '@/stores/platform-session';

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
  clientId: number | null;
  name: string;
  description: string | null;
  active: boolean;
  members: SupportTeamMember[];
};

export type SupportTeamWrite = {
  name?: string;
  description?: string | null;
  active?: boolean;
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
  const tenantId = useSessionStore((s) => s.tenant?.tenantId ?? 'sem-tenant');
  const usuarioId = useSessionStore((s) => s.user?.id ?? 'anonimo');
  const identidadeId = usePlatformSession((s) => s.identity?.id ?? 'anonimo');
  const quem = escopo === 'septem' ? `central:${identidadeId}` : `${tenantId}:${usuarioId}`;
  return { teams: ['support', escopo, quem, 'teams'] as const };
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
      if (escopo === 'septem') return platformApi.get<SupportCandidate[]>('/support/identities');
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

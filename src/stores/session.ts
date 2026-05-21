import { create } from 'zustand';

/**
 * Sessão do usuário logado + contexto de navegação.
 *
 * Hoje é MOCK — substituir por dados de `GET /api/v1/me` + `/api/tenant/config`
 * quando a Fase 2 (auth/tenant) existir. A forma do `SessionUser` já antecipa o
 * que o backend vai devolver (nome, perms[], flags), então o restante do app pode
 * consumir `useSessionStore` sem saber que ainda é mock.
 */

export type AccessMode = 'interno' | 'externo';

export type SessionUser = {
  name: string;
  email: string;
  /** Funcionário interno pode alternar entre layout interno e externo.
   *  Usuário externo (auto-cadastro) fica travado no layout externo. */
  isInternal: boolean;
  /** Permissões efetivas. `*` = tudo (admin). Dirige a visibilidade do menu. */
  perms: string[];
  /** Dashboard só aparece no menu se o usuário tiver um configurado. */
  hasDashboard: boolean;
};

export type Tenant = {
  name: string;
  /** URL do logo do cliente (branding). Quando ausente, usa-se o nome. */
  logoUrl?: string;
};

export type SessionState = {
  user: SessionUser;
  tenant: Tenant;
  accessMode: AccessMode;
  setAccessMode: (mode: AccessMode) => void;
  /** Modo efetivo: externo é forçado para quem não é interno. */
  effectiveMode: () => AccessMode;
  /** Checa permissão; sem `perm` informado, sempre libera. */
  can: (perm?: string) => boolean;
};

// --- MOCK (remover na Fase 2) -------------------------------------------------
const MOCK_USER: SessionUser = {
  name: 'Rodrigo Araújo',
  email: 'rodrigo@prefeitura.gov.br',
  isInternal: true,
  hasDashboard: true,
  perms: ['*'],
};

const MOCK_TENANT: Tenant = {
  name: 'Prefeitura de Exemplo',
};
// -----------------------------------------------------------------------------

export const useSessionStore = create<SessionState>((set, get) => ({
  user: MOCK_USER,
  tenant: MOCK_TENANT,
  accessMode: 'interno',
  setAccessMode: (mode) => set({ accessMode: mode }),
  effectiveMode: () => (get().user.isInternal ? get().accessMode : 'externo'),
  can: (perm) => {
    if (!perm) return true;
    const { perms } = get().user;
    return perms.includes('*') || perms.includes(perm);
  },
}));

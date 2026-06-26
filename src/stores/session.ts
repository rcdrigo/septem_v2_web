import { create } from 'zustand';
import { api, configureApi } from '@/lib/api';

/**
 * Sessão real do app — substitui o mock anterior do B0/B1 do frontend.
 * Tokens persistidos em <c>localStorage</c> sobrevivem a F5; `bootstrap()`
 * é chamado no AppShell e popula tenant + user a partir do backend.
 */

export type AccessMode = 'interno' | 'externo';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  isInternal: boolean;
  perms: string[];
  hasDashboard: boolean;
  accessProfiles: { id: string; name: string }[];
  /** Nome do ator real quando esta sessão é personificada. */
  impersonatedBy?: string | null;
};

export type Tenant = {
  tenantId: string;
  clienteNome: string;
  ambienteNome: string;
  logoUrl?: string;
  primaryColor: string;
  modulos: string[];
};

export type SessionStatus = 'idle' | 'booting' | 'unauthenticated' | 'authenticated' | 'error';

type SessionState = {
  status: SessionStatus;
  error?: string;
  user: SessionUser | null;
  tenant: Tenant | null;
  accessToken: string | null;
  refreshToken: string | null;
  accessMode: AccessMode;
  /** Sessão atual é uma personificação (admin agindo como outro usuário). */
  isImpersonating: boolean;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  impersonate: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  refresh: () => Promise<string | null>;
  logout: () => Promise<void>;
  setAccessMode: (mode: AccessMode) => void;
  effectiveMode: () => AccessMode;
  can: (perm?: string) => boolean;
};

const ACCESS_KEY = 'septem.accessToken';
const REFRESH_KEY = 'septem.refreshToken';

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};

type MeResponse = {
  id: string;
  name: string;
  email: string;
  isInternal: boolean;
  hasDashboard: boolean;
  perms: string[];
  accessProfiles: { id: string; name: string }[];
  impersonatedBy?: string | null;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'idle',
  user: null,
  tenant: null,
  accessToken: localStorage.getItem(ACCESS_KEY),
  refreshToken: localStorage.getItem(REFRESH_KEY),
  accessMode: 'interno',
  isImpersonating: false,

  bootstrap: async () => {
    set({ status: 'booting', error: undefined });
    try {
      // /tenant/config é não-autenticado — sempre tenta.
      const tenant = await api.get<Tenant>('/api/tenant/config', { anonymous: true });
      if (!get().accessToken) {
        set({ status: 'unauthenticated', tenant });
        return;
      }
      const user = await api.get<MeResponse>('/api/v1/me');
      set({ status: 'authenticated', tenant, user, isImpersonating: !!user.impersonatedBy });
    } catch (err) {
      // Token expirado / inválido sem refresh válido → cai pra unauthenticated.
      const tenant = get().tenant;
      set({ status: tenant ? 'unauthenticated' : 'error', error: (err as Error).message });
    }
  },

  login: async (email, password) => {
    const tokens = await api.post<TokenResponse>('/api/v1/auth/login', { email, password }, { anonymous: true });
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

    const user = await api.get<MeResponse>('/api/v1/me');
    set({ status: 'authenticated', user });
  },

  impersonate: async (userId) => {
    const tokens = await api.post<TokenResponse>(`/api/v1/impersonate/${userId}`);
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

    const user = await api.get<MeResponse>('/api/v1/me');
    set({ status: 'authenticated', user, isImpersonating: true });
  },

  stopImpersonation: async () => {
    const tokens = await api.post<TokenResponse>('/api/v1/impersonate/stop');
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    const user = await api.get<MeResponse>('/api/v1/me');
    set({ status: 'authenticated', user, isImpersonating: false });
  },

  refresh: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) return null;
    try {
      const tokens = await api.post<TokenResponse>('/api/v1/auth/refresh', { refreshToken }, { anonymous: true, skipRefresh: true });
      localStorage.setItem(ACCESS_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
      set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      return tokens.accessToken;
    } catch {
      return null;
    }
  },

  logout: async () => {
    const refreshToken = get().refreshToken;
    try {
      if (refreshToken)
        await api.post('/api/v1/auth/logout', { refreshToken }, { anonymous: true, skipRefresh: true });
    } catch {
      // best-effort
    }
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null, refreshToken: null, user: null, status: 'unauthenticated', isImpersonating: false });
  },

  setAccessMode: (mode) => set({ accessMode: mode }),
  effectiveMode: () => (get().user?.isInternal ? get().accessMode : 'externo'),
  can: (perm) => {
    if (!perm) return true;
    const perms = get().user?.perms ?? [];
    return perms.includes('*') || perms.includes(perm);
  },
}));

// Liga o api.ts à store para token + refresh + logout (quebra ciclo de import).
configureApi({
  getAccessToken: () => useSessionStore.getState().accessToken,
  refresh: () => useSessionStore.getState().refresh(),
  logout: () => useSessionStore.getState().logout(),
});

/** Para componentes que ainda precisam do tipo legado (compatibilidade). */
export type { SessionState };

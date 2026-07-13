import { create } from 'zustand';
import { applyTenantMeta } from '@/lib/tenant-meta';
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
  /** Campos editáveis em Meus dados (Fase 2). */
  cpf?: string | null;
  matricula?: string | null;
  telefone?: string | null;
  photoUrl?: string | null;
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
  /** Imagem de destaque da tela de login (Parâmetros › Informações gerais). */
  heroImageUrl?: string | null;
  /** Texto de apresentação exibido na tela de login. */
  systemDescription?: string | null;
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
  /** Recarrega o branding do tenant (usado após salvar Parâmetros › Informações gerais). */
  refreshTenant: () => Promise<void>;
  /**
   * Login por e-mail OU CPF. Devolve 'ok' (entrou) ou 'two-factor' (o backend
   * mandou um código por e-mail e espera a 2ª etapa em `completeTwoFactor`).
   */
  login: (identifier: string, password: string, keepConnected?: boolean) => Promise<LoginOutcome>;
  /** 2ª etapa do login com 2FA: código do e-mail (+ confiar neste dispositivo). */
  completeTwoFactor: (identifier: string, code: string, trustDevice: boolean, keepConnected?: boolean) => Promise<void>;
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
const TENANT_KEY = 'septem.tenant';
/** Dispositivo confiável (2FA): enviado no login para pular o desafio. */
const DEVICE_KEY = 'septem.deviceToken';

export type LoginOutcome = { kind: 'ok' } | { kind: 'two-factor'; maskedEmail: string };
type TwoFactorChallenge = { twoFactorRequired: true; identifier: string; maskedEmail: string };

/** Branding do tenant cacheado — evita o "flash" de fallback (Septem V2 →
 *  Prefeitura X) a cada carga enquanto o /tenant/config responde. O bootstrap
 *  sempre sobrescreve com o valor fresco. */
function readCachedTenant(): Tenant | null {
  try {
    const raw = localStorage.getItem(TENANT_KEY);
    return raw ? (JSON.parse(raw) as Tenant) : null;
  } catch {
    return null;
  }
}
function cacheTenant(t: Tenant) {
  applyTenantMeta(t);   // OG tags saem dos Parâmetros do sistema (Fase 1)
  try { localStorage.setItem(TENANT_KEY, JSON.stringify(t)); } catch { /* storage cheio */ }
}

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  /** Só vem quando o usuário marca "confiar neste dispositivo" no 2FA. */
  deviceToken?: string | null;
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

/**
 * Guarda os tokens e conclui a sessão. "Manter-me conectado" = guardar o refresh
 * token (a sessão se renova sozinha). Desmarcado: sem refresh — quando o access
 * expirar, pede login de novo. (Não usamos sessionStorage: as abas standalone —
 * modelador/tarefa/serviço — compartilham o token entre abas via localStorage.)
 */
async function applyTokens(
  set: (partial: Partial<SessionState>) => void,
  tokens: TokenResponse,
  keepConnected: boolean,
) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  if (keepConnected) localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
  set({ accessToken: tokens.accessToken, refreshToken: keepConnected ? tokens.refreshToken : null });

  const user = await api.get<MeResponse>('/api/v1/me');
  set({ status: 'authenticated', user });
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'idle',
  user: null,
  tenant: readCachedTenant(),
  accessToken: localStorage.getItem(ACCESS_KEY),
  refreshToken: localStorage.getItem(REFRESH_KEY),
  accessMode: 'interno',
  isImpersonating: false,

  bootstrap: async () => {
    set({ status: 'booting', error: undefined });
    try {
      // /tenant/config é não-autenticado — sempre tenta.
      const tenant = await api.get<Tenant>('/api/tenant/config', { anonymous: true });
      cacheTenant(tenant);
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

  refreshTenant: async () => {
    const tenant = await api.get<Tenant>('/api/tenant/config', { anonymous: true });
    cacheTenant(tenant);
    set({ tenant });
  },

  login: async (identifier, password, keepConnected = true) => {
    const res = await api.post<TokenResponse | TwoFactorChallenge>(
      '/api/v1/auth/login',
      // O deviceToken é o "dispositivo confiável": com ele, o backend pula o 2FA.
      { identifier, password, deviceToken: localStorage.getItem(DEVICE_KEY) },
      { anonymous: true },
    );

    if ('twoFactorRequired' in res) {
      return { kind: 'two-factor', maskedEmail: res.maskedEmail };
    }

    await applyTokens(set, res, keepConnected);
    return { kind: 'ok' };
  },

  completeTwoFactor: async (identifier, code, trustDevice, keepConnected = true) => {
    const tokens = await api.post<TokenResponse>(
      '/api/v1/auth/2fa',
      { identifier, code, trustDevice },
      { anonymous: true },
    );
    // O token do dispositivo confiável fica no navegador; no servidor só o hash.
    if (tokens.deviceToken) localStorage.setItem(DEVICE_KEY, tokens.deviceToken);
    await applyTokens(set, tokens, keepConnected);
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

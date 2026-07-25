import { create } from 'zustand';
import { applyTenantMeta } from '@/lib/tenant-meta';
import { api, configureApi } from '@/lib/api';

/**
 * Sessão real do app.
 *
 * Fase 11: a sessão vive em COOKIE httpOnly (o token nunca aparece no JS). O BFF
 * injeta o estado inicial em `window.__BOOTSTRAP__` (tenant + me) no HTML servido,
 * então `/tenant/config` e `/me` NÃO saem do navegador na carga da página. Login/
 * logout/refresh continuam sendo chamadas normais — quem move os tokens para
 * cookie e injeta `Authorization`/`X-Tenant` é o BFF.
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

const TENANT_KEY = 'septem.tenant';

export type LoginOutcome = { kind: 'ok' } | { kind: 'two-factor'; maskedEmail: string };
type TwoFactorChallenge = { twoFactorRequired: true; identifier: string; maskedEmail: string };

type MeResponse = {
  id: string;
  name: string;
  email: string;
  isInternal: boolean;
  hasDashboard: boolean;
  perms: string[];
  accessProfiles: { id: string; name: string }[];
  impersonatedBy?: string | null;
  cpf?: string | null;
  matricula?: string | null;
  telefone?: string | null;
  photoUrl?: string | null;
};

type BootstrapData = { tenant: Tenant | null; me: MeResponse | null };

/** Estado inicial injetado pelo BFF no HTML (uma vez por carga de página). */
function peekBootstrap(): BootstrapData | null {
  if (typeof window === 'undefined') return null;
  const raw = (window as unknown as { __BOOTSTRAP__?: BootstrapData }).__BOOTSTRAP__;
  if (!raw) return null;
  return { tenant: raw.tenant ?? null, me: raw.me ?? null };
}
function consumeBootstrap(): BootstrapData | null {
  const b = peekBootstrap();
  try {
    delete (window as unknown as { __BOOTSTRAP__?: BootstrapData }).__BOOTSTRAP__;
  } catch {
    /* ignore */
  }
  return b;
}

/** Branding do tenant cacheado — evita o "flash" de fallback a cada carga. */
function readCachedTenant(): Tenant | null {
  try {
    const raw = localStorage.getItem(TENANT_KEY);
    if (!raw) return null;
    const tenant = JSON.parse(raw) as Tenant;
    applyTenantMeta(tenant);
    return tenant;
  } catch {
    return null;
  }
}
function cacheTenant(t: Tenant) {
  applyTenantMeta(t); // OG tags saem dos Parâmetros do sistema (Fase 1)
  try {
    localStorage.setItem(TENANT_KEY, JSON.stringify(t));
  } catch {
    /* storage cheio */
  }
}

const initialBoot = peekBootstrap();
// Com SSR o status já nasce resolvido (não 'idle'), então componentes que só
// chamam bootstrap() em 'idle' não rodam — persistimos o tenant injetado aqui
// mesmo (aplica meta + grava no localStorage), evitando qualquer flash.
if (initialBoot?.tenant) cacheTenant(initialBoot.tenant);
const initialTenant = initialBoot?.tenant ?? readCachedTenant();

export const useSessionStore = create<SessionState>((set, get) => ({
  status: initialBoot ? (initialBoot.me ? 'authenticated' : 'unauthenticated') : 'idle',
  user: initialBoot?.me ?? null,
  tenant: initialTenant,
  accessMode: 'interno',
  isImpersonating: !!initialBoot?.me?.impersonatedBy,

  bootstrap: async () => {
    // 1) Estado injetado pelo BFF (nada sai do browser). Consome uma vez.
    const boot = consumeBootstrap();
    if (boot) {
      if (boot.tenant) cacheTenant(boot.tenant);
      set({
        status: boot.me ? 'authenticated' : 'unauthenticated',
        tenant: boot.tenant ?? get().tenant,
        user: boot.me,
        isImpersonating: !!boot.me?.impersonatedBy,
        error: undefined,
      });
      return;
    }

    // 2) Sem injeção fresca (re-bootstrap após ação, ou navegação client-only):
    //    busca do backend via BFF (cookie carrega a sessão).
    set({ status: 'booting', error: undefined });
    try {
      let tenant = get().tenant;
      if (!tenant) tenant = await api.get<Tenant>('/api/tenant/config', { anonymous: true });
      cacheTenant(tenant);
      try {
        // anonymous: um 401 aqui não deve deslogar — apenas indica "sem sessão".
        const user = await api.get<MeResponse>('/api/v1/me', { anonymous: true });
        set({ status: 'authenticated', tenant, user, isImpersonating: !!user.impersonatedBy });
      } catch {
        set({ status: 'unauthenticated', tenant, user: null });
      }
    } catch (err) {
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
    const res = await api.post<TwoFactorChallenge | { user: MeResponse }>(
      '/api/v1/auth/login',
      { identifier, password, keepConnected },
      { anonymous: true },
    );
    if (res && 'twoFactorRequired' in res) {
      return { kind: 'two-factor', maskedEmail: (res as TwoFactorChallenge).maskedEmail };
    }
    // O BFF gravou a sessão em cookie E já devolveu o /me — nada de /me no browser.
    const user = (res as { user: MeResponse }).user;
    set({ status: 'authenticated', user, isImpersonating: !!user.impersonatedBy });
    return { kind: 'ok' };
  },

  completeTwoFactor: async (identifier, code, trustDevice, keepConnected = true) => {
    const res = await api.post<{ user: MeResponse }>('/api/v1/auth/2fa', { identifier, code, trustDevice, keepConnected }, { anonymous: true });
    set({ status: 'authenticated', user: res.user, isImpersonating: !!res.user.impersonatedBy });
  },

  impersonate: async (userId) => {
    const res = await api.post<{ user: MeResponse }>(`/api/v1/impersonate/${userId}`);
    set({ status: 'authenticated', user: res.user, isImpersonating: true });
  },

  stopImpersonation: async () => {
    const res = await api.post<{ user: MeResponse }>('/api/v1/impersonate/stop');
    set({ status: 'authenticated', user: res.user, isImpersonating: false });
  },

  refresh: async () => {
    // O refresh real é do BFF (cookie). Aqui só pedimos a rotação.
    try {
      await api.post('/api/v1/auth/refresh', {}, { anonymous: true, skipRefresh: true });
      return 'ok';
    } catch {
      return null;
    }
  },

  logout: async () => {
    try {
      await api.post('/api/v1/auth/logout', {}, { anonymous: true });
    } catch {
      // best-effort — o BFF limpa os cookies de qualquer forma.
    }
    set({ user: null, status: 'unauthenticated', isImpersonating: false });
  },

  setAccessMode: (mode) => set({ accessMode: mode }),
  effectiveMode: () => (get().user?.isInternal ? get().accessMode : 'externo'),
  can: (perm) => {
    if (!perm) return true;
    const perms = get().user?.perms ?? [];
    return perms.includes('*') || perms.includes(perm);
  },
}));

// Liga o api.ts à store para deslogar quando a sessão morre (401 real).
configureApi({
  refresh: () => useSessionStore.getState().refresh(),
  logout: () => useSessionStore.getState().logout(),
});

/** Para componentes que ainda precisam do tipo legado (compatibilidade). */
export type { SessionState };

import { ApiError, MFA_REAUTHENTICATION_REQUIRED } from '@/lib/api';
import { create } from 'zustand';
import { configurePlatformApi, platformApi } from '@/lib/platform-api';

/**
 * Sessão da ÁREA CENTRAL (equipe da Septem). Espelha `session.ts`, com três
 * diferenças que não são cosméticas:
 *
 * 1. **Chaves de armazenamento próprias** (`septem.platform.*`). Compartilhar as
 *    chaves com a sessão de ambiente faria uma sobrescrever a outra na mesma aba —
 *    entrar na central deslogaria do ambiente, e vice-versa.
 * 2. MFA obrigatório, com dispositivo confiável por um mês após validar o código.
 * 3. Todo tráfego passa pelo `platform-api`, que jamais envia token de ambiente
 *    nem `X-Tenant`.
 */

const ACCESS_KEY = 'septem.platform.accessToken';
const REFRESH_KEY = 'septem.platform.refreshToken';
const DEVICE_KEY = 'septem.platform.deviceToken';
let refreshInFlight: Promise<string | null> | null = null;

export type PlatformIdentity = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  globalAccess: boolean;
};

export type PlatformStatus = 'idle' | 'booting' | 'unauthenticated' | 'authenticated';

type TokenResponse = {
  deviceToken?: string | null;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};

type PlatformState = {
  status: PlatformStatus;
  reauthenticationRequired: boolean;
  identity: PlatformIdentity | null;
  accessToken: string | null;
  refreshToken: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ maskedEmail: string } | { kind: 'ok' }>;
  /** 2ª etapa: código do e-mail. */
  completeTwoFactor: (email: string, code: string, trustDevice?: boolean) => Promise<void>;
  refresh: (rejectedToken?: string | null) => Promise<string | null>;
  logout: () => Promise<void>;
  /** Papel exigido pela guarda de rota. */
  hasRole: (role: string) => boolean;
};

async function applyTokens(set: (p: Partial<PlatformState>) => void, tokens: TokenResponse) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  const identity = await platformApi.get<PlatformIdentity>('/me');
  set({ status: 'authenticated', identity, reauthenticationRequired: false });
}

export const usePlatformSession = create<PlatformState>((set, get) => ({
  status: 'idle',
  reauthenticationRequired: false,
  identity: null,
  accessToken: localStorage.getItem(ACCESS_KEY),
  refreshToken: localStorage.getItem(REFRESH_KEY),

  bootstrap: async () => {
    if (!get().accessToken) {
      set({ status: 'unauthenticated' });
      return;
    }
    set({ status: 'booting' });
    try {
      const identity = await platformApi.get<PlatformIdentity>('/me');
      set({ status: 'authenticated', identity });
    } catch {
      // Token vencido e sem refresh válido: a área central não tem tela pública,
      // então a saída é sempre o login central.
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      set({ status: 'unauthenticated', accessToken: null, refreshToken: null, identity: null });
    }
  },

  login: async (email, password) => {
    const res = await platformApi.post<TokenResponse | { twoFactorRequired: true; maskedEmail: string }>(
      '/auth/login',
      { email, password, deviceToken: localStorage.getItem(DEVICE_KEY) },
      { anonymous: true },
    );
    if ('twoFactorRequired' in res) return { maskedEmail: res.maskedEmail };
    await applyTokens(set, res);
    return { kind: 'ok' };
  },

  completeTwoFactor: async (email, code, trustDevice = false) => {
    const tokens = await platformApi.post<TokenResponse>('/auth/2fa', { email, code, trustDevice }, { anonymous: true });
    if (tokens.deviceToken) localStorage.setItem(DEVICE_KEY, tokens.deviceToken);
    await applyTokens(set, tokens);
  },

  refresh: (rejectedToken = get().accessToken) => {
    if (refreshInFlight) return refreshInFlight;
    const renew = async (): Promise<string | null> => {
      const accessToken = localStorage.getItem(ACCESS_KEY);
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      set({ accessToken, refreshToken });
      if (accessToken && accessToken !== rejectedToken) return accessToken;
      if (!refreshToken) return null;
      try {
        const tokens = await platformApi.post<TokenResponse>('/auth/refresh', { refreshToken }, { anonymous: true, skipRefresh: true });
        if (localStorage.getItem(REFRESH_KEY) !== refreshToken) return localStorage.getItem(ACCESS_KEY);
        localStorage.setItem(ACCESS_KEY, tokens.accessToken);
        localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
        set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
        return tokens.accessToken;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        const latest = localStorage.getItem(ACCESS_KEY);
        if (latest && latest !== accessToken) {
          set({ accessToken: latest, refreshToken: localStorage.getItem(REFRESH_KEY) });
          return latest;
        }
        if (error.body?.error === MFA_REAUTHENTICATION_REQUIRED && localStorage.getItem(REFRESH_KEY) === refreshToken)
          await requireReauthentication(accessToken);
        return null;
      }
    };
    refreshInFlight = (navigator.locks
      ? navigator.locks.request('septem.platform.session.refresh', renew)
      : renew()).finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    clearSession();
    usePlatformSession.setState({ reauthenticationRequired: false });
    try {
      if (refreshToken) await platformApi.post('/auth/logout', { refreshToken }, { anonymous: true, skipRefresh: true });
    } catch { /* revogação best-effort */ }
  },

  hasRole: (role) => (get().identity?.roles ?? []).includes(role),
}));

function clearSession(rejectedToken?: string | null) {
  const current = localStorage.getItem(ACCESS_KEY);
  if (rejectedToken !== undefined && current && current !== rejectedToken) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  usePlatformSession.setState({ accessToken: null, refreshToken: null, identity: null, status: 'unauthenticated' });
}

async function requireReauthentication(rejectedToken?: string | null) {
  const current = localStorage.getItem(ACCESS_KEY);
  if (current && current !== rejectedToken) return;
  clearSession(rejectedToken);
  localStorage.removeItem(DEVICE_KEY);
  usePlatformSession.setState({ reauthenticationRequired: true });
}

configurePlatformApi({
  getAccessToken: () => usePlatformSession.getState().accessToken,
  refresh: (rejectedToken) => usePlatformSession.getState().refresh(rejectedToken),
  logout: async (rejectedToken) => clearSession(rejectedToken),
  reauthenticate: requireReauthentication,
});

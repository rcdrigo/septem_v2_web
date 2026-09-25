import { create } from 'zustand';
import { configurePlatformApi, platformApi } from '@/lib/platform-api';

/**
 * Sessão da ÁREA CENTRAL (equipe da Septem). Espelha `session.ts`, com três
 * diferenças que não são cosméticas:
 *
 * 1. **Chaves de armazenamento próprias** (`septem.platform.*`). Compartilhar as
 *    chaves com a sessão de ambiente faria uma sobrescrever a outra na mesma aba —
 *    entrar na central deslogaria do ambiente, e vice-versa.
 * 2. **2FA sempre** (Q5): `login()` nunca devolve sessão pronta; devolve o desafio.
 * 3. Todo tráfego passa pelo `platform-api`, que jamais envia token de ambiente
 *    nem `X-Tenant`.
 */

const ACCESS_KEY = 'septem.platform.accessToken';
const REFRESH_KEY = 'septem.platform.refreshToken';

export type PlatformIdentity = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

export type PlatformStatus = 'idle' | 'booting' | 'unauthenticated' | 'authenticated';

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};

type PlatformState = {
  status: PlatformStatus;
  identity: PlatformIdentity | null;
  accessToken: string | null;
  refreshToken: string | null;
  bootstrap: () => Promise<void>;
  /** 1ª etapa: senha. O 2FA é obrigatório, então isto NUNCA autentica sozinho. */
  login: (email: string, password: string) => Promise<{ maskedEmail: string }>;
  /** 2ª etapa: código do e-mail. */
  completeTwoFactor: (email: string, code: string) => Promise<void>;
  refresh: () => Promise<string | null>;
  logout: () => Promise<void>;
  /** Papel exigido pela guarda de rota. */
  hasRole: (role: string) => boolean;
};

async function applyTokens(set: (p: Partial<PlatformState>) => void, tokens: TokenResponse) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  const identity = await platformApi.get<PlatformIdentity>('/me');
  set({ status: 'authenticated', identity });
}

export const usePlatformSession = create<PlatformState>((set, get) => ({
  status: 'idle',
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
    const res = await platformApi.post<{ twoFactorRequired: true; maskedEmail: string }>(
      '/auth/login',
      { email, password },
      { anonymous: true },
    );
    return { maskedEmail: res.maskedEmail };
  },

  completeTwoFactor: async (email, code) => {
    const tokens = await platformApi.post<TokenResponse>('/auth/2fa', { email, code }, { anonymous: true });
    await applyTokens(set, tokens);
  },

  refresh: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) return null;
    try {
      const tokens = await platformApi.post<TokenResponse>(
        '/auth/refresh',
        { refreshToken },
        { anonymous: true, skipRefresh: true },
      );
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
        await platformApi.post('/auth/logout', { refreshToken }, { anonymous: true, skipRefresh: true });
    } catch {
      // best-effort: o token local sai de qualquer jeito
    }
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null, refreshToken: null, identity: null, status: 'unauthenticated' });
  },

  hasRole: (role) => (get().identity?.roles ?? []).includes(role),
}));

configurePlatformApi({
  getAccessToken: () => usePlatformSession.getState().accessToken,
  refresh: () => usePlatformSession.getState().refresh(),
  logout: () => usePlatformSession.getState().logout(),
});

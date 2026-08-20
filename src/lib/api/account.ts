import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Conta do usuário (Fase 2): recuperação de senha, perfil e dispositivos confiáveis. */

export type TrustedDevice = {
  id: number;
  name: string;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

export type Profile = {
  name: string;
  email: string;
  matricula: string | null;
  telefone: string | null;
  photoUrl: string | null;
};

/**
 * Manda o código de redefinição. Responde 200 mesmo se a conta não existir.
 *
 * Pode responder **429** com `retryAfterSeconds` quando já houve um envio no último
 * minuto — a regra é do servidor; a contagem regressiva da tela é só conveniência.
 */
export function forgotPassword(identifier: string) {
  return api.post<{ ok: true; maskedEmail: string | null }>(
    '/api/v1/auth/forgot-password',
    { identifier },
    { anonymous: true },
  );
}

export function resetPassword(identifier: string, code: string, newPassword: string) {
  return api.post('/api/v1/auth/reset-password', { identifier, code, newPassword }, { anonymous: true });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return api.post('/api/v1/me/password', { currentPassword, newPassword });
}

export function useTrustedDevices() {
  return useQuery({ queryKey: ['me', 'devices'], queryFn: () => api.get<TrustedDevice[]>('/api/v1/me/devices') });
}

export function useRemoveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/v1/me/devices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'devices'] }),
  });
}

export function useSaveProfile() {
  return useMutation({ mutationFn: (p: Profile) => api.put('/api/v1/me', p) });
}

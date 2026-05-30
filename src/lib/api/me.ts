import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Troca a senha do usuário logado. O backend revoga todos os refresh tokens. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post<void>('/api/v1/me/password', body),
  });
}

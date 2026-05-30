import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AccessProfile = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
};

export type Permission = { key: string; description: string };

export type AccessProfileWrite = { name: string; description?: string; permissions: string[] };

const profileKeys = { all: ['access-profiles'] as const };

export function useAccessProfiles() {
  return useQuery({
    queryKey: profileKeys.all,
    queryFn: () => api.get<AccessProfile[]>('/api/v1/access-profiles/'),
  });
}

/** Catálogo completo de permissions do tenant (para a matriz dos perfis). */
export function usePermissionsCatalog() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get<Permission[]>('/api/v1/permissions'),
  });
}

export function useCreateAccessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AccessProfileWrite) => api.post<{ id: string }>('/api/v1/access-profiles/', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

export function useUpdateAccessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AccessProfileWrite }) =>
      api.put<void>(`/api/v1/access-profiles/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

export function useDeleteAccessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/v1/access-profiles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.all }),
  });
}

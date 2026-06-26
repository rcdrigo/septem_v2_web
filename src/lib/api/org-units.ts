import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type OrgUnitNode = {
  id: string;
  key: string;
  name: string;
  active: boolean;
  children: OrgUnitNode[];
};

export type OrgUnitFlat = {
  id: string;
  key: string;
  name: string;
  parentId: string | null;
  active: boolean;
  titularUserId?: string | null;
};

const orgKeys = {
  all: ['org-units'] as const,
  tree: ['org-units', 'tree'] as const,
  flat: ['org-units', 'flat'] as const,
};

export function useOrgUnitsTree() {
  return useQuery({ queryKey: orgKeys.tree, queryFn: () => api.get<OrgUnitNode[]>('/api/v1/org-units/tree') });
}

export function useOrgUnitsFlat() {
  return useQuery({ queryKey: orgKeys.flat, queryFn: () => api.get<OrgUnitFlat[]>('/api/v1/org-units/') });
}

export function useCreateOrgUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; name: string; parentId?: string; active?: boolean }) =>
      api.post<{ id: string }>('/api/v1/org-units/', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

export function useUpdateOrgUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; active?: boolean; titularUserId?: string | null } }) =>
      api.put<void>(`/api/v1/org-units/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

export function useDeleteOrgUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/v1/org-units/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

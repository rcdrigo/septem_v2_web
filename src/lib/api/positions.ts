import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type Position = {
  id: string;
  key: string;
  name: string;
  orgUnitId: string;
};

const positionKeys = {
  all: ['positions'] as const,
  byOrg: (orgUnitId: string | null) => ['positions', 'byOrg', orgUnitId ?? 'all'] as const,
};

export function usePositions(orgUnitId: string | null) {
  return useQuery({
    queryKey: positionKeys.byOrg(orgUnitId),
    queryFn: () => api.get<Position[]>(`/api/v1/positions/${orgUnitId ? `?orgUnitId=${orgUnitId}` : ''}`),
    enabled: !!orgUnitId,
  });
}

export function useCreatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; name: string; orgUnitId: string }) =>
      api.post<{ id: string }>('/api/v1/positions/', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: positionKeys.all }),
  });
}

export function useUpdatePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { key: string; name: string; orgUnitId: string } }) =>
      api.put<void>(`/api/v1/positions/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: positionKeys.all }),
  });
}

export function useDeletePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/v1/positions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: positionKeys.all }),
  });
}

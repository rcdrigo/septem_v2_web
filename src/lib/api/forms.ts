import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type FormMask = { id: string; key: string; name: string; regex: string; template?: string | null; shouldValidate: boolean };

const maskKeys = { all: ['form-masks'] as const };

export type NativeFieldUsage = { fieldId: string; label: string; executionCount: number };
/** Fresh check across all versions, including executions with unprojected data. */
export function fetchNativeFieldUsage(processKey: string) {
  return api.get<NativeFieldUsage[]>(`/api/v1/workflow/process-definitions/${encodeURIComponent(processKey)}/field-usage`);
}

export function useFormMasks() {
  return useQuery({ queryKey: maskKeys.all, queryFn: () => api.get<FormMask[]>('/api/v1/form-masks/') });
}
export function useCreateFormMask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { key: string; name: string; regex: string; template?: string; shouldValidate: boolean }) => api.post<{ id: string }>('/api/v1/form-masks/', body), onSuccess: () => qc.invalidateQueries({ queryKey: maskKeys.all }) });
}
export function useUpdateFormMask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, body }: { id: string; body: { name: string; regex: string; template?: string; shouldValidate: boolean } }) => api.put<void>(`/api/v1/form-masks/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: maskKeys.all }) });
}
export function useDeleteFormMask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del<void>(`/api/v1/form-masks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: maskKeys.all }) });
}

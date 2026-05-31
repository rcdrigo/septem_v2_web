import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type FormGroup = {
  key: string; name: string; helpTextType?: string | null; helpText?: string | null; order: number; columns: number;
};

export type FormField = {
  type: string; key: string; name: string; groupKey?: string | null;
  helpTextType?: string | null; helpText?: string | null; prefix?: string | null; suffix?: string | null;
  minLength?: number | null; maxLength?: number | null; order: number; columns: number; width?: number | null;
  maskId?: string | null; dataSourceId?: string | null;
  isRequired: boolean; isVisibleReport: boolean; isVisibleRequester: boolean;
  events?: unknown;
};

export type FormListItem = { id: string; name: string; version: number };
export type FormDetail = { id: string; name: string; version: number; groups: FormGroup[]; fields: FormField[] };
export type FormWrite = { name: string; groups: FormGroup[]; fields: FormField[] };

export type FormMask = { id: string; key: string; name: string; regex: string; shouldValidate: boolean };

const formKeys = { all: ['forms'] as const, detail: (id: string) => ['forms', id] as const };
const maskKeys = { all: ['form-masks'] as const };

export function useFormsList() {
  return useQuery({ queryKey: formKeys.all, queryFn: () => api.get<FormListItem[]>('/api/v1/forms/') });
}
export function useForm(id: string | null) {
  return useQuery({ queryKey: formKeys.detail(id ?? ''), queryFn: () => api.get<FormDetail>(`/api/v1/forms/${id}`), enabled: !!id });
}
export function useCreateForm() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: FormWrite) => api.post<{ id: string }>('/api/v1/forms/', body), onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.all }) });
}
export function useUpdateForm() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, body }: { id: string; body: FormWrite }) => api.put<void>(`/api/v1/forms/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.all }) });
}
export function useDeleteForm() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del<void>(`/api/v1/forms/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.all }) });
}

export function useFormMasks() {
  return useQuery({ queryKey: maskKeys.all, queryFn: () => api.get<FormMask[]>('/api/v1/form-masks/') });
}
export function useCreateFormMask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { key: string; name: string; regex: string; shouldValidate: boolean }) => api.post<{ id: string }>('/api/v1/form-masks/', body), onSuccess: () => qc.invalidateQueries({ queryKey: maskKeys.all }) });
}
export function useDeleteFormMask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del<void>(`/api/v1/form-masks/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: maskKeys.all }) });
}

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

export type FormMask = { id: string; key: string; name: string; regex: string; template?: string | null; shouldValidate: boolean };

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

// ── scripts (F4) ──────────────────────────────────────────────────────
export type FormScriptItem = { id: string; scope: 'global' | 'task'; taskRef?: string | null; latestVersion?: number | null };
export type ScriptRevision = { version: number; status: 'draft' | 'published'; changelog?: string | null; checksum?: string | null; code: string; createdAt: string };
export type ScriptTest = { id: number; name: string; isActive: boolean; inputContext?: unknown; expectedResult?: unknown };

const scriptKeys = {
  byForm: (formId: string) => ['forms', formId, 'scripts'] as const,
  revisions: (id: string) => ['form-scripts', id, 'revisions'] as const,
  tests: (id: string) => ['form-scripts', id, 'tests'] as const,
};

export function useFormScripts(formId: string | null) {
  return useQuery({ queryKey: scriptKeys.byForm(formId ?? ''), queryFn: () => api.get<FormScriptItem[]>(`/api/v1/forms/${formId}/scripts`), enabled: !!formId });
}
export function useCreateScript(formId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { formId: string; scope: string; taskRef?: string }) => api.post<{ id: string }>('/api/v1/form-scripts/', body), onSuccess: () => qc.invalidateQueries({ queryKey: scriptKeys.byForm(formId) }) });
}
export function useDeleteScript(formId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del<void>(`/api/v1/form-scripts/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: scriptKeys.byForm(formId) }) });
}
export function useScriptRevisions(scriptId: string | null) {
  return useQuery({ queryKey: scriptKeys.revisions(scriptId ?? ''), queryFn: () => api.get<ScriptRevision[]>(`/api/v1/form-scripts/${scriptId}/revisions`), enabled: !!scriptId });
}
export function useCreateRevision(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { code: string; changelog?: string; status: string }) => api.post<{ version: number; checksum: string }>(`/api/v1/form-scripts/${scriptId}/revisions`, body), onSuccess: () => qc.invalidateQueries({ queryKey: scriptKeys.revisions(scriptId) }) });
}
export function useScriptTests(scriptId: string | null) {
  return useQuery({ queryKey: scriptKeys.tests(scriptId ?? ''), queryFn: () => api.get<ScriptTest[]>(`/api/v1/form-scripts/${scriptId}/tests`), enabled: !!scriptId });
}
export function useCreateTest(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { name: string; inputContext?: unknown; expectedResult?: unknown }) => api.post<{ id: number }>(`/api/v1/form-scripts/${scriptId}/tests`, body), onSuccess: () => qc.invalidateQueries({ queryKey: scriptKeys.tests(scriptId) }) });
}
export function useDeleteTest(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (testId: number) => api.del<void>(`/api/v1/form-script-tests/${testId}`), onSuccess: () => qc.invalidateQueries({ queryKey: scriptKeys.tests(scriptId) }) });
}

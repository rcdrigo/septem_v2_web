import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** draft = rascunho, published = publicado, inactive = inativo (soft-delete). */
/**
 * `homologation` (Fase 5): versão em teste de um processo já publicado. Só a simulação
 * a executa; produção continua na versão `published` até alguém publicar.
 */
export type ProcessStatus = 'draft' | 'homologation' | 'published' | 'inactive';

export type ProcessListItem = {
  key: string;
  name: string;
  description: string | null;
  version: number;
  status: ProcessStatus;
  icon: string | null;
  category: string | null;
  categoryId: number | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  area: string | null;
  updatedAt: string;
};

export type ProcessPage = { items: ProcessListItem[]; total: number; page: number; pageSize: number };

export type ProcessDetail = {
  id: number;
  publicId: string;
  key: string;
  name: string;
  version: number;
  versions: number[];
  status: ProcessStatus;
  bpmnXml: string;
  createdAt: string;
  updatedAt: string;
  category: { id: number; name: string } | null;
  area: { id: string; key: string; name: string } | null;
  hasInstances?: boolean;
};

export type ProcessIssue = {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  elementId?: string;
};

export type SavedProcess = {
  id: number;
  publicId: string;
  key: string;
  name: string;
  version: number;
  status: ProcessStatus;
  warnings: ProcessIssue[];
};

export type ProcessListParams = {
  q?: string;
  status?: string;
  categoryId?: number;
  page?: number;
  pageSize?: number;
};

const BASE = '/api/v1/workflow/process-definitions';

const processKeys = {
  all: ['process-definitions'] as const,
  list: (p: ProcessListParams) => ['process-definitions', 'list', p] as const,
  detail: (key: string, version?: number) => ['process-definitions', 'detail', key, version ?? 'latest'] as const,
  diagnostics: (key: string) => ['process-definitions', 'diagnostics', key] as const,
};

/** O modelador e a execução usam caches distintos para a mesma definição. */
async function invalidateProcess(qc: QueryClient, key: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: processKeys.all }),
    qc.invalidateQueries({ queryKey: ['workflow', 'process-form', key] }),
  ]);
}

function toQuery(params: ProcessListParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.categoryId != null) qs.set('categoryId', String(params.categoryId));
  qs.set('page', String(params.page ?? 1));
  qs.set('pageSize', String(params.pageSize ?? 20));
  return `?${qs.toString()}`;
}

export function useProcessList(params: ProcessListParams) {
  return useQuery({
    queryKey: processKeys.list(params),
    queryFn: () => api.get<ProcessPage>(`${BASE}/${toQuery(params)}`),
    placeholderData: (prev) => prev,
  });
}

export function useProcessDefinition(key: string | null, version?: number) {
  return useQuery({
    queryKey: processKeys.detail(key ?? '', version),
    queryFn: () => api.get<ProcessDetail>(`${BASE}/${key}${version != null ? `?version=${version}` : ''}`),
    enabled: !!key,
  });
}

export function useProcessDiagnostics(key: string | null) {
  return useQuery({
    queryKey: processKeys.diagnostics(key ?? ''),
    queryFn: () => api.get<{ issues: ProcessIssue[] }>(`${BASE}/${key}/diagnostics`),
    enabled: !!key,
  });
}

/** POST = cria uma NOVA versão (ação "Versionar" / primeiro save). */
export function useSaveProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { bpmnXml: string; key?: string; commitMessage?: string }) =>
      api.post<SavedProcess>(`${BASE}/`, body),
    onSuccess: (result) => invalidateProcess(qc, result.key),
  });
}

/** PUT = atualiza a versão corrente NO LUGAR (ação "Salvar"). 409 se publicada. */
export function useUpdateProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, bpmnXml }: { key: string; bpmnXml: string }) =>
      api.put<SavedProcess>(`${BASE}/${key}`, { bpmnXml }),
    onSuccess: (result) => invalidateProcess(qc, result.key),
  });
}

export function usePatchProcessStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, status }: { key: string; status: ProcessStatus }) =>
      api.patch<{ key: string; version: number; status: ProcessStatus; updatedAt: string }>(
        `${BASE}/${key}/status`,
        { status },
      ),
    onSuccess: (result) => invalidateProcess(qc, result.key),
  });
}

/** Exclusão PERMANENTE (some da lista). 409 quando há solicitações. */
export function useDeleteProcessPermanently() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.del(`${BASE}/${key}/permanent`),
    onSuccess: () => qc.invalidateQueries({ queryKey: processKeys.all }),
  });
}

export function useDeleteProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.del<void>(`${BASE}/${key}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: processKeys.all }),
  });
}

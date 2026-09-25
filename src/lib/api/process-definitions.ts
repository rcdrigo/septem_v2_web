import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * draft = rascunho, published = publicado, inactive = inativo (soft-delete).
 *
 * ⚠️ Havia um `homologation` entre a Fase 5 do plano 2026-08-03 e a Fase 15 do plano 26_09,
 * quando a decisão Q18 o aposentou: homologar passou a ser no **ambiente** de homologação,
 * com a transferência promovendo para produção depois.
 */
export type ProcessStatus = 'draft' | 'published' | 'inactive';

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
  /** Origem no catálogo da Septem (Fase 12); nulo = processo próprio do cliente. */
  catalogKey?: string | null;
  catalogVersion?: number | null;
  /** A cópia foi alterada depois de instalada. */
  customized?: boolean;
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

/**
 * Catálogo de serviços do usuário: TODOS os publicados que ele pode iniciar, sem
 * paginação (`GET /api/v1/services`).
 *
 * A tela "Nova requisição" usava `useProcessList({ status: 'published', pageSize: 100 })`,
 * que é a lista de ADMINISTRAÇÃO e tem teto de 100 por página no servidor. Como as
 * categorias da barra lateral são montadas a partir dos itens carregados, um catálogo
 * com mais de 100 serviços perdia serviços E categorias inteiras — a busca local
 * também não alcançava o que não veio.
 */
export function useServiceCatalog() {
  return useQuery({
    queryKey: ['service-catalog'] as const,
    queryFn: () => api.get<ProcessListItem[]>('/api/v1/services'),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: processKeys.all }),
  });
}

/** PUT = atualiza a versão corrente NO LUGAR (ação "Salvar"). 409 se publicada. */
export function useUpdateProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, bpmnXml }: { key: string; bpmnXml: string }) =>
      api.put<SavedProcess>(`${BASE}/${key}`, { bpmnXml }),
    onSuccess: () => qc.invalidateQueries({ queryKey: processKeys.all }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: processKeys.all }),
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

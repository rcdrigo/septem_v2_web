import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type DataSourceType = 'fixed' | 'sql' | 'api';

export type DataSourceListItem = { id: string; name: string; type: DataSourceType; description: string | null };
export type DataSourceDetail = { id: string; name: string; description: string | null; type: DataSourceType; config: unknown };
export type DataSourceWrite = { name: string; description?: string; type: DataSourceType; config: unknown };

export type TestResult = { columns: string[]; rows: (string | null)[][] };
export type DataSourceLog = { id: number; occurredAt: string; origin: string | null; status: string; durationMs: number; error: string | null };
export type LogsPage = { items: DataSourceLog[]; total: number; page: number; pageSize: number };

export type ExternalConnection = { id: string; name: string; provider: 'postgres' };

const dsKeys = { all: ['data-sources'] as const, detail: (id: string) => ['data-sources', id] as const, logs: (id: string) => ['data-sources', id, 'logs'] as const };
const connKeys = { all: ['external-connections'] as const };

// ── fontes de dados ──────────────────────────────────────────────────
export function useDataSourcesList() {
  return useQuery({ queryKey: dsKeys.all, queryFn: () => api.get<DataSourceListItem[]>('/api/v1/data-sources/') });
}

export function useDataSource(id: string | null) {
  return useQuery({ queryKey: dsKeys.detail(id ?? ''), queryFn: () => api.get<DataSourceDetail>(`/api/v1/data-sources/${id}`), enabled: !!id });
}

export function useCreateDataSource() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: DataSourceWrite) => api.post<{ id: string }>('/api/v1/data-sources/', body), onSuccess: () => qc.invalidateQueries({ queryKey: dsKeys.all }) });
}

export function useUpdateDataSource() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, body }: { id: string; body: DataSourceWrite }) => api.put<void>(`/api/v1/data-sources/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: dsKeys.all }) });
}

export function useDeleteDataSource() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del<void>(`/api/v1/data-sources/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: dsKeys.all }) });
}

/** Testa uma config ainda não salva (editor). */
export function useTestDataSource() {
  return useMutation({
    mutationFn: (body: { type: DataSourceType; config: unknown; params?: Record<string, string | null> }) =>
      api.post<TestResult>('/api/v1/data-sources/test', body),
  });
}

export function useDataSourceLogs(id: string | null) {
  return useQuery({ queryKey: dsKeys.logs(id ?? ''), queryFn: () => api.get<LogsPage>(`/api/v1/data-sources/${id}/logs`), enabled: !!id });
}

// ── conexões externas ────────────────────────────────────────────────
export function useExternalConnections() {
  return useQuery({ queryKey: connKeys.all, queryFn: () => api.get<ExternalConnection[]>('/api/v1/external-connections/') });
}

export function useCreateExternalConnection() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { name: string; provider: string; connectionString: string }) => api.post<{ id: string }>('/api/v1/external-connections/', body), onSuccess: () => qc.invalidateQueries({ queryKey: connKeys.all }) });
}

export function useDeleteExternalConnection() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del<void>(`/api/v1/external-connections/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: connKeys.all }) });
}

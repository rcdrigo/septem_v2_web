import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type DataSourceType = 'fixed' | 'sql' | 'api';
export type DataSourceScope = 'process' | 'report';

export type DataSourceListItem = { id: string; name: string; type: DataSourceType; scope: DataSourceScope; description: string | null };
export type DataSourceDetail = { id: string; name: string; description: string | null; scope: DataSourceScope; type: DataSourceType; config: unknown };
export type DataSourceWrite = { name: string; description?: string; scope: DataSourceScope; type: DataSourceType; config: unknown };

export type TestResult = { columns: string[]; rows: (string | null)[][] };
export type DataSourceLog = { id: number; occurredAt: string; origin: string | null; status: string; durationMs: number; error: string | null };
export type LogsPage = { items: DataSourceLog[]; total: number; page: number; pageSize: number };

const dsKeys = { all: ['data-sources'] as const, scoped: (s: string) => ['data-sources', { scope: s }] as const, detail: (id: string) => ['data-sources', id] as const, logs: (id: string) => ['data-sources', id, 'logs'] as const };

// ── fontes de dados ──────────────────────────────────────────────────
export function useDataSourcesList(scope?: DataSourceScope) {
  return useQuery({
    queryKey: scope ? dsKeys.scoped(scope) : dsKeys.all,
    queryFn: () => api.get<DataSourceListItem[]>(`/api/v1/data-sources/${scope ? `?scope=${scope}` : ''}`),
  });
}

export function useDataSource(id: string | null) {
  return useQuery({ queryKey: dsKeys.detail(id ?? ''), queryFn: () => api.get<DataSourceDetail>(`/api/v1/data-sources/${id}`), enabled: !!id });
}

export type DataSourceUsage = { kind: string; process: string | null; label: string };
export function useDataSourceUsages(id: string | null) {
  return useQuery({
    queryKey: ['data-sources', id, 'usages'],
    queryFn: () => api.get<{ usages: DataSourceUsage[] }>(`/api/v1/data-sources/${id}/usages`),
    enabled: !!id,
  });
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

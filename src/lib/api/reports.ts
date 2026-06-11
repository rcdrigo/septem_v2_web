import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type ReportStatus = 'draft' | 'published' | 'inactive';

export type ReportListItem = {
  key: string;
  name: string;
  description: string | null;
  status: ReportStatus;
  updatedAt: string;
};

export type ReportPage = { items: ReportListItem[]; total: number; page: number; pageSize: number };

export type ReportDetail = {
  id: number;
  publicId: string;
  key: string;
  name: string;
  description: string | null;
  status: ReportStatus;
  dataSourceId: string | null;
  dataSourceName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportRunResult = { columns: string[]; rows: (string | null)[][] };

export type SaveReportBody = { name: string; description?: string | null; dataSourceId?: string | null };

export type ReportListParams = { q?: string; status?: string; page?: number; pageSize?: number };

const BASE = '/api/v1/reports';

const reportKeys = {
  all: ['reports'] as const,
  list: (p: ReportListParams) => ['reports', 'list', p] as const,
  detail: (key: string) => ['reports', 'detail', key] as const,
  run: (key: string) => ['reports', 'run', key] as const,
};

function toQuery(params: ReportListParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  qs.set('page', String(params.page ?? 1));
  qs.set('pageSize', String(params.pageSize ?? 20));
  return `?${qs.toString()}`;
}

export function useReportsList(params: ReportListParams) {
  return useQuery({
    queryKey: reportKeys.list(params),
    queryFn: () => api.get<ReportPage>(`${BASE}/${toQuery(params)}`),
    placeholderData: (prev) => prev,
  });
}

export function useReport(key: string | null) {
  return useQuery({
    queryKey: reportKeys.detail(key ?? ''),
    queryFn: () => api.get<ReportDetail>(`${BASE}/${key}`),
    enabled: !!key,
  });
}

/** Executa o relatório (POST /run) e devolve colunas + linhas. */
export function useReportData(key: string | null) {
  return useQuery({
    queryKey: reportKeys.run(key ?? ''),
    queryFn: () => api.post<ReportRunResult>(`${BASE}/${key}/run`, {}),
    enabled: !!key,
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveReportBody) => api.post<ReportDetail>(`${BASE}/`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, body }: { key: string; body: SaveReportBody }) => api.put<ReportDetail>(`${BASE}/${key}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

export function usePatchReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, status }: { key: string; status: ReportStatus }) =>
      api.patch<{ key: string; status: ReportStatus; updatedAt: string }>(`${BASE}/${key}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.del<void>(`${BASE}/${key}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

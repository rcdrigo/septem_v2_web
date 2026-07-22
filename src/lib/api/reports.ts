import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Category, CategoryInput } from '@/lib/api/catalog';

export type ReportStatus = 'draft' | 'published' | 'inactive';

export type ReportListItem = {
  key: string;
  name: string;
  description: string | null;
  status: ReportStatus;
  category: string | null;
  categoryId: number | null;
  categoryColor: string | null;
  categoryIcon: string | null;
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
  version: number;
  versions: { version: number; status: ReportStatus; updatedAt: string }[];
  sourceType: 'dataSource' | 'process';
  processKey: string | null;
  dataSourceId: string | null;
  dataSourceName: string | null;
  categoryId: number | null;
  definitionJson: string;
  schemaSnapshotJson: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── Engine (definição/blocos) ─────────────────────────────────────────────────

export type ReportColumnMeta = { key: string; label: string; type: string; group: string | null };
export type ReportSchema = { sourceType: string; columns: ReportColumnMeta[] };

export type GlobalFilterDef = {
  id: string; label?: string; field?: string; type: 'text' | 'number' | 'date' | 'select';
  required?: boolean; default?: string; mapsToParam?: string; options?: string[];
};
export type TableColumnDef = { key: string; label?: string; visible?: boolean; format?: string };
export type BlockFilterDef = { field: string; op: string; value?: string };
export type SortDef = { field: string; desc: boolean };
export type BlockDef = {
  id: string; type: 'table' | 'kpi' | 'pie' | 'bars' | 'stackedBars' | 'heatmap'; title?: string;
  /** Layout no grid de 12 colunas: largura em colunas (1–12) e altura em linhas. */
  w?: number; h?: number;
  columns?: TableColumnDef[];
  groupBy?: string; stackBy?: string; valueField?: string; agg?: string; formula?: string; format?: string;
  filters?: BlockFilterDef[]; sort?: SortDef; limit?: number;
  /** Ordenação por várias colunas (F7.7) — precede `sort`. */
  sorts?: SortDef[];
  /** KPI (F7.11): ícone, cor de destaque e campo de data para o sparkline. */
  icon?: string; color?: string; trendField?: string;
};
export type ReportDefinition = {
  cacheTtlSeconds?: number;
  filters?: GlobalFilterDef[];
  blocks?: BlockDef[];
  detail?: { fields: string[] };
  columnTypes?: Record<string, string>;
  /** Rótulo customizado por coluna (renomear no relatório) — F7.5. */
  columnLabels?: Record<string, string>;
  /** Colunas removidas (origem processo) — F7.5. */
  hiddenColumns?: string[];
};

export type RunBlockTable = {
  id: string; type: 'table'; title?: string; w?: number; h?: number;
  columns: { key: string; label: string; visible: boolean; format?: string; colType: string }[];
  rows: (string | null)[][]; hasHiddenColumns: boolean; total: number;
};
export type RunBlockKpi = { id: string; type: 'kpi'; title?: string; w?: number; h?: number; format?: string; value: number; icon?: string; color?: string; spark?: number[] };
export type RunBlockGrouped = { id: string; type: 'pie' | 'bars' | 'heatmap'; title?: string; w?: number; h?: number; format?: string; items: { label: string; value: number }[] };
export type RunBlockStacked = { id: string; type: 'stackedBars'; title?: string; w?: number; h?: number; format?: string; labels: string[]; series: { name: string; values: number[] }[] };
export type RunBlock = RunBlockTable | RunBlockKpi | RunBlockGrouped | RunBlockStacked;

export type ReportRunResult = {
  generatedAt: string; fromCache: boolean; cacheTtlSeconds: number; totalRows: number;
  detailFields: string[]; blocks: RunBlock[]; version: number; status: string;
};

export type DrilldownResult = { columns: ReportColumnMeta[]; rows: (string | null)[][] };

export type SaveReportBody = { name: string; description?: string | null; dataSourceId?: string | null; categoryId?: number | null; sourceType?: string; processKey?: string; definitionJson?: string };

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

/** Executa o relatório publicado (engine de blocos, cache 5min no servidor). */
export function useReportRun(key: string | null, filters: Record<string, string>, opts?: { preview?: boolean }) {
  const path = opts?.preview ? 'preview' : 'run';
  return useQuery({
    queryKey: [...reportKeys.run(key ?? ''), path, filters],
    queryFn: () => api.post<ReportRunResult>(`${BASE}/${key}/${path}`, { filters }),
    enabled: !!key,
  });
}

export function refreshReport(key: string, filters: Record<string, string>, preview = false) {
  return api.post<ReportRunResult>(`${BASE}/${key}/${preview ? 'preview' : 'run'}`, { filters, refresh: true });
}

export function fetchDrilldown(key: string, blockId: string, body: { filters?: Record<string, string>; group?: string; stack?: string }) {
  return api.post<DrilldownResult>(`${BASE}/${key}/blocks/${blockId}/drilldown`, body);
}

/** Preview ao vivo de UM bloco avulso (ainda não salvo) — modal de configuração. */
export function previewBlock(key: string, block: BlockDef, filters: Record<string, string> = {}) {
  return api.post<{ block: RunBlock | null; error?: string }>(`${BASE}/${key}/preview-block`, { block, filters });
}

export function useReportSourceMetadata(key: string | null) {
  return useQuery({
    queryKey: ['reports', 'source-metadata', key ?? ''],
    queryFn: () => api.get<ReportSchema>(`${BASE}/${key}/source-metadata`),
    enabled: !!key,
    retry: false,
  });
}

export function usePublishReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.post(`${BASE}/${key}/publish`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

export function useSyncReportSchema() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.post(`${BASE}/${key}/sync-schema`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  });
}

// ── Regras de acesso próprias (padrão do controle de acesso de processos) ────

export type ReportAccessRule = {
  ruleType: 'all' | 'user' | 'profile' | 'orgUnit' | 'position' | 'orgUnitPosition';
  action: 'allow' | 'deny';
  userId?: string | null;
  accessProfileId?: string | null;
  orgUnitId?: string | null;
  positionId?: string | null;
};

export function useReportAccessRules(key: string | null) {
  return useQuery({
    queryKey: ['reports', 'access-rules', key ?? ''],
    queryFn: () => api.get<{ rules: ReportAccessRule[] }>(`${BASE}/${key}/access-rules`),
    enabled: !!key,
  });
}

export function useSaveReportAccessRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, rules }: { key: string; rules: ReportAccessRule[] }) =>
      api.put(`${BASE}/${key}/access-rules`, { rules }),
    onSuccess: (_, { key }) => void qc.invalidateQueries({ queryKey: ['reports', 'access-rules', key] }),
  });
}

/** Baixa a exportação (CSV/XLSX) do bloco como arquivo. */
export async function exportReport(key: string, body: { blockId: string; format: 'csv' | 'xlsx'; filters?: Record<string, string>; group?: string; stack?: string }) {
  const blob = await api.postBlob(`${BASE}/${key}/export`, body);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${key}_${body.blockId}.${body.format}`;
  a.click();
  URL.revokeObjectURL(a.href);
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

// ── Categorias de relatório (lista PRÓPRIA — separada das de processos) ──────

const CATS = '/api/v1/report-categories';
const reportCatKeys = { all: ['report-categories'] as const };

export function useReportCategories() {
  return useQuery({ queryKey: reportCatKeys.all, queryFn: () => api.get<Category[]>(CATS) });
}

export function useCreateReportCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) => api.post<Category>(CATS, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: reportCatKeys.all }),
  });
}

export function useUpdateReportCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CategoryInput & { id: number }) => api.put<Category>(`${CATS}/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: reportCatKeys.all }),
  });
}

export function useDeleteReportCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`${CATS}/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: reportCatKeys.all }),
  });
}

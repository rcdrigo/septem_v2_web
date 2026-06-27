import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Catálogos que populam os combos do modelador (B2 §4.7). Fontes de dados e
 * templates de e-mail ainda são stubs vazios no backend até seus módulos existirem.
 */

export type Category = { id: number; name: string; description: string | null; color: string | null; icon: string | null };
export type Area = { id: string; key: string; name: string; active: boolean };
export type AreaPosition = { id: string; key: string; name: string };
export type DataSource = { id: string; name: string };
export type EmailTemplate = { id: string; name: string };

export function useCategories() {
  return useQuery({ queryKey: ['catalog', 'categories'], queryFn: () => api.get<Category[]>('/api/v1/categories') });
}

export function useAreas() {
  return useQuery({ queryKey: ['catalog', 'areas'], queryFn: () => api.get<Area[]>('/api/v1/areas') });
}

export function useAreaPositions(areaKey: string | null) {
  return useQuery({
    queryKey: ['catalog', 'areas', areaKey, 'positions'],
    queryFn: () => api.get<AreaPosition[]>(`/api/v1/areas/${areaKey}/positions`),
    enabled: !!areaKey,
  });
}

export function useDataSources() {
  return useQuery({ queryKey: ['catalog', 'data-sources'], queryFn: () => api.get<DataSource[]>('/api/v1/data-sources') });
}

export type PlaceholderGroup = { group: string; items: { token: string; label: string }[] };
export function usePlaceholders(flowKey?: string) {
  return useQuery({
    queryKey: ['catalog', 'placeholders', flowKey ?? null],
    queryFn: () => api.get<{ groups: PlaceholderGroup[] }>(`/api/v1/placeholders${flowKey ? `?flowKey=${encodeURIComponent(flowKey)}` : ''}`),
  });
}

/** Resolve as opções (value/label) de uma fonte de dados — usado ao aplicar a fonte a um campo de opções. */
export async function fetchDataSourceOptions(dataSourceId: string): Promise<{ value: string; label: string }[]> {
  const r = await api.post<{ options: { value: string; label: string }[] }>('/api/v1/workflow/field-options', { dataSourceId });
  return r.options ?? [];
}

export function useEmailTemplates() {
  return useQuery({ queryKey: ['catalog', 'email-templates'], queryFn: () => api.get<EmailTemplate[]>('/api/v1/email-templates') });
}

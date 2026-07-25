import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type ManualAudience = 'interno' | 'externo' | 'ambos';

export type ManualCategory = { id: string; name: string; icon: string | null; displayOrder: number };
export type ManualCategoryInput = { name: string; icon?: string | null; displayOrder?: number };

export type ManualListItem = {
  id: string; title: string; categoryId: string; categoryName: string;
  parentId: string | null; audience: ManualAudience; icon: string | null;
  isTechnical: boolean; published: boolean; displayOrder: number;
};
export type ManualParentOption = { id: string; title: string; categoryId: string; isTechnical: boolean };
export type ManualDetail = {
  id: string; title: string; contentHtml: string | null; categoryId: string;
  parentId: string | null; audience: ManualAudience; icon: string | null;
  isTechnical: boolean; published: boolean; displayOrder: number; orgUnitIds: string[];
};
export type ManualWrite = {
  title: string; contentHtml?: string; categoryId?: string | null; parentId?: string | null;
  audience: ManualAudience; icon?: string | null; isTechnical?: boolean; published?: boolean;
  displayOrder?: number; orgUnitIds?: string[];
};

const keys = {
  list: ['manuals'] as const,
  detail: (id: string) => ['manuals', id] as const,
  parents: (exclude?: string) => ['manuals', 'parents', exclude ?? ''] as const,
  categories: ['manual-categories'] as const,
};

// ── Manuais ─────────────────────────────────────────────────────────────
export function useManuals() {
  return useQuery({ queryKey: keys.list, queryFn: () => api.get<ManualListItem[]>('/api/v1/manuals/') });
}

export function useManual(id: string | null) {
  return useQuery({ queryKey: keys.detail(id ?? ''), queryFn: () => api.get<ManualDetail>(`/api/v1/manuals/${id}`), enabled: !!id });
}

export function useManualParents(exclude?: string) {
  const qs = exclude ? `?exclude=${exclude}` : '';
  return useQuery({ queryKey: keys.parents(exclude), queryFn: () => api.get<ManualParentOption[]>(`/api/v1/manuals/parents${qs}`) });
}

export function useCreateManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ManualWrite) => api.post<{ id: string }>('/api/v1/manuals/', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list }),
  });
}

export function useUpdateManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ManualWrite }) => api.put<void>(`/api/v1/manuals/${id}`, body),
    onSuccess: (_d, { id }) => { qc.invalidateQueries({ queryKey: keys.list }); qc.invalidateQueries({ queryKey: keys.detail(id) }); },
  });
}

export function useDeleteManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/v1/manuals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list }),
  });
}

// ── Categorias de manuais (criação inline) ──────────────────────────────
export function useManualCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => api.get<ManualCategory[]>('/api/v1/manual-categories/') });
}

export function useCreateManualCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ManualCategoryInput) => api.post<{ id: string }>('/api/v1/manual-categories/', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

export function useUpdateManualCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ManualCategoryInput }) => api.put<void>(`/api/v1/manual-categories/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

export function useDeleteManualCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/v1/manual-categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

// ── Guide público ───────────────────────────────────────────────────────
export type GuideManual = {
  id: string; title: string; contentHtml: string | null; icon: string | null;
  audience: ManualAudience; categoryId: string; categoryName: string; categoryOrder: number;
  parentId: string | null; order: number;
};
export type GuideWelcome = {
  id: string; title: string; description: string;
  categories: { id: string; name: string; order: number; firstManualId: string }[];
};
export type GuideResponse = {
  tenantName: string; logoUrl: string | null; isInternal: boolean; canTechnical: boolean;
  welcome: GuideWelcome; external: GuideManual[]; internal: GuideManual[]; technical: GuideManual[];
};

export function useGuide() {
  return useQuery({ queryKey: ['guide'], queryFn: () => api.get<GuideResponse>('/api/v1/guide') });
}

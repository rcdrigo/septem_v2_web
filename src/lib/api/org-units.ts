import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type OrgUnitNode = {
  id: string;
  key: string;
  name: string;
  active: boolean;
  children: OrgUnitNode[];
};

/** Pessoa resolvida (titular/preposto) — vem do backend já com foto e contato. */
export type OrgPerson = {
  id: string;
  name: string;
  email?: string;
  telefone?: string | null;
  photoUrl?: string | null;
};

export type OrgUnitFlat = {
  id: string;
  key: string;
  name: string;
  sigla: string | null;
  parentId: string | null;
  active: boolean;
  titularUserId?: string | null;
  titular?: OrgPerson | null;
};

/** Detalhe da unidade (tela em aba própria), com o conteúdo das abas. */
export type OrgUnitDetail = {
  id: string;
  key: string;
  name: string;
  sigla: string | null;
  localizacao: string | null;
  objetivo: string | null;
  unidadeOrcamentaria: string | null;
  telefone: string | null;
  email: string | null;
  active: boolean;
  parent: { id: string; name: string; sigla: string | null } | null;
  titular: OrgPerson | null;
  preposto: OrgPerson | null;
  abas: {
    processos: { id: string; key: string; name: string; status: string; version: number }[];
    usuarios: { id: string; name: string; email: string; photoUrl: string | null; position: string }[];
    manuais: unknown[];      // módulo entra na Fase 10
    documentos: unknown[];   // módulo entra na Fase 6
  };
};

export type OrgUnitWrite = {
  key?: string;
  name?: string;
  parentId?: string;
  active?: boolean;
  titularUserId?: string | null;
  prepostoUserId?: string | null;
  sigla?: string | null;
  localizacao?: string | null;
  objetivo?: string | null;
  unidadeOrcamentaria?: string | null;
  telefone?: string | null;
  email?: string | null;
};

const orgKeys = {
  all: ['org-units'] as const,
  tree: ['org-units', 'tree'] as const,
  flat: ['org-units', 'flat'] as const,
  detail: (id: string) => ['org-units', 'detail', id] as const,
};

export function useOrgUnitsTree() {
  return useQuery({ queryKey: orgKeys.tree, queryFn: () => api.get<OrgUnitNode[]>('/api/v1/org-units/tree') });
}

export function useOrgUnitsFlat() {
  return useQuery({ queryKey: orgKeys.flat, queryFn: () => api.get<OrgUnitFlat[]>('/api/v1/org-units/') });
}

export function useOrgUnit(id: string | null) {
  return useQuery({
    queryKey: orgKeys.detail(id ?? ''),
    queryFn: () => api.get<OrgUnitDetail>(`/api/v1/org-units/${id}`),
    enabled: !!id,
  });
}

export function useCreateOrgUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OrgUnitWrite) => api.post<{ id: string }>('/api/v1/org-units/', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

export function useUpdateOrgUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: OrgUnitWrite }) => api.put<void>(`/api/v1/org-units/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

export function useDeleteOrgUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/v1/org-units/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

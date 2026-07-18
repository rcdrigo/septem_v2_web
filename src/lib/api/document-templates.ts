import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Erro de sintaxe encontrado ao validar o .docx no upload (Fase 6b). */
export type TemplateIssue = { severity: 'error' | 'warning'; message: string; token?: string | null };

export type DocumentTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  orgUnitId: string | null;
  active: boolean;
  outputType: 'docx' | 'pdf';
  fileName: string | null;
  hasFile: boolean;
  templateValid: boolean;
  updatedAt: string;
};

export type DocumentTemplateDetail = DocumentTemplateListItem & {
  fileSize: number | null;
  fileUploadedAt: string | null;
  validation: { issues?: TemplateIssue[] } | null;
  createdAt: string;
};

export type DocumentTemplateWrite = {
  name: string;
  description?: string;
  orgUnitId?: string | null;
  active?: boolean;
  outputType?: 'docx' | 'pdf';
};

const keys = {
  all: ['document-templates'] as const,
  detail: (id: string) => ['document-templates', id] as const,
};

export function useDocumentTemplates(q?: string) {
  return useQuery({
    queryKey: [...keys.all, q ?? ''],
    queryFn: () => api.get<DocumentTemplateListItem[]>(`/api/v1/document-templates/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  });
}

export function useDocumentTemplate(id: string | null) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => api.get<DocumentTemplateDetail>(`/api/v1/document-templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DocumentTemplateWrite) => api.post<{ id: string }>('/api/v1/document-templates/', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: DocumentTemplateWrite }) =>
      api.put<{ id: string }>(`/api/v1/document-templates/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/v1/document-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

/**
 * Abre o .docx do modelo numa nova aba (somente leitura). A rota exige Bearer token,
 * então buscamos o blob autenticado e abrimos por object URL — abrir a URL crua numa
 * aba nova não levaria o token e daria 401.
 */
export async function openDocumentTemplateFile(id: string): Promise<void> {
  const blob = await api.getBlob(`/api/v1/document-templates/${id}/file`);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  // Revoga depois de a aba pegar o conteúdo (revogar na hora cancelaria o download).
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Preview do modelo em SOMENTE LEITURA (:11). Navegador nenhum renderiza .docx, então
 * o servidor devolve o mesmo modelo convertido em PDF — abre na aba em vez de baixar.
 */
export async function openDocumentTemplatePreview(id: string): Promise<void> {
  const blob = await api.getBlob(`/api/v1/document-templates/${id}/preview`);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Serviço (processo publicado) visível ao usuário — alimenta o "buscar campos". */
export type DocumentService = { key: string; name: string; area: string | null };

/** Campo do formulário do serviço, com a chave já pontuada em lista dinâmica. */
export type CatalogField = { group: string | null; label: string | null; key: string; type: string | null; inList: boolean };

export function useDocumentServices(enabled: boolean) {
  return useQuery({
    queryKey: ['document-templates', 'services'],
    queryFn: () => api.get<DocumentService[]>('/api/v1/document-templates/services'),
    enabled,
  });
}

export function useServiceFields(key: string | null) {
  return useQuery({
    queryKey: ['document-templates', 'services', key, 'fields'],
    queryFn: () => api.get<{ service: string; fields: CatalogField[] }>(
      `/api/v1/document-templates/services/${encodeURIComponent(key!)}/fields`),
    enabled: !!key,
  });
}

/** Uma execução do modelo no histórico (Fase 6d). */
export type DocumentExecution = {
  id: string;
  startedAt: string;
  durationMs: number;
  kind: 'teste' | 'producao';
  status: 'sucesso' | 'falha';
  error: string | null;
  outputType: 'docx' | 'pdf';
  payload: string | null;
  requestedBy: string | null;
};

/** Histórico de execuções do modelo — exige a permissão documents:history. */
export function useDocumentExecutions(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['document-templates', id, 'executions'],
    queryFn: () => api.get<DocumentExecution[]>(`/api/v1/document-templates/${id}/executions`),
    enabled: !!id && enabled,
  });
}

/** Chave que o usuário preenche no teste (árvore: grupo/lista/imagem). */
export type TemplateKey = { name: string; kind: 'scalar' | 'group' | 'array' | 'image'; children: TemplateKey[] };

/** Lê as chaves do .docx salvo — vira o esqueleto do JSON do modal de teste. */
export function useTemplateKeys(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['document-templates', id, 'keys'],
    queryFn: () => api.get<{ keys: TemplateKey[]; issues: TemplateIssue[]; templateValid: boolean }>(
      `/api/v1/document-templates/${id}/keys`),
    enabled: !!id && enabled,
  });
}

/**
 * Monta um JSON de exemplo a partir das chaves: escalares viram string vazia, grupos
 * viram objeto, listas viram um array com um item modelo. É o que o usuário edita.
 */
export function skeletonFromKeys(keys: TemplateKey[]): Record<string, unknown> {
  const value = (k: TemplateKey): unknown => {
    if (k.kind === 'group') return Object.fromEntries(k.children.map((c) => [c.name, value(c)]));
    if (k.kind === 'array') {
      return k.children.length
        ? [Object.fromEntries(k.children.map((c) => [c.name, value(c)]))]
        : [0];
    }
    return '';
  };
  return Object.fromEntries(keys.map((k) => [k.name, value(k)]));
}

/** Gera o documento de teste e abre em nova aba (o arquivo vem autenticado). */
export async function testDocumentTemplate(id: string, data: unknown): Promise<void> {
  const blob = await api.postBlob(`/api/v1/document-templates/${id}/test`, { data });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Sobe o .docx do modelo; a resposta traz o resultado da validação de sintaxe. */
export function useUploadDocumentTemplateFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return api.postForm<{ fileName: string; fileSize: number; templateValid: boolean }>(
        `/api/v1/document-templates/${id}/file`, form);
    },
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.detail(v.id) });
    },
  });
}

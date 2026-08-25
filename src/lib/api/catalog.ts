import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

// ── CRUD de categorias (modal "Categorias" em Admin › Processos) ─────────────

export type CategoryInput = { name: string; description?: string; color?: string; icon?: string };

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) => api.post<Category>('/api/v1/categories', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['catalog', 'categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CategoryInput & { id: number }) =>
      api.put<Category>(`/api/v1/categories/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['catalog', 'categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/v1/categories/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['catalog', 'categories'] }),
  });
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

// ── Central de serviços pública (Fase 8) ────────────────────────────────────

/** Serviço como o visitante ANÔNIMO o enxerga: nome, visual e se exige login. */
export type PublicService = {
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  categoryId: number | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  /** `false` só quando o serviço aceita requisição anônima. */
  requiresLogin: boolean;
};

/**
 * Vitrine pública. Sem token: a rota é anônima de propósito, e é o único jeito de
 * o cidadão ver os serviços antes de ter conta.
 */
export function usePublicServices() {
  return useQuery({
    queryKey: ['public', 'services'],
    queryFn: () => api.get<PublicService[]>('/api/v1/public/services'),
    // Vitrine muda pouco e a rota tem teto de requisições: não vale refazer a
    // chamada a cada foco de janela.
    staleTime: 60_000,
    retry: false,
  });
}

/** Detalhe público de um serviço — inclui o formulário para preencher. */
export type PublicServiceDetail = PublicService & { formSchema: string | null };

export function usePublicService(key: string | undefined) {
  return useQuery({
    queryKey: ['public', 'service', key ?? ''],
    queryFn: () => api.get<PublicServiceDetail>(`/api/v1/public/services/${key}`),
    enabled: !!key,
    retry: false,
  });
}

/** Envio anônimo. Devolve o número do protocolo — é o que o cidadão anota. */
export function submitPublicService(key: string, data: unknown, turnstileToken: string | null) {
  return api.post<{ number: number }>(`/api/v1/public/services/${key}/submit`, { data, turnstileToken });
}

// ── Autocadastro do cidadão (Fase 8) ────────────────────────────────────────

export type CadastroPublico = {
  name: string; cpf: string; email: string; telefone: string;
  password: string; turnstileToken: string | null;
};

/** Cria a conta do cidadão. `jaExiste` = já há conta com o CPF/e-mail informados. */
export function signupPublico(req: CadastroPublico) {
  return api.post<{ jaExiste: boolean; detail: string }>('/api/v1/public/signup', req);
}

/** Confirma o e-mail pelo código. O servidor já devolve sessão. */
export function confirmarCadastro(email: string, code: string) {
  return api.post<{ accessToken: string }>('/api/v1/public/signup/confirm', { email, code });
}

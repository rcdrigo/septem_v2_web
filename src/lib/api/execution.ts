import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fetchDocumentCodes, fetchTaskSignatures } from '@/lib/upload';

export type StartedInstance = { executionId: string; status: string; tasks: { id: string; name: string | null }[]; nextTaskForMe?: string | null };
export type RequestSummary = { label: string; value: string };
export type ProcessMetadata = { process?: string | null; processKey?: string | null; processIcon?: string | null; categoryName?: string | null; categoryColor?: string | null; inboxText?: string | null; processNumber?: number; requester?: string | null };
/** isTest: instância iniciada em modo simulação (todas as tarefas ficam com o requisitante). */
export type MyTask = ProcessMetadata & { id: string; name: string | null; executionId: string; createdAt: string; startedAt?: string; dueAt: string | null; completedAt?: string | null; action?: string | null; isTest?: boolean; summary?: RequestSummary[] };
export type ExecutedTask = MyTask & { completedAt: string | null; action: string | null };
export type TaskListItem = MyTask | ExecutedTask;
/** Faceta de um botão de processo: nome + quantas tarefas ele tem nos filtros atuais. */
export type ProcessFacet = { key: string; name: string; count: number };
export type TasksResult = { items: TaskListItem[]; processes: ProcessFacet[] };
/** Filtros da lista de tarefas (Fase 9) — todos resolvidos no servidor. */
export type TaskFilters = {
  q?: string;
  process?: string;
  number?: string;
  requestedFrom?: string;
  requestedTo?: string;
  receivedFrom?: string;
  receivedTo?: string;
  sort?: 'prazo' | 'numero';
  dir?: 'asc' | 'desc';
};
export type TaskSummary = { pendingCount: number };
export type TaskButton = { id: string; label: string; validateForm: boolean; requireJustification?: boolean; primaryColor?: string | null; textColor?: string | null; icon?: string | null; hint?: string | null };
export type FieldOptions = Record<string, { value: string; label: string }[]>;
export type TaskDetail = {
  id: string; name: string | null; status: string; executionId: string;
  process?: string | null; processNumber?: number | null; isTest?: boolean;
  alias?: string | null; sector?: string | null;
  documentationUrl?: string | null;
  formSchema: unknown; data: unknown; buttons: TaskButton[]; fieldOptions?: FieldOptions;
  messages?: { count: number; canPost: boolean };
};
export type CompleteResult = { taskStatus: string; executionStatus: string; pendingTasks: number; executionId?: string; nextTaskForMe?: string | null };

const execKeys = { tasks: ['workflow', 'tasks'] as const, summary: ['workflow', 'tasks', 'summary'] as const, task: (id: string) => ['workflow', 'task', id] as const };

/**
 * Assinaturas dos anexos da tarefa (Fase 7a/7c). Fica aqui, com react-query, porque DOIS
 * lugares precisam do mesmo dado — o ícone no anexo (`ReactForm`) e os botões de
 * conclusão (`TaskView`). Buscar em cada um daria duas requisições e, pior, dois estados
 * que divergem: o ícone verde com o botão ainda bloqueado.
 */
export const signatureKeys = { task: (id: string) => ['workflow', 'signatures', id] as const };

export function useTaskSignatures(taskId: string | null | undefined) {
  return useQuery({
    queryKey: signatureKeys.task(taskId ?? ''),
    queryFn: () => fetchTaskSignatures(taskId!),
    enabled: !!taskId,
    // Tarefa sem assinatura configurada responde normalmente (listas vazias); erro real
    // não vale retry — a tela apenas não mostra assinatura.
    retry: false,
  });
}

/** Assina todos os documentos pendentes da tarefa (Fase 7c). */
/**
 * Códigos verificadores dos documentos da tarefa (Fase 9). Fica no mesmo cache
 * compartilhado das assinaturas: os dois são lidos ao lado do anexo.
 */
export function useDocumentCodes(taskId: string | null | undefined) {
  return useQuery({
    queryKey: ['workflow', 'document-codes', taskId ?? ''],
    queryFn: () => fetchDocumentCodes(taskId!),
    enabled: !!taskId,
    retry: false,
  });
}

export function useSignAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      api.post<{ assinados: string[]; total: number }>(`/api/v1/workflow/tasks/${taskId}/sign-all`, {}),
    onSuccess: (_r, taskId) => qc.invalidateQueries({ queryKey: signatureKeys.task(taskId) }),
  });
}
const TASKS_REFETCH_INTERVAL_MS = 60_000;
/** Fase 9: a lista de tarefas se atualiza sozinha a cada 5 minutos. */
export const TASKS_LIST_REFETCH_INTERVAL_MS = 300_000;

/** Schema form-js do processo (formulário inicial de "Iniciar"). */
export type StartForm = {
  formSchema: unknown;
  buttons: TaskButton[];
  fieldOptions?: FieldOptions;
  /** Valores iniciais vindos das fontes por campo da tarefa de início. */
  data?: Record<string, unknown> | null;
  documentationUrl?: string | null;
  processName?: string | null;
  startTaskName?: string | null;
  startTaskAlias?: string | null;
  startTaskSector?: string | null;
};
/**
 * Formulário inicial do serviço. Com `homologation`, serve o formulário da versão EM
 * HOMOLOGAÇÃO (Fase 5) — sem isso a simulação abriria o formulário de PRODUÇÃO e
 * mandaria os dados para a versão de teste: o usuário veria o campo antigo e juraria
 * que a homologação não funcionou.
 */
export function useProcessForm(key: string | null, homologation = false) {
  return useQuery({
    queryKey: ['workflow', 'process-form', key, homologation],
    // Uma nova abertura deve conferir publicações feitas em outra aba/sessão.
    staleTime: 0,
    queryFn: () => api.get<StartForm>(
      `/api/v1/workflow/process-definitions/${key}/form${homologation ? '?homologation=true' : ''}`),
    enabled: !!key,
  });
}

/** Existe versão em homologação para este processo? Decide se a tela pergunta a versão. */
export function useHasHomologation(key: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['workflow', 'process-form', key, 'has-homologation'],
    staleTime: 0,
    queryFn: () => api.get<StartForm>(`/api/v1/workflow/process-definitions/${key}/form?homologation=true`)
      .then((r) => !!r.formSchema)
      .catch(() => false),
    enabled: !!key && enabled,
  });
}

export function useStartInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; data?: unknown; isTest?: boolean; useHomologation?: boolean }) => api.post<StartedInstance>('/api/v1/workflow/instances', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: execKeys.tasks }),
  });
}

export function useMyTasks() {
  return useTasks('pendentes');
}

/** Tarefas que o usuário concluiu (não estão mais com ele). */
export function useExecutedTasks() {
  return useQuery({
    queryKey: [...execKeys.tasks, 'concluidas'],
    queryFn: async () => (await api.get<TasksResult>('/api/v1/workflow/tasks?status=concluida')).items as ExecutedTask[],
  });
}

/** Monta a query string só com o que o usuário realmente preencheu. */
function taskFilterParams(status: 'pendentes' | 'concluidas', filters: TaskFilters) {
  const qs = new URLSearchParams(status === 'concluidas' ? { status: 'concluida' } : { assignee: 'me' });
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && String(value).trim() !== '') qs.set(key, String(value).trim());
  }
  return qs;
}

export function useTasks(status: 'pendentes' | 'concluidas', filters: TaskFilters = {}) {
  const qs = taskFilterParams(status, filters);
  return useQuery({
    queryKey: [...execKeys.tasks, status, qs.toString()],
    queryFn: () => api.get<TasksResult>(`/api/v1/workflow/tasks?${qs.toString()}`),
    // staleTime 0 porque o padrão global (60s) faria o refetch ao voltar o foco
    // ser ignorado justamente na janela em que ele é mais esperado.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: TASKS_LIST_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    placeholderData: (previous) => previous,
  });
}

export function useTaskSummary() {
  return useQuery({
    queryKey: execKeys.summary,
    queryFn: () => api.get<TaskSummary>('/api/v1/workflow/tasks/summary'),
    refetchInterval: TASKS_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useTask(id: string | null) {
  return useQuery({ queryKey: execKeys.task(id ?? ''), queryFn: () => api.get<TaskDetail>(`/api/v1/workflow/tasks/${id}`), enabled: !!id });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, action, justification }: { id: string; data?: unknown; action?: string; justification?: string }) =>
      api.post<CompleteResult>(`/api/v1/workflow/tasks/${id}/complete`, { data, action, justification }),
    onSuccess: () => qc.invalidateQueries({ queryKey: execKeys.tasks }),
  });
}

/** Salva (rascunho) os dados do formulário da tarefa sem concluir. */
export function useSaveTask() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: unknown }) =>
      api.post<{ taskStatus: string }>(`/api/v1/workflow/tasks/${id}/save`, { data }),
  });
}

// ── instâncias (acompanhamento) ───────────────────────────────────────
export type InstanceListItem = ProcessMetadata & { id: string; number?: number; status: string; isTest?: boolean; startedAt: string; endedAt: string | null; pendingTasks: number };
export type InstancesPage = { items: InstanceListItem[]; total: number; page: number; pageSize: number };
export type FieldChange = { changedAt: string; changedBy: string | null; impersonator: string | null; action: string; group: string | null; field: string; changeType: string; oldValue: string | null; newValue: string | null };
/** isStart: a tarefa nasceu do evento de início — na tramitação ela É o nó de abertura. */
export type InstanceTask = { id: string; name: string | null; status: string; isStart?: boolean; assignee: string | null; completedBy: string | null; completedByImpersonator?: string | null; createdAt: string; completedAt: string | null; dueAt: string | null; action: string | null; justification?: string | null; fieldHistory?: FieldChange[] };
export type ActiveTask = { name: string | null; assignee: string | null; startedAt?: string | null; dueAt: string | null };
/** Ação administrativa registrada na tramitação (Fase 4). */
export type InstanceAction = { action: string; justification: string; at: string; actor: string | null; onBehalfOf?: string | null; targetTaskName?: string | null; targetUser?: string | null };
/** Opções dos modais — vêm PRONTAS do servidor; a tela não recalcula a regra. */
export type ActionOptions = {
  returnTargets: { taskBpmnId: string; name: string | null }[];
  forwardTargets: { taskBpmnId: string; name: string | null }[];
  reopenTargets: { taskBpmnId: string; name: string | null }[];
  reassignCandidates: { id: string; name: string }[];
  reassignSource: string | null;
};
export type InstanceDetail = { id: string; number?: number; process: string | null; category?: string | null; flowKey?: string | null; requester?: string | null; status: string; isTest?: boolean; startedAt: string; endedAt: string | null; data: unknown; formSchema?: unknown; inboxHtml?: string | null; activeTask?: ActiveTask | null; tasks: InstanceTask[]; actions?: InstanceAction[]; canEdit?: boolean; canCancel?: boolean; canDelete?: boolean; canReopen?: boolean; canReturn?: boolean; canForward?: boolean; canReassign?: boolean; messages?: { count: number; canPost: boolean } };
export type InstancesParams = { q?: string; status?: string; mine?: boolean; page?: number; pageSize?: number };

export function useInstances(params: InstancesParams) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.mine) qs.set('mine', 'me');
  qs.set('page', String(params.page ?? 1));
  qs.set('pageSize', String(params.pageSize ?? 20));
  return useQuery({ queryKey: ['workflow', 'instances', params], queryFn: () => api.get<InstancesPage>(`/api/v1/workflow/instances?${qs.toString()}`), placeholderData: (p) => p });
}

export function useInstance(id: string | null, messageAccess?: string | null) {
  const qs = messageAccess ? `?messageAccess=${encodeURIComponent(messageAccess)}` : '';
  return useQuery({ queryKey: ['workflow', 'instance', id, messageAccess ?? 'normal'], queryFn: () => api.get<InstanceDetail>(`/api/v1/workflow/instances/${id}${qs}`), enabled: !!id });
}

/** Edita (overlay) os dados do formulário de uma instância (admin ou capability 'edit'). */
export function useUpdateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => api.put<void>(`/api/v1/workflow/instances/${id}`, { data }),
    onSuccess: (_d, { id }) => { qc.invalidateQueries({ queryKey: ['workflow', 'instance', id] }); qc.invalidateQueries({ queryKey: ['workflow', 'instances'] }); },
  });
}

/** Cancelar agora EXIGE justificativa — a regra é do servidor (422 sem ela). */
export function useCancelInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, justification }: { id: string; justification: string }) =>
      api.post<void>(`/api/v1/workflow/instances/${id}/cancel`, { justification }),
    onSuccess: (_d, { id }) => { qc.invalidateQueries({ queryKey: ['workflow', 'instance', id] }); qc.invalidateQueries({ queryKey: ['workflow', 'instances'] }); },
  });
}

/**
 * Devolver / encaminhar / reabrir — a etapa de destino e a justificativa.
 * As três compartilham o contrato; o que muda é a rota e o universo de etapas,
 * decidido pelo SERVIDOR (ver useActionOptions).
 */
export function useMoveInstance(action: 'return' | 'forward' | 'reopen') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, taskBpmnId, justification }: { id: string; taskBpmnId: string; justification: string }) =>
      api.post<{ taskId: string; name: string | null }>(`/api/v1/workflow/instances/${id}/${action}`, { taskBpmnId, justification }),
    onSuccess: (_d, { id }) => { qc.invalidateQueries({ queryKey: ['workflow', 'instance', id] }); qc.invalidateQueries({ queryKey: ['workflow', 'instances'] }); qc.invalidateQueries({ queryKey: ['workflow', 'tasks'] }); },
  });
}

export function useReassignInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId, justification }: { id: string; userId: string; justification: string }) =>
      api.post<{ taskId: string }>(`/api/v1/workflow/instances/${id}/reassign`, { userId, justification }),
    onSuccess: (_d, { id }) => { qc.invalidateQueries({ queryKey: ['workflow', 'instance', id] }); qc.invalidateQueries({ queryKey: ['workflow', 'tasks'] }); },
  });
}

/** Listas dos modais. Só busca quando o modal abre (`enabled`) — não pesa o relatório. */
export function useActionOptions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['workflow', 'instance', id, 'action-options'],
    queryFn: () => api.get<ActionOptions>(`/api/v1/workflow/instances/${id}/action-options`),
    enabled,
  });
}

export function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/v1/workflow/instances/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow', 'instances'] }),
  });
}

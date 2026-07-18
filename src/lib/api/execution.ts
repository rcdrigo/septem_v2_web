import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type StartedInstance = { executionId: string; status: string; tasks: { id: string; name: string | null }[]; nextTaskForMe?: string | null };
export type RequestSummary = { label: string; value: string };
export type ProcessMetadata = { process?: string | null; processKey?: string | null; processIcon?: string | null; categoryName?: string | null; categoryColor?: string | null; inboxText?: string | null; processNumber?: number; requester?: string | null };
export type MyTask = ProcessMetadata & { id: string; name: string | null; executionId: string; createdAt: string; dueAt: string | null; completedAt?: string | null; action?: string | null; summary?: RequestSummary[] };
export type ExecutedTask = MyTask & { completedAt: string | null; action: string | null };
export type TaskListItem = MyTask | ExecutedTask;
export type TaskSummary = { pendingCount: number };
export type TaskButton = { id: string; label: string; validateForm: boolean; requireJustification?: boolean; primaryColor?: string | null; textColor?: string | null; icon?: string | null; hint?: string | null };
export type FieldOptions = Record<string, { value: string; label: string }[]>;
export type TaskDetail = {
  id: string; name: string | null; status: string; executionId: string;
  process?: string | null; processNumber?: number | null;
  alias?: string | null; sector?: string | null;
  documentationUrl?: string | null;
  formSchema: unknown; data: unknown; buttons: TaskButton[]; fieldOptions?: FieldOptions;
};
export type CompleteResult = { taskStatus: string; executionStatus: string; pendingTasks: number; executionId?: string; nextTaskForMe?: string | null };

const execKeys = { tasks: ['workflow', 'tasks'] as const, summary: ['workflow', 'tasks', 'summary'] as const, task: (id: string) => ['workflow', 'task', id] as const };

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
export function useProcessForm(key: string | null) {
  return useQuery({ queryKey: ['workflow', 'process-form', key], queryFn: () => api.get<StartForm>(`/api/v1/workflow/process-definitions/${key}/form`), enabled: !!key });
}

export function useStartInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; data?: unknown }) => api.post<StartedInstance>('/api/v1/workflow/instances', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: execKeys.tasks }),
  });
}

export function useMyTasks() {
  return useTasks('pendentes');
}

/** Tarefas que o usuário concluiu (não estão mais com ele). */
export function useExecutedTasks() {
  return useTasks('concluidas');
}

export function useTasks(status: 'pendentes' | 'concluidas') {
  const query = status === 'concluidas' ? 'status=concluida' : 'assignee=me';
  return useQuery({
    queryKey: [...execKeys.tasks, status],
    queryFn: () => api.get<TaskListItem[]>(`/api/v1/workflow/tasks?${query}`),
  });
}

export function useTaskSummary() {
  return useQuery({ queryKey: execKeys.summary, queryFn: () => api.get<TaskSummary>('/api/v1/workflow/tasks/summary') });
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
export type InstanceListItem = ProcessMetadata & { id: string; number?: number; status: string; startedAt: string; endedAt: string | null; pendingTasks: number };
export type InstancesPage = { items: InstanceListItem[]; total: number; page: number; pageSize: number };
export type FieldChange = { changedAt: string; changedBy: string | null; impersonator: string | null; action: string; group: string | null; field: string; changeType: string; oldValue: string | null; newValue: string | null };
export type InstanceTask = { id: string; name: string | null; status: string; assignee: string | null; completedBy: string | null; completedByImpersonator?: string | null; createdAt: string; completedAt: string | null; dueAt: string | null; action: string | null; justification?: string | null; fieldHistory?: FieldChange[] };
export type ActiveTask = { name: string | null; assignee: string | null; startedAt?: string | null; dueAt: string | null };
export type InstanceDetail = { id: string; number?: number; process: string | null; category?: string | null; flowKey?: string | null; requester?: string | null; status: string; startedAt: string; endedAt: string | null; data: unknown; formSchema?: unknown; inboxHtml?: string | null; activeTask?: ActiveTask | null; tasks: InstanceTask[]; canEdit?: boolean; canCancel?: boolean; canDelete?: boolean };
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

export function useInstance(id: string | null) {
  return useQuery({ queryKey: ['workflow', 'instance', id], queryFn: () => api.get<InstanceDetail>(`/api/v1/workflow/instances/${id}`), enabled: !!id });
}

/** Edita (overlay) os dados do formulário de uma instância (admin ou capability 'edit'). */
export function useUpdateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => api.put<void>(`/api/v1/workflow/instances/${id}`, { data }),
    onSuccess: (_d, { id }) => { qc.invalidateQueries({ queryKey: ['workflow', 'instance', id] }); qc.invalidateQueries({ queryKey: ['workflow', 'instances'] }); },
  });
}

export function useCancelInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/api/v1/workflow/instances/${id}/cancel`, {}),
    onSuccess: (_d, id) => { qc.invalidateQueries({ queryKey: ['workflow', 'instance', id] }); qc.invalidateQueries({ queryKey: ['workflow', 'instances'] }); },
  });
}

export function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/v1/workflow/instances/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow', 'instances'] }),
  });
}

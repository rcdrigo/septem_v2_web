import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSessionStore } from '@/stores/session';

export type TagActor = {
  id: string;
  name: string;
};

export type TagCatalogItem = {
  id: string;
  name: string;
  color?: string | null;
};

export type ExecutionTag = TagCatalogItem & {
  addedBy: TagActor;
  addedAt: string;
};

export type TagSnapshot = {
  executionRevision: number;
  catalogRevision: number;
  flowKey: string;
  catalog: TagCatalogItem[];
  tags: ExecutionTag[];
};

export type RenameTagInput = {
  id: string;
  name: string;
};

export type SaveExecutionTagsInput = {
  executionRevision: number;
  catalogRevision: number;
  selectedTagIds: string[];
  createNames: string[];
  createTags: { name: string; color: string }[];
  colorUpdates: { id: string; color: string }[];
  renames: RenameTagInput[];
  deleteTagIds: string[];
};

export type ExecutionTagHistoryAction = 'added' | 'removed' | 'renamed' | 'recolored' | 'deleted';
export type ProcessTagHistoryAction = 'created' | 'renamed' | 'recolored' | 'deleted';

export type TagHistoryItem<TAction extends string = ExecutionTagHistoryAction> = {
  id: string;
  action: TAction;
  tagId: string;
  tagName: string;
  previousName?: string | null;
  previousColor?: string | null;
  color?: string | null;
  occurredAt: string;
  actor: TagActor;
  operator?: TagActor | null;
};

export type TagHistoryResponse<TAction extends string = ExecutionTagHistoryAction> = {
  items: TagHistoryItem<TAction>[];
};

export const tagKeys = {
  all: ['tags'] as const,
  execution: (executionId: string | number) => ['tags', 'execution', String(executionId)] as const,
  executionHistory: (executionId: string | number) => ['tags', 'execution', String(executionId), 'history'] as const,
  processHistory: (flowKey: string | number) => ['tags', 'flow', String(flowKey), 'history'] as const,
};

const internalModeHeaders = { 'X-Access-Mode': 'interno' } as const;

/**
 * Tags are intentionally unavailable while an internal user is browsing in the
 * external view. Components and API hooks use the same gate so a missed UI guard
 * cannot accidentally issue a request.
 */
export function useTagsAccess(): boolean {
  return useSessionStore((state) => Boolean(state.user?.isInternal && state.accessMode === 'interno'));
}

export function useExecutionTags(executionId: string | number | null | undefined, enabled = true) {
  const hasAccess = useTagsAccess();
  return useQuery({
    queryKey: tagKeys.execution(executionId ?? ''),
    queryFn: () => api.get<TagSnapshot>(
      `/api/v1/workflow/instances/${encodeURIComponent(String(executionId))}/tags`,
      { headers: internalModeHeaders },
    ),
    enabled: enabled && hasAccess && executionId !== null && executionId !== undefined && String(executionId) !== '',
  });
}

export function useSaveExecutionTags(executionId: string | number) {
  const hasAccess = useTagsAccess();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveExecutionTagsInput) => {
      if (!hasAccess) return Promise.reject(new Error('Tags indisponíveis no modo externo.'));
      return api.put<TagSnapshot>(
        `/api/v1/workflow/instances/${encodeURIComponent(String(executionId))}/tags`,
        input,
        { headers: internalModeHeaders },
      );
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(tagKeys.execution(executionId), snapshot);
      // Rename/delete affect every execution that uses the catalog item. Invalidate
      // all tag views and both workflow listings so their pills cannot stay stale.
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'instances'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'instance'] });
    },
  });
}

export function useExecutionTagHistory(executionId: string | number | null | undefined, enabled = true) {
  const hasAccess = useTagsAccess();
  return useQuery({
    queryKey: tagKeys.executionHistory(executionId ?? ''),
    queryFn: () => api.get<TagHistoryResponse>(
      `/api/v1/workflow/instances/${encodeURIComponent(String(executionId))}/tags/history`,
      { headers: internalModeHeaders },
    ),
    enabled: enabled && hasAccess && executionId !== null && executionId !== undefined && String(executionId) !== '',
  });
}

export function useProcessTagHistory(flowKey: string | number | null | undefined, enabled = true) {
  const hasAccess = useTagsAccess();
  return useQuery({
    queryKey: tagKeys.processHistory(flowKey ?? ''),
    queryFn: () => api.get<TagHistoryResponse<ProcessTagHistoryAction>>(
      `/api/v1/workflow/flows/${encodeURIComponent(String(flowKey))}/tags/history`,
      { headers: internalModeHeaders },
    ),
    enabled: enabled && hasAccess && flowKey !== null && flowKey !== undefined && String(flowKey) !== '',
  });
}

export function normalizeTagName(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

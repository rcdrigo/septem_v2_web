import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type MessageMention = { kind: 'user' | 'all'; name: string; userId: string | null };
export type ProcessMessage = {
  id: string;
  body: string;
  hiddenFromRequester: boolean;
  createdAt: string;
  rootId: string | null;
  replyToId: string | null;
  author: { id: string; name: string; photoUrl: string | null };
  mentions: MessageMention[];
  origin: { type: 'task' | 'report'; taskCode: string | null; taskName: string | null; processName: string; processNumber: number };
};
export type MessageThread = { message: ProcessMessage; replies: ProcessMessage[] };
export type MessagesPage = {
  canPost: boolean;
  canHideFromRequester: boolean;
  hasMore: boolean;
  nextBefore: string | null;
  items: MessageThread[];
};
export type MentionCandidate = { id: string; name: string; email: string; photoUrl: string | null; isInternal: boolean };
export type MentionCandidates = { allowEveryone: boolean; items: MentionCandidate[] };

const key = (executionId: string, messageAccess?: string | null) => ['workflow', 'messages', executionId, messageAccess ?? 'normal'] as const;
const accessQuery = (messageAccess?: string | null) => messageAccess ? `messageAccess=${encodeURIComponent(messageAccess)}` : '';

export function useProcessMessages(executionId: string, messageAccess?: string | null) {
  return useInfiniteQuery({
    queryKey: key(executionId, messageAccess),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (messageAccess) qs.set('messageAccess', messageAccess);
      if (pageParam) qs.set('before', pageParam);
      qs.set('pageSize', '20');
      return api.get<MessagesPage>(`/api/v1/workflow/instances/${executionId}/messages?${qs}`);
    },
    getNextPageParam: (last) => last.hasMore ? last.nextBefore : undefined,
    enabled: !!executionId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMentionCandidates(executionId: string, search: string, enabled: boolean, messageAccess?: string | null) {
  return useQuery({
    queryKey: [...key(executionId, messageAccess), 'candidates', search],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (messageAccess) qs.set('messageAccess', messageAccess);
      if (search) qs.set('q', search);
      return api.get<MentionCandidates>(`/api/v1/workflow/instances/${executionId}/messages/candidates?${qs}`);
    },
    enabled: enabled && !!executionId,
    staleTime: 30_000,
  });
}

export function useSendProcessMessage(executionId: string, messageAccess?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      body: string;
      mentionedUserIds: string[];
      mentionAll: boolean;
      replyToId: string | null;
      hiddenFromRequester: boolean;
      originType: 'task' | 'report';
      taskId: string | null;
    }) => {
      const qs = accessQuery(messageAccess);
      return api.post<{ id: string }>(`/api/v1/workflow/instances/${executionId}/messages${qs ? `?${qs}` : ''}`, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: key(executionId, messageAccess) });
      await qc.invalidateQueries({ queryKey: ['workflow', 'instance', executionId] });
    },
  });
}

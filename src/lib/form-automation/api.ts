import { api } from '@/lib/api';
import type { AutomationSchema, AutomationSource } from './runtime';
export type ChatMessage = { role: string; content: string; taskId: string; createdAt: string; code?: string | null; model?: string | null };
export type Conversation = { id: string; version: number; requesterName?: string; messages: ChatMessage[] };
export type AutomationState = { head: number; publishedVersion: number | null; scripts: AutomationSource[]; tasks: { id: string; name: string }[]; schema: AutomationSchema };
export type Revision = { version: number; status: string; changelog: string; authorName: string; publisherName: string | null; createdAt: string; restoredFrom: number | null; scripts: AutomationSource[]; conversations: Conversation[] };
export const automationApi = (key: string) => {
  const base = `/api/v1/workflow/process-definitions/${encodeURIComponent(key)}/automation`;
  return {
    load: () => api.get<AutomationState>(base),
    history: () => api.get<Revision[]>(`${base}/revisions`),
    conversations: () => api.get<Conversation[]>(`${base}/conversations`),
    save: (body: { expectedVersion: number; scripts: AutomationSource[]; changelog: string; conversationIds: string[]; restoredFrom: number | null }) => api.post<{ version: number }>(`${base}/draft`, body),
    publish: (expectedVersion: number) => api.post<{ version: number }>(`${base}/publish`, { expectedVersion }),
    chat: (body: { conversationId: string | null; expectedConversationVersion: number; taskId: string; prompt: string; scripts: AutomationSource[] }) => api.post<Conversation>(`${base}/chat`, body),
  };
};

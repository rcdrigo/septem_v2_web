import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type RecipientKind = 'to' | 'cc' | 'bcc';
export type RecipientType = 'requester' | 'position' | 'dynamic' | 'fixedUser' | 'fixedAddress' | 'sql';

export type Recipient = {
  kind: RecipientKind;
  type: RecipientType;
  orgUnitId?: string | null;
  positionId?: string | null;
  fieldRef?: string | null;
  userId?: string | null;
  address?: string | null;
  sql?: string | null;
};

export type Attachment = { fieldRef: string };

export type EmailTemplateListItem = { id: string; name: string; description: string | null };
export type EmailTemplateDetail = {
  id: string; name: string; description: string | null;
  subject: string | null; bodyHtml: string | null;
  attachments: Attachment[]; recipients: Recipient[];
};
export type EmailTemplateWrite = {
  name: string; description?: string; subject?: string; bodyHtml?: string;
  attachments: Attachment[]; recipients: Recipient[];
};

const keys = { all: ['email-templates'] as const, detail: (id: string) => ['email-templates', id] as const };

export function useEmailTemplatesList() {
  return useQuery({ queryKey: keys.all, queryFn: () => api.get<EmailTemplateListItem[]>('/api/v1/email-templates/') });
}

export function useEmailTemplate(id: string | null) {
  return useQuery({ queryKey: keys.detail(id ?? ''), queryFn: () => api.get<EmailTemplateDetail>(`/api/v1/email-templates/${id}`), enabled: !!id });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: EmailTemplateWrite) => api.post<{ id: string }>('/api/v1/email-templates/', body), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, body }: { id: string; body: EmailTemplateWrite }) => api.put<void>(`/api/v1/email-templates/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del<void>(`/api/v1/email-templates/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
}

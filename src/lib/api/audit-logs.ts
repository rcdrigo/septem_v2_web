import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AuditEntry = {
  id: number;
  occurredAt: string;
  userId: number | null;
  ip: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  correlationId: string | null;
};

export type AuditPage = { items: AuditEntry[]; total: number; page: number; pageSize: number };

export type AuditParams = {
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

function toQuery(p: AuditParams): string {
  const qs = new URLSearchParams();
  if (p.action) qs.set('action', p.action);
  if (p.entityType) qs.set('entityType', p.entityType);
  if (p.from) qs.set('from', p.from);
  if (p.to) qs.set('to', p.to);
  qs.set('page', String(p.page ?? 1));
  qs.set('pageSize', String(p.pageSize ?? 50));
  return `?${qs.toString()}`;
}

export function useAuditLogs(params: AuditParams) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.get<AuditPage>(`/api/v1/audit-logs${toQuery(params)}`),
    placeholderData: (prev) => prev,
  });
}

import type { BusinessHoursWeek } from '@/lib/business-calendar';
import type { CalendarLocation } from '@/lib/business-calendar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Parâmetros do sistema (Fase 1). Visão consolidada: branding do catálogo master
 * + configurações do tenant (hero do login, expediente, SMTP, S3).
 * Segredos (senha SMTP / secret key do S3) NUNCA chegam no front — só os flags
 * `passwordSet` / `secretKeySet`. Ao salvar, campo em branco = "não altera".
 */
export type SettingsGeneral = CalendarLocation & {
  tenantId: string;
  host: string | null;
  ambienteNome: string;
  logoUrl: string | null;
  primaryColor: string;
  heroImageUrl: string | null;
  systemDescription: string | null;
  businessHourStart: number;
  businessHourEnd: number;
  businessDays: string;
  businessHours?: BusinessHoursWeek | null;
};

export type SettingsEmail = {
  host: string | null;
  port: number;
  useSsl: boolean;
  authMode: string;
  user: string | null;
  passwordSet: boolean;
  fromAddress: string | null;
  fromName: string | null;
};

export type SettingsStorage = {
  bucketName: string | null;
  region: string | null;
  endpoint: string | null;
  accessKey: string | null;
  secretKeySet: boolean;
  baseFolder: string | null;
  cdnUrl: string | null;
  useSignedUrls: boolean;
  urlExpirationMinutes: number;
  storageClass: string | null;
  encryption: string | null;
  maxUploadMb: number;
  blockedExtensions: string;
};

export type SettingsSecurity = {
  /** off = sem 2FA · internal = só funcionários · all = todo mundo. */
  twoFactorMode: 'off' | 'internal' | 'all';
  maxLoginAttempts: number;
  lockoutMinutes: number;
};

export type SettingsOpenRouter = {
  apiKeySet?: boolean;
  model: string | null;
};
export type OpenRouterPayload = Omit<SettingsOpenRouter, 'apiKeySet'> & { apiKey: string | null };

export type SettingsPolicy = {
  visible: boolean;
  editable: boolean;
};

export function useSaveOpenRouter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: OpenRouterPayload) => {
      const settings = qc.getQueryData<Settings>(KEY);
      return api.put('/api/v1/settings/openrouter', sanitizeSettingsPayload('openrouter', p, settings?.policies));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export type Settings = {
  general?: SettingsGeneral;
  email?: SettingsEmail;
  storage?: SettingsStorage;
  security?: SettingsSecurity;
  openRouter?: SettingsOpenRouter;
  updatedAt?: string;
  /** Overrides returned by SettingsVisibilityFilter. Missing paths remain visible/editable. */
  policies?: Record<string, SettingsPolicy>;
};

export type GeneralPayload = CalendarLocation & {
  ambienteNome: string;
  logoUrl: string | null;
  primaryColor: string;
  heroImageUrl: string | null;
  systemDescription: string | null;
  businessHourStart: number;
  businessHourEnd: number;
  businessDays: string;
  businessHours?: BusinessHoursWeek | null;
};

export type EmailPayload = {
  host: string | null;
  port: number;
  useSsl: boolean;
  authMode: string;
  user: string | null;
  /** null = mantém a senha atual; '' = limpa; texto = substitui. */
  password: string | null;
  fromAddress: string | null;
  fromName: string | null;
  /** Required for the server to test the candidate before activation. */
  testTo?: string;
};

export type StoragePayload = {
  bucketName: string | null;
  region: string | null;
  endpoint: string | null;
  accessKey: string | null;
  /** null = mantém a secret key atual; '' = limpa; texto = substitui. */
  secretKey: string | null;
  baseFolder: string | null;
  cdnUrl: string | null;
  useSignedUrls: boolean;
  urlExpirationMinutes: number;
  storageClass: string | null;
  encryption: string | null;
  maxUploadMb: number;
  blockedExtensions: string;
};

const KEY = ['settings'];

const DEFAULT_POLICY: SettingsPolicy = { visible: true, editable: true };

function policyAt(policies: Record<string, SettingsPolicy> | undefined, path: string): SettingsPolicy {
  if (!policies) return DEFAULT_POLICY;
  const key = Object.keys(policies).find((candidate) => candidate.toLowerCase() === path.toLowerCase());
  return key ? policies[key] : DEFAULT_POLICY;
}

export function settingsSectionVisible(policies: Record<string, SettingsPolicy> | undefined, section: string): boolean {
  const key = section.toLowerCase();
  if (key === 'general' || key === 'public') return true;
  if (key === 'security') return false;
  if (['email', 'storage', 'openrouter'].includes(key)) {
    const path = Object.keys(policies ?? {}).find(path => path.toLowerCase() === key);
    return !!path && !!policies?.[path].visible && !!policies[path].editable;
  }
  return policyAt(policies, section).visible;
}

export function settingsSectionEditable(policies: Record<string, SettingsPolicy> | undefined, section: string): boolean {
  if (section.toLowerCase() === 'security') return false;
  if (section.toLowerCase() === 'general' || section.toLowerCase() === 'public') return true;
  return settingsSectionVisible(policies, section) && policyAt(policies, section).editable;
}

export function settingsFieldPolicy(policies: Record<string, SettingsPolicy> | undefined, section: string, _field?: string): SettingsPolicy {
  return { visible: settingsSectionVisible(policies, section), editable: settingsSectionEditable(policies, section) };
}

/** Removes hidden/read-only fields before a settings mutation is sent to the API. */
export function sanitizeSettingsPayload<T extends object>(
  section: string,
  payload: T,
  policies: Record<string, SettingsPolicy> | undefined,
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(payload) as Array<keyof T>) {
    const permission = settingsFieldPolicy(policies, section, String(key));
    if (String(key) !== 'clienteNome' && permission.visible && permission.editable) result[key] = payload[key];
  }
  return result;
}

export function useSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => api.get<Settings>('/api/v1/settings') });
}

export function useSaveGeneral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: GeneralPayload) => {
      const settings = qc.getQueryData<Settings>(KEY);
      return api.put('/api/v1/settings/general', sanitizeSettingsPayload('general', p, settings?.policies));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function uploadSettingsBrandImage(kind: 'logo' | 'hero', file: File): Promise<{ url: string }> {
  const body = new FormData();
  body.append('file', file);
  return api.postForm(`/api/v1/settings/brand-assets/${kind}`, body);
}

/** Situação das integrações do ambiente e se este cliente pode trocar credenciais (ADM-04). */
export type IntegrationState = {
  kind: string;
  name: string;
  owner: string;
  status: 'configured' | 'missing';
  requiredBy: string[];
};

export function useIntegrations() {
  return useQuery({
    queryKey: ['settings', 'integrations'] as const,
    queryFn: () => api.get<{ items: IntegrationState[]; canEditCredentials: boolean }>('/api/v1/settings/integrations'),
  });
}

export function useSaveEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: EmailPayload) => {
      const settings = qc.getQueryData<Settings>(KEY);
      return api.put('/api/v1/settings/email', sanitizeSettingsPayload('email', p, settings?.policies));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Testa a configuração candidata sem ativá-la. A ativação também exige teste no servidor. */
export function useTestEmail() {
  return useMutation({ mutationFn: (body: { to: string; candidate: EmailPayload }) => api.post('/api/v1/settings/email/test', body) });
}

export function useSaveStorage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: StoragePayload) => {
      const settings = qc.getQueryData<Settings>(KEY);
      return api.put('/api/v1/settings/storage', sanitizeSettingsPayload('storage', p, settings?.policies));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Testa o bucket com a config JÁ SALVA (salve antes de testar). */
export function useTestStorage() {
  return useMutation({ mutationFn: () => api.post('/api/v1/settings/storage/test', {}) });
}

export function useSaveSecurity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SettingsSecurity) => {
      const settings = qc.getQueryData<Settings>(KEY);
      return api.put('/api/v1/settings/security', sanitizeSettingsPayload('security', p, settings?.policies));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Dias úteis: ISO-8601 (1 = segunda … 7 = domingo), como o backend guarda. */
export const WEEKDAYS: Array<{ value: number; label: string; short: string }> = [
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 7, label: 'Domingo', short: 'Dom' },
];

export function parseDays(csv: string): number[] {
  return csv
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => d >= 1 && d <= 7);
}
